from django.db import models
from model_utils.models import TimeStampedModel

class Supplier(TimeStampedModel):
    name         = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=200, blank=True)
    email        = models.EmailField(blank=True)
    phone        = models.CharField(max_length=50, blank=True)
    address      = models.TextField(blank=True)
    is_active    = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class SupplierRequest(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    name = models.CharField(max_length=200)
    contact_name = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address = models.TextField(blank=True)
    justification = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    requested_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='supplier_requests',
    )
    reviewed_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_supplier_requests',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)
    linked_supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requests',
    )

    def __str__(self):
        return f"{self.name} ({self.status})"