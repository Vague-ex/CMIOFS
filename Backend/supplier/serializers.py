from rest_framework import serializers
from .models import Supplier, SupplierRequest


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ['created', 'modified']


class SupplierRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    linked_supplier_name = serializers.CharField(source='linked_supplier.name', read_only=True)

    class Meta:
        model = SupplierRequest
        fields = '__all__'
        read_only_fields = [
            'created', 'modified', 'status', 'requested_by',
            'reviewed_by', 'reviewed_at', 'linked_supplier',
        ]

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return None

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None