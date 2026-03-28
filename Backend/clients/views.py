from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from accounts.permissions import IsAdminOrManager, IsSystemAdmin
from inventory.models import InventoryTransaction
from .models import Client, ClientRequest, SalesOrder, SalesOrderLine
from .serializers import (
    ClientSerializer, SalesOrderSerializer,
    SalesOrderWriteSerializer, ClientRequestSerializer
)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.filter(is_active=True).order_by('name')
    serializer_class = ClientSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'contact_name', 'email']
    permission_classes = [IsAdminOrManager]


class ClientRequestViewSet(viewsets.ModelViewSet):
    queryset = ClientRequest.objects.select_related(
        'requested_by', 'reviewed_by', 'linked_client'
    ).order_by('-created')
    serializer_class = ClientRequestSerializer
    permission_classes = [IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status']
    search_fields = ['name', 'contact_name', 'email']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        is_admin = user.is_superuser or user.role == 'SYSTEM_ADMIN'
        if not is_admin:
            qs = qs.filter(requested_by=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsSystemAdmin])
    def approve(self, request, pk=None):
        req = self.get_object()
        if req.status != ClientRequest.Status.PENDING:
            return Response({'error': 'Only pending requests can be approved.'}, status=400)

        client = Client.objects.create(
            name=req.name,
            contact_name=req.contact_name,
            email=req.email,
            phone=req.phone,
            address=req.address,
            is_active=True,
        )
        req.status = ClientRequest.Status.APPROVED
        req.review_note = request.data.get('review_note', '')
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.linked_client = client
        req.save()

        return Response(self.get_serializer(req).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsSystemAdmin])
    def reject(self, request, pk=None):
        req = self.get_object()
        if req.status != ClientRequest.Status.PENDING:
            return Response({'error': 'Only pending requests can be rejected.'}, status=400)

        req.status = ClientRequest.Status.REJECTED
        req.review_note = request.data.get('review_note', '')
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.save()

        return Response(self.get_serializer(req).data, status=status.HTTP_200_OK)


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
    def dispatch_order(self, request, pk=None):
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