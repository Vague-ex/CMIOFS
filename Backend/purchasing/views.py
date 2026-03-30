from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db import transaction
from django.core.mail import send_mail
from django.conf import settings
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

        email_result = {'sent': False, 'message': ''}
        supplier_email = (po.supplier.email or '').strip()
        if supplier_email:
            try:
                lines = po.lines.select_related('item').all()
                
                # Generate HTML table rows
                table_rows = ''.join([
                    f"<tr>"
                    f"<td style='padding: 12px; border-bottom: 1px solid #eee;'>{ln.item.name}</td>"
                    f"<td style='padding: 12px; border-bottom: 1px solid #eee; text-align: center;'>{ln.quantity_ordered}</td>"
                    f"<td style='padding: 12px; border-bottom: 1px solid #eee;'>{ln.item.uom.abbreviation if ln.item.uom else 'Unit'}</td>"
                    f"</tr>"
                    for ln in lines
                ])
                
                # Build HTML email
                html_message = f"""
                    <html>
                    <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
                        <div style='max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 8px;'>
                            <p style='font-size: 16px;'>Dear {po.supplier.contact_name or po.supplier.name},</p>
                            
                            <p style='font-size: 14px; margin: 20px 0;'>
                                We have sent a Purchase Order.
                            </p>
                            
                            <p style='font-size: 14px; font-weight: bold; margin: 20px 0;'>
                                Please click the button below to confirm you have received this order and are delivering it:
                            </p>
                            
                            <div style='text-align: center; margin: 30px 0;'>
                                <a href='{settings.FRONTEND_BASE_URL}/po/{po.id}/confirm' 
                                   style='background-color: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;'>
                                    Confirm Order & Delivery
                                </a>
                            </div>
                            
                            <h3 style='font-size: 16px; margin-top: 30px; margin-bottom: 15px;'>Items Ordered:</h3>
                            
                            <table style='width: 100%; border-collapse: collapse; background-color: white;'>
                                <thead>
                                    <tr style='background-color: #f0f0f0;'>
                                        <th style='padding: 12px; text-align: left; border-bottom: 2px solid #ddd;'>Item</th>
                                        <th style='padding: 12px; text-align: center; border-bottom: 2px solid #ddd;'>Qty</th>
                                        <th style='padding: 12px; text-align: left; border-bottom: 2px solid #ddd;'>Unit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {table_rows}
                                </tbody>
                            </table>
                            
                            <p style='font-size: 12px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;'>
                                <strong>PO Number:</strong> {po.po_number}<br>
                                <strong>Supplier:</strong> {po.supplier.name}
                            </p>
                        </div>
                    </body>
                    </html>
                """
                
                send_mail(
                    subject=f"Purchase Order Update: {po.po_number}",
                    message=f"Dear {po.supplier.contact_name or po.supplier.name},\n\nWe have sent/updated a Purchase Order (Status: {po.status}).\n\nPlease confirm receipt of this order.\n\nPO Number: {po.po_number}",
                    from_email=None,
                    recipient_list=[supplier_email],
                    html_message=html_message,
                    fail_silently=False,
                )
                email_result = {'sent': True, 'message': f'PO email sent to {supplier_email}.'}
            except Exception as ex:
                email_result = {'sent': False, 'message': f'PO submitted but email failed: {str(ex)}'}
        else:
            email_result = {'sent': False, 'message': 'PO submitted but supplier has no email address.'}

        data = PurchaseOrderSerializer(po).data
        data['email_notification'] = email_result
        return Response(data)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept(self, request, pk=None):
        """Manager accepts the PO (moves from SUBMITTED to ACCEPTED)."""
        po = self.get_object()
        if po.status != PurchaseOrder.Status.SUBMITTED:
            return Response({'error': 'PO must be submitted before accepting.'}, status=400)
        po.status = PurchaseOrder.Status.ACCEPTED
        po.save()
        return Response(PurchaseOrderSerializer(po).data)

    @action(detail=True, methods=['get', 'post'], url_path='confirm', permission_classes=[AllowAny])
    def confirm(self, request, pk=None):
        """
        Public endpoint: supplier confirms receipt via email link or button.
        No authentication required for this endpoint.
        """
        from django.utils import timezone
        po = self.get_object()
        if po.status in [PurchaseOrder.Status.CANCELLED, PurchaseOrder.Status.REJECTED]:
            return Response({'error': 'This PO is cancelled or rejected.'}, status=400)
        po.supplier_confirmed_at = timezone.now()
        po.save()
        return Response({
            'success': True,
            'message': f'Thank you! We have recorded that you received PO {po.po_number}.',
            'po_number': po.po_number,
        })
    def supplier_accept(self, request, pk=None):
        """Mark as accepted by supplier (admin/manager records this manually)."""
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
        """
        Warehouse staff records what actually arrived.
        Payload: { note, lines: [{po_line, qty_received, qty_damaged, qty_missing, damage_note}] }
        Good items are added to inventory immediately.
        """
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
                po_line = PurchaseOrderLine.objects.get(pk=ld['po_line'], po=po)
                qty_received = float(ld.get('quantity_received', 0))
                qty_damaged  = float(ld.get('quantity_damaged', 0))
                qty_missing  = float(ld.get('quantity_missing', 0))
                qty_good     = qty_received - qty_damaged

                POReceiptLine.objects.create(
                    receipt=receipt,
                    po_line=po_line,
                    quantity_received=qty_received,
                    quantity_damaged=qty_damaged,
                    quantity_missing=qty_missing,
                    damage_note=ld.get('damage_note', ''),
                )

                # Update line and add good items to inventory
                po_line.quantity_received += qty_good
                po_line.save()

                if qty_good > 0:
                    item = po_line.item
                    item.current_quantity += qty_good
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

            # Update PO status
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