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