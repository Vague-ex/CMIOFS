from rest_framework import serializers
from .models import Client, ClientRequest, SalesOrder, SalesOrderLine


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['created', 'modified']


class ClientRequestSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    linked_client_name = serializers.CharField(source='linked_client.name', read_only=True)

    class Meta:
        model = ClientRequest
        fields = '__all__'
        read_only_fields = [
            'created', 'modified', 'status', 'requested_by',
            'reviewed_by', 'reviewed_at', 'linked_client',
        ]

    def get_requested_by_name(self, obj):
        if obj.requested_by:
            return obj.requested_by.get_full_name() or obj.requested_by.username
        return None

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None


class SOLineSerializer(serializers.ModelSerializer):
    item_name  = serializers.CharField(source='item.name', read_only=True)
    item_sku   = serializers.CharField(source='item.sku', read_only=True)
    item_uom   = serializers.CharField(source='item.uom.abbreviation', read_only=True)
    line_total = serializers.ReadOnlyField()

    class Meta:
        model = SalesOrderLine
        fields = '__all__'


class SalesOrderSerializer(serializers.ModelSerializer):
    lines        = SOLineSerializer(many=True, read_only=True)
    client_name  = serializers.CharField(source='client.name', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    total_value  = serializers.SerializerMethodField()

    class Meta:
        model = SalesOrder
        fields = '__all__'
        read_only_fields = ['so_number', 'created_by']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_total_value(self, obj):
        return sum(l.line_total for l in obj.lines.all())


class SalesOrderWriteSerializer(serializers.ModelSerializer):
    lines = SOLineSerializer(many=True)

    class Meta:
        model = SalesOrder
        fields = ['client', 'notes', 'lines']

    def validate(self, data):
        # Check enough stock for each line
        for line in data.get('lines', []):
            item = line['item']
            qty  = line['quantity_requested']
            if item.current_quantity < qty:
                raise serializers.ValidationError(
                    f"Insufficient stock for {item.name}: "
                    f"available {item.current_quantity}, requested {qty}."
                )
        return data

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        so = SalesOrder.objects.create(**validated_data)
        for line in lines_data:
            SalesOrderLine.objects.create(so=so, **line)
        return so