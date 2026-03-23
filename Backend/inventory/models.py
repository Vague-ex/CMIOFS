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

    def save(self, *args, **kwargs):
        if not self.sku:
            # Auto-generate SKU if not provided
            last = Item.objects.order_by('id').last()
            next_id = (last.id + 1) if last else 1
            self.sku = f'SKU-{next_id:05d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.sku} — {self.name}'