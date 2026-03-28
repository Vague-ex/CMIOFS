from django.db import models
from django.contrib.auth.models import AbstractUser


class Role(models.Model):
    """
    Defines system roles. Seeded via migration / management command.
    Having roles in a table lets admins view them; permissions remain code-driven.
    """
    name        = models.CharField(max_length=50, unique=True)
    code        = models.CharField(max_length=30, unique=True)   # e.g. SYSTEM_ADMIN
    description = models.TextField(blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class User(AbstractUser):
    class RoleCode(models.TextChoices):
        SYSTEM_ADMIN       = 'SYSTEM_ADMIN',       'System Admin'
        PURCHASING_MANAGER = 'PURCHASING_MANAGER', 'Purchasing Manager'
        WAREHOUSE_STAFF    = 'WAREHOUSE_STAFF',    'Warehouse Staff'

    # Keep the legacy CharField for fast permission checks
    role = models.CharField(
        max_length=30,
        choices=RoleCode.choices,
        default=RoleCode.WAREHOUSE_STAFF,
    )
    # FK to the Role table (nullable so existing rows aren't broken)
    role_ref = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='users',
    )
    email      = models.EmailField(unique=True)
    phone      = models.CharField(max_length=30, blank=True)
    is_deleted = models.BooleanField(default=False)   # soft-delete

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"


class AuditLog(models.Model):
    """
    Immutable record of admin / manager actions on settings & users.
    """
    class Action(models.TextChoices):
        CREATE = 'CREATE', 'Created'
        UPDATE = 'UPDATE', 'Updated'
        DELETE = 'DELETE', 'Deleted'

    performed_by  = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='audit_logs'
    )
    action        = models.CharField(max_length=10, choices=Action.choices)
    resource_type = models.CharField(max_length=50)   # e.g. 'Category', 'UnitOfMeasure', 'User'
    resource_id   = models.IntegerField(null=True, blank=True)
    resource_name = models.CharField(max_length=200, blank=True)
    changes       = models.JSONField(default=dict, blank=True)
    timestamp     = models.DateTimeField(auto_now_add=True)
    ip_address    = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.performed_by} {self.action} {self.resource_type} at {self.timestamp}"