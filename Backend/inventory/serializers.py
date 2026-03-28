from rest_framework import serializers
from .models import Item, Category, UnitOfMeasure


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = '__all__'


class ItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source='category.name', read_only=True
    )
    uom_abbreviation = serializers.CharField(
        source='uom.abbreviation', read_only=True
    )

    class Meta:
        model = Item
        fields = '__all__'
        read_only_fields = ['current_quantity', 'created', 'modified']
        extra_kwargs = {
            # SKU is optional — if blank, backend auto-generates
            'sku': {'required': False, 'allow_blank': True},
        }

    def validate_sku(self, value):
        """Allow blank SKU (will be auto-generated) or validate uniqueness on update."""
        if not value:
            return value
        # On update, exclude self from uniqueness check
        instance = getattr(self, 'instance', None)
        qs = Item.objects.filter(sku=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError('An item with this SKU already exists.')
        return value