from django.db import models
from model_utils.models import TimeStampedModel
from inventory.models import Item


class Client(TimeStampedModel):
    name         = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=200, blank=True)
    email        = models.EmailField(blank=True)
    phone        = models.CharField(max_length=50, blank=True)
    address      = models.TextField(blank=True)
    is_active    = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class SalesOrder(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT       = 'DRAFT',       'Draft'
        CONFIRMED   = 'CONFIRMED',   'Confirmed'
        APPROVED    = 'APPROVED',    'Approved'
        DISPATCHED  = 'DISPATCHED',  'Dispatched'
        DELIVERED   = 'DELIVERED',   'Delivered'
        CANCELLED   = 'CANCELLED',   'Cancelled'

    so_number   = models.CharField(max_length=50, unique=True, blank=True)
    client      = models.ForeignKey(
        Client, on_delete=models.PROTECT, related_name='sales_orders'
    )
    status      = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    notes       = models.TextField(blank=True)
    created_by  = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True,
        related_name='created_sos'
    )
    client_confirmation_note = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if not self.so_number:
            import datetime
            count = SalesOrder.objects.count() + 1
            self.so_number = f"SO-{datetime.date.today().strftime('%Y%m')}-{count:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.so_number


class SalesOrderLine(TimeStampedModel):
    so           = models.ForeignKey(
        SalesOrder, on_delete=models.CASCADE, related_name='lines'
    )
    item         = models.ForeignKey(
        Item, on_delete=models.PROTECT, related_name='so_lines'
    )
    quantity_requested = models.DecimalField(max_digits=12, decimal_places=4)
    unit_price         = models.DecimalField(max_digits=12, decimal_places=4, default=0)

    @property
    def line_total(self):
        return self.quantity_requested * self.unit_price

    def __str__(self):
        return f"{self.so.so_number} — {self.item.name}"