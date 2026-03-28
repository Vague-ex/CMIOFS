from django.db import models
from model_utils.models import TimeStampedModel
from inventory.models import Item
from supplier.models import Supplier


class PurchaseOrder(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT       = 'DRAFT',       'Draft'
        SUBMITTED   = 'SUBMITTED',   'Submitted'
        ACCEPTED    = 'ACCEPTED',    'Accepted'
        REJECTED    = 'REJECTED',    'Rejected'
        PARTIALLY   = 'PARTIALLY',   'Partially Received'
        RECEIVED    = 'RECEIVED',    'Fully Received'
        CANCELLED   = 'CANCELLED',   'Cancelled'

    po_number   = models.CharField(max_length=50, unique=True, blank=True)
    supplier    = models.ForeignKey(
        Supplier, on_delete=models.PROTECT, related_name='purchase_orders'
    )
    status      = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    notes       = models.TextField(blank=True)
    created_by  = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True,
        related_name='created_pos'
    )
    supplier_response_note = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if not self.po_number:
            import datetime
            count = PurchaseOrder.objects.count() + 1
            self.po_number = f"PO-{datetime.date.today().strftime('%Y%m')}-{count:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.po_number


class PurchaseOrderLine(TimeStampedModel):
    po           = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name='lines'
    )
    item         = models.ForeignKey(
        Item, on_delete=models.PROTECT, related_name='po_lines'
    )
    quantity_ordered  = models.DecimalField(max_digits=12, decimal_places=4)
    quantity_received = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    unit_price        = models.DecimalField(max_digits=12, decimal_places=4, default=0)

    @property
    def line_total(self):
        return self.quantity_ordered * self.unit_price

    def __str__(self):
        return f"{self.po.po_number} — {self.item.name}"


class POReceipt(TimeStampedModel):
    """
    Records one physical delivery against a PO.
    """
    po          = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name='receipts'
    )
    received_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True
    )
    note        = models.TextField(blank=True)   # general note to supplier

    def __str__(self):
        return f"Receipt for {self.po.po_number} on {self.created}"


class POReceiptLine(TimeStampedModel):
    """
    One item row within a receipt — how many arrived undamaged.
    """
    receipt              = models.ForeignKey(
        POReceipt, on_delete=models.CASCADE, related_name='lines'
    )
    po_line              = models.ForeignKey(
        PurchaseOrderLine, on_delete=models.CASCADE, related_name='receipt_lines'
    )
    quantity_received    = models.DecimalField(max_digits=12, decimal_places=4)
    quantity_damaged     = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    quantity_missing     = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    damage_note          = models.TextField(blank=True)

    @property
    def quantity_good(self):
        return self.quantity_received - self.quantity_damaged