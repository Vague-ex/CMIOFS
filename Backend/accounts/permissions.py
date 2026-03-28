from rest_framework.permissions import BasePermission
from .models import User


class IsSystemAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and (
                request.user.is_superuser
                or request.user.role == User.RoleCode.SYSTEM_ADMIN
            )
        )


class IsAdminOrManager(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and (
                request.user.is_superuser
                or request.user.role in (
                    User.RoleCode.SYSTEM_ADMIN,
                    User.RoleCode.PURCHASING_MANAGER,
                )
            )
        )