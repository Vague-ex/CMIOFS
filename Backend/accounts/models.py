from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    class Role(models.TextChoices):
        SYSTEM_ADMIN       = 'SYSTEM_ADMIN',       'System Admin'
        PURCHASING_MANAGER = 'PURCHASING_MANAGER', 'Purchasing Manager'
        WAREHOUSE_STAFF    = 'WAREHOUSE_STAFF',    'Warehouse Staff'

    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.WAREHOUSE_STAFF,
    )
    email = models.EmailField(unique=True)

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"