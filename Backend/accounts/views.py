from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import User, Role, AuditLog
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    RoleSerializer, AuditLogSerializer,
)
from .permissions import IsSystemAdmin, IsAdminOrManager


def _get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _audit(request, action, resource_type, resource_id, resource_name, changes=None):
    AuditLog.objects.create(
        performed_by=request.user if request.user.is_authenticated else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        resource_name=resource_name,
        changes=changes or {},
        ip_address=_get_client_ip(request),
    )


class RoleViewSet(viewsets.ReadOnlyModelViewSet):
    """Roles are managed by code; admins can view them."""
    queryset = Role.objects.filter(is_active=True)
    serializer_class = RoleSerializer
    permission_classes = [IsSystemAdmin]


class UserViewSet(viewsets.ModelViewSet):
    """
    Admin: full CRUD on all users.
    Manager: read all + create/edit WAREHOUSE_STAFF only.
    """
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['role', 'is_active']
    search_fields    = ['username', 'email', 'first_name', 'last_name']
    ordering_fields  = ['date_joined', 'last_name', 'role']

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.filter(is_deleted=False).exclude(pk=user.pk)
        if user.role == User.RoleCode.PURCHASING_MANAGER:
            # Managers only see staff-level accounts
            qs = qs.filter(role=User.RoleCode.WAREHOUSE_STAFF)
        return qs.select_related('role_ref').order_by('-date_joined')

    def get_permissions(self):
        if self.action in ['destroy', 'change_role']:
            return [IsSystemAdmin()]
        return [IsAdminOrManager()]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        _audit(request, AuditLog.Action.CREATE, 'User', user.pk,
               user.username, {'role': user.role})
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        old_data = {'role': instance.role, 'is_active': instance.is_active}
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        new_data = {'role': user.role, 'is_active': user.is_active}
        _audit(request, AuditLog.Action.UPDATE, 'User', user.pk,
               user.username, {'before': old_data, 'after': new_data})
        return Response(UserSerializer(user).data)

    def destroy(self, request, *args, **kwargs):
        """Soft-delete only."""
        instance = self.get_object()
        instance.is_deleted = True
        instance.is_active  = False
        instance.save()
        _audit(request, AuditLog.Action.DELETE, 'User',
               instance.pk, instance.username)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['patch'], url_path='change-role',
            permission_classes=[IsSystemAdmin])
    def change_role(self, request, pk=None):
        """Admin-only endpoint to change a user's role."""
        user = self.get_object()
        new_role = request.data.get('role')
        if new_role not in User.RoleCode.values:
            return Response(
                {'error': f'Invalid role. Choose from {User.RoleCode.values}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        old_role = user.role
        user.role = new_role
        try:
            user.role_ref = Role.objects.get(code=new_role)
        except Role.DoesNotExist:
            pass
        user.save()
        _audit(request, AuditLog.Action.UPDATE, 'User', user.pk,
               user.username, {'role_before': old_role, 'role_after': new_role})
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=['post'], url_path='reset-password',
            permission_classes=[IsSystemAdmin])
    def reset_password(self, request, pk=None):
        """Admin can set a new password for any user."""
        user = self.get_object()
        password = request.data.get('password', '')
        if len(password) < 10:
            return Response(
                {'error': 'Password must be at least 10 characters.'},
                status=400
            )
        user.set_password(password)
        user.save()
        _audit(request, AuditLog.Action.UPDATE, 'User', user.pk,
               user.username, {'action': 'password_reset'})
        return Response({'detail': 'Password updated.'})


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('performed_by').all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsSystemAdmin]
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['action', 'resource_type', 'performed_by']
    search_fields    = ['resource_name', 'performed_by__username']