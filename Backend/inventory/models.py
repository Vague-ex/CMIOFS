from django.db import models
from model_utils.models import TimeStampedModel


class Category(TimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class UnitOfMeasure(TimeStampedModel):
    name = models.CharField(max_length=50, unique=True)
    abbreviation = models.CharField(max_length=10, unique=True)

    def __str__(self):
        return self.abbreviation


class Item(TimeStampedModel):
    sku = models.CharField(max_length=50, unique=True, blank=True)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True)
    uom = models.ForeignKey(UnitOfMeasure, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.TextField(blank=True)
    reorder_point = models.IntegerField(default=0)
    standard_cost = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    current_quantity = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    is_active = models.BooleanField(default=True)

    def generate_sku(self):
        """
        Auto-generate SKU using category prefix + sequential number.
        Format: [CAT]-[NNNNNN]
        Example: GEN-000001, CEM-000042
        Falls back to GEN if no category assigned.
        """
        if self.category and self.category.name:
            # Take first 3 letters of category name, uppercase
            prefix = self.category.name[:3].upper()
        else:
            prefix = 'GEN'

        # Find the highest existing number with this prefix
        existing = Item.objects.filter(
            sku__startswith=f'{prefix}-'
        ).order_by('sku').values_list('sku', flat=True)

        max_num = 0
        for sku in existing:
            try:
                num = int(sku.split('-')[-1])
                if num > max_num:
                    max_num = num
            except (ValueError, IndexError):
                continue

        next_num = max_num + 1
        return f'{prefix}-{next_num:06d}'

    def save(self, *args, **kwargs):
        # Only auto-generate SKU on creation if none provided
        if not self.pk and not self.sku:
            self.sku = self.generate_sku()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.sku} — {self.name}'