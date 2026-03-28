from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from accounts.permissions import IsAdminOrManager
from inventory.models import InventoryTransaction
from .models import Client, SalesOrder, SalesOrderLine
from .serializers import (
    ClientSerializer, SalesOrderSerializer,
    SalesOrderWriteSerializer
)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.filter(is_active=True).order_by('name')
    serializer_class = ClientSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'contact_name', 'email']
    permission_classes = [IsAdminOrManager]


class SalesOrderViewSet(viewsets.ModelViewSet):
    queryset = SalesOrder.objects.prefetch_related(
        'lines__item__uom', 'client'
    ).order_by('-created')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'client']
    search_fields = ['so_number', 'client__name']
    permission_classes = [IsAdminOrManager]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return SalesOrderWriteSerializer
        return SalesOrderSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='confirm')
    def confirm(self, request, pk=None):
        so = self.get_object()
        if so.status != SalesOrder.Status.DRAFT:
            return Response({'error': 'Only draft SOs can be confirmed.'}, status=400)
        so.status = SalesOrder.Status.CONFIRMED
        so.save()
        return Response(SalesOrderSerializer(so).data)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        so = self.get_object()
        if so.status != SalesOrder.Status.CONFIRMED:
            return Response({'error': 'SO must be confirmed first.'}, status=400)
        so.status = SalesOrder.Status.APPROVED
        so.save()
        return Response(SalesOrderSerializer(so).data)

    @action(detail=True, methods=['post'], url_path='dispatch')
    def dispatch(self, request, pk=None):
        """
        Deduct items from inventory and mark as dispatched.
        """
        so = self.get_object()
        if so.status != SalesOrder.Status.APPROVED:
            return Response({'error': 'SO must be approved before dispatch.'}, status=400)

        with transaction.atomic():
            for line in so.lines.all():
                item = line.item
                if item.current_quantity < line.quantity_requested:
                    return Response(
                        {'error': f'Insufficient stock for {item.name}.'},
                        status=400
                    )
                item.current_quantity -= line.quantity_requested
                item.save()
                InventoryTransaction.objects.create(
                    item=item,
                    transaction_type=InventoryTransaction.TransactionType.DO_DISPATCH,
                    quantity_change=-line.quantity_requested,
                    reference_id=so.pk,
                    reference_type='SalesOrder',
                    performed_by=request.user,
                    reason_note=f'Dispatched for {so.so_number}',
                )
            so.status = SalesOrder.Status.DISPATCHED
            so.save()

        return Response(SalesOrderSerializer(so).data)

    @action(detail=True, methods=['post'], url_path='deliver')
    def deliver(self, request, pk=None):
        so = self.get_object()
        if so.status != SalesOrder.Status.DISPATCHED:
            return Response({'error': 'SO must be dispatched first.'}, status=400)
        so.status = SalesOrder.Status.DELIVERED
        so.client_confirmation_note = request.data.get('note', '')
        so.save()
        return Response(SalesOrderSerializer(so).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        so = self.get_object()
        if so.status in (SalesOrder.Status.DELIVERED, SalesOrder.Status.CANCELLED):
            return Response({'error': 'Cannot cancel this SO.'}, status=400)
        so.status = SalesOrder.Status.CANCELLED
        so.save()
        return Response(SalesOrderSerializer(so).data)