from rest_framework import serializers
from .models import User, Role, AuditLog


class RoleSerializer(serializers.ModelSerializer):
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = '__all__'
        read_only_fields = ['created_at']

    def get_user_count(self, obj):
        return obj.users.filter(is_deleted=False, is_active=True).count()


class UserSerializer(serializers.ModelSerializer):
    full_name    = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    role_ref_name = serializers.CharField(source='role_ref.name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'full_name', 'phone', 'role', 'role_display',
            'role_ref', 'role_ref_name',
            'is_active', 'date_joined', 'last_login',
        ]
        read_only_fields = ['date_joined', 'last_login']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserCreateSerializer(serializers.ModelSerializer):
    """Used when an admin/manager creates a new user account."""
    password = serializers.CharField(write_only=True, min_length=10)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'phone', 'role', 'password',
        ]

    def validate_role(self, value):
        request = self.context.get('request')
        if not request:
            return value
        requester = request.user
        # Managers can only create WAREHOUSE_STAFF
        if requester.role == User.RoleCode.PURCHASING_MANAGER:
            if value != User.RoleCode.WAREHOUSE_STAFF:
                raise serializers.ValidationError(
                    'Managers can only create Warehouse Staff accounts.'
                )
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        # Sync role_ref FK
        try:
            user.role_ref = Role.objects.get(code=validated_data.get('role'))
        except Role.DoesNotExist:
            pass
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Used for editing an existing user — no password change here."""
    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name',
            'phone', 'role', 'is_active',
        ]

    def validate_role(self, value):
        request = self.context.get('request')
        if not request:
            return value
        requester = request.user
        if requester.role == User.RoleCode.PURCHASING_MANAGER:
            if value != User.RoleCode.WAREHOUSE_STAFF:
                raise serializers.ValidationError(
                    'Managers can only assign Warehouse Staff role.'
                )
        return value

    def update(self, instance, validated_data):
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        # Sync role_ref FK
        if 'role' in validated_data:
            try:
                instance.role_ref = Role.objects.get(code=validated_data['role'])
            except Role.DoesNotExist:
                pass
        instance.save()
        return instance


class AuditLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = '__all__'

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return obj.performed_by.get_full_name() or obj.performed_by.username
        return 'System'