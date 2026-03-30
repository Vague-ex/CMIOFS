from decimal import Decimal
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from accounts.permissions import IsAdminOrManager
from inventory.models import InventoryTransaction
from .models import PurchaseOrder, PurchaseOrderLine, POReceipt, POReceiptLine
from .serializers import (
    PurchaseOrderSerializer, PurchaseOrderWriteSerializer,
    POReceiptSerializer, POReceiptLineSerializer
)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.prefetch_related(
        'lines__item__uom', 'receipts__lines__po_line__item', 'supplier'
    ).order_by('-created')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'supplier']
    search_fields = ['po_number', 'supplier__name']
    permission_classes = [IsAdminOrManager]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PurchaseOrderWriteSerializer
        return PurchaseOrderSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'], url_path='submit')
    def submit(self, request, pk=None):
        po = self.get_object()
        if po.status != PurchaseOrder.Status.DRAFT:
            return Response({'error': 'Only draft POs can be submitted.'}, status=400)
        po.status = PurchaseOrder.Status.SUBMITTED
        po.save()
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='supplier-accept')
    def supplier_accept(self, request, pk=None):
        po = self.get_object()
        if po.status != PurchaseOrder.Status.SUBMITTED:
            return Response({'error': 'PO must be submitted first.'}, status=400)
        po.status = PurchaseOrder.Status.ACCEPTED
        po.supplier_response_note = request.data.get('note', '')
        po.save()
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='supplier-reject')
    def supplier_reject(self, request, pk=None):
        po = self.get_object()
        if po.status != PurchaseOrder.Status.SUBMITTED:
            return Response({'error': 'PO must be submitted first.'}, status=400)
        po.status = PurchaseOrder.Status.REJECTED
        po.supplier_response_note = request.data.get('note', '')
        po.save()
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='receive')
    def receive(self, request, pk=None):
        po = self.get_object()
        if po.status not in (PurchaseOrder.Status.ACCEPTED, PurchaseOrder.Status.PARTIALLY):
            return Response({'error': 'PO must be accepted before receiving.'}, status=400)

        lines_data = request.data.get('lines', [])
        if not lines_data:
            return Response({'error': 'At least one line is required.'}, status=400)

        with transaction.atomic():
            receipt = POReceipt.objects.create(
                po=po,
                received_by=request.user,
                note=request.data.get('note', ''),
            )
            for ld in lines_data:
                try:
                    po_line = PurchaseOrderLine.objects.get(pk=ld['po_line'], po=po)
                except PurchaseOrderLine.DoesNotExist:
                    return Response(
                        {'error': f"PO line {ld['po_line']} not found on this PO."},
                        status=400
                    )

                qty_received = Decimal(str(ld.get('quantity_received', 0)))
                qty_damaged  = Decimal(str(ld.get('quantity_damaged', 0)))
                qty_missing  = Decimal(str(ld.get('quantity_missing', 0)))
                qty_good     = qty_received - qty_damaged

                if qty_good < Decimal('0'):
                    qty_good = Decimal('0')

                POReceiptLine.objects.create(
                    receipt=receipt,
                    po_line=po_line,
                    quantity_received=qty_received,
                    quantity_damaged=qty_damaged,
                    quantity_missing=qty_missing,
                    damage_note=ld.get('damage_note', ''),
                )

                po_line.quantity_received = po_line.quantity_received + qty_good
                po_line.save()

                if qty_good > Decimal('0'):
                    item = po_line.item
                    item.current_quantity = item.current_quantity + qty_good
                    item.save()
                    InventoryTransaction.objects.create(
                        item=item,
                        transaction_type=InventoryTransaction.TransactionType.PO_RECEIPT,
                        quantity_change=qty_good,
                        reference_id=po.pk,
                        reference_type='PurchaseOrder',
                        performed_by=request.user,
                        reason_note=f'Received via {po.po_number}',
                    )

            all_lines = po.lines.all()
            fully_received = all(
                l.quantity_received >= l.quantity_ordered for l in all_lines
            )
            po.status = (
                PurchaseOrder.Status.RECEIVED if fully_received
                else PurchaseOrder.Status.PARTIALLY
            )
            po.save()

        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        po = self.get_object()
        if po.status in (PurchaseOrder.Status.RECEIVED, PurchaseOrder.Status.CANCELLED):
            return Response({'error': 'Cannot cancel this PO.'}, status=400)
        po.status = PurchaseOrder.Status.CANCELLED
        po.save()
        return Response(PurchaseOrderSerializer(po).data)