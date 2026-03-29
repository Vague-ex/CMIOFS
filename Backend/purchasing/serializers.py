from rest_framework import serializers
from .models import PurchaseOrder, PurchaseOrderLine, POReceipt, POReceiptLine


class POLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_sku  = serializers.CharField(source='item.sku', read_only=True)
    item_uom  = serializers.CharField(source='item.uom.abbreviation', read_only=True)
    line_total = serializers.ReadOnlyField()

    class Meta:
        model = PurchaseOrderLine
        fields = '__all__'
        read_only_fields = ['quantity_received', 'po']


class POLineWriteSerializer(serializers.ModelSerializer):
    """Used for creating/updating PO lines - po field is set by the parent."""
    class Meta:
        model = PurchaseOrderLine
        fields = ['item', 'quantity_ordered', 'unit_price']


class POReceiptLineSerializer(serializers.ModelSerializer):
    item_name    = serializers.CharField(source='po_line.item.name', read_only=True)
    quantity_good = serializers.ReadOnlyField()

    class Meta:
        model = POReceiptLine
        fields = '__all__'


class POReceiptSerializer(serializers.ModelSerializer):
    lines = POReceiptLineSerializer(many=True, read_only=True)
    received_by_name = serializers.SerializerMethodField()

    class Meta:
        model = POReceipt
        fields = '__all__'
        read_only_fields = ['received_by']

    def get_received_by_name(self, obj):
        if obj.received_by:
            return obj.received_by.get_full_name() or obj.received_by.username
        return None


class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines         = POLineSerializer(many=True, read_only=True)
    receipts      = POReceiptSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    total_value   = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ['po_number', 'created_by']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_total_value(self, obj):
        return sum(l.line_total for l in obj.lines.all())


class PurchaseOrderWriteSerializer(serializers.ModelSerializer):
    lines = POLineWriteSerializer(many=True)

    class Meta:
        model = PurchaseOrder
        fields = ['supplier', 'notes', 'lines']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        po = PurchaseOrder.objects.create(**validated_data)
        for line in lines_data:
            PurchaseOrderLine.objects.create(po=po, **line)
        return po