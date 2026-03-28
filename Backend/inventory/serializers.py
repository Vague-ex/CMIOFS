from rest_framework import serializers
from .models import (
    Item, Category, UnitOfMeasure, UnitConversion,
    MaterialSpec, Project, ProjectMaterial, InventoryTransaction
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class UnitOfMeasureSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitOfMeasure
        fields = '__all__'


class UnitConversionSerializer(serializers.ModelSerializer):
    from_unit_display = serializers.CharField(
        source='from_unit.abbreviation', read_only=True
    )
    to_unit_display = serializers.CharField(
        source='to_unit.abbreviation', read_only=True
    )

    class Meta:
        model = UnitConversion
        fields = '__all__'


class MaterialSpecSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialSpec
        fields = '__all__'


class ItemSerializer(serializers.ModelSerializer):
    category_name    = serializers.CharField(source='category.name', read_only=True)
    uom_abbreviation = serializers.CharField(source='uom.abbreviation', read_only=True)
    uom_type         = serializers.CharField(source='uom.unit_type', read_only=True)
    material_spec    = MaterialSpecSerializer(read_only=True)

    class Meta:
        model = Item
        fields = '__all__'
        read_only_fields = ['current_quantity', 'created', 'modified']
        extra_kwargs = {
            'sku': {'required': False, 'allow_blank': True},
        }

    def validate_sku(self, value):
        if not value:
            return value
        instance = getattr(self, 'instance', None)
        qs = Item.objects.filter(sku=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError('An item with this SKU already exists.')
        return value


class ItemWriteSerializer(serializers.ModelSerializer):
    """
    Used for create/update. Accepts nested material_spec data.
    """
    material_spec_data = MaterialSpecSerializer(required=False, write_only=True)

    class Meta:
        model = Item
        fields = '__all__'
        read_only_fields = ['current_quantity', 'created', 'modified']
        extra_kwargs = {
            'sku': {'required': False, 'allow_blank': True},
            'material_spec': {'read_only': True},
        }

    def validate_sku(self, value):
        if not value:
            return value
        instance = getattr(self, 'instance', None)
        qs = Item.objects.filter(sku=value)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError('An item with this SKU already exists.')
        return value

    def create(self, validated_data):
        spec_data = validated_data.pop('material_spec_data', None)
        item = Item.objects.create(**validated_data)
        if spec_data:
            spec = MaterialSpec.objects.create(**spec_data)
            item.material_spec = spec
            item.save()
        return item

    def update(self, instance, validated_data):
        spec_data = validated_data.pop('material_spec_data', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if spec_data is not None:
            if instance.material_spec:
                for attr, value in spec_data.items():
                    setattr(instance.material_spec, attr, value)
                instance.material_spec.save()
            else:
                spec = MaterialSpec.objects.create(**spec_data)
                instance.material_spec = spec
                instance.save()
        return instance


class ProjectSerializer(serializers.ModelSerializer):
    material_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = '__all__'

    def get_material_count(self, obj):
        return obj.materials.exclude(status='CANCELLED').count()


class ProjectMaterialSerializer(serializers.ModelSerializer):
    item_name        = serializers.CharField(source='item.name', read_only=True)
    item_sku         = serializers.CharField(source='item.sku', read_only=True)
    item_uom         = serializers.CharField(source='item.uom.abbreviation', read_only=True)
    display_uom_name = serializers.CharField(
        source='display_uom.abbreviation', read_only=True
    )
    remaining_quantity       = serializers.ReadOnlyField()
    allocated_in_display_uom = serializers.ReadOnlyField()
    project_name             = serializers.CharField(source='project.name', read_only=True)
    project_code             = serializers.CharField(source='project.project_code', read_only=True)

    class Meta:
        model = ProjectMaterial
        fields = '__all__'


class InventoryTransactionSerializer(serializers.ModelSerializer):
    item_name      = serializers.CharField(source='item.name', read_only=True)
    item_sku       = serializers.CharField(source='item.sku', read_only=True)
    performed_by_name = serializers.SerializerMethodField()
    project_name   = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = InventoryTransaction
        fields = '__all__'
        read_only_fields = ['created', 'modified']

    def get_performed_by_name(self, obj):
        if obj.performed_by:
            return obj.performed_by.get_full_name() or obj.performed_by.username
        return None