from django.db import models
from model_utils.models import TimeStampedModel


# reference tables 
class Category(TimeStampedModel):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class UnitOfMeasure(TimeStampedModel):
    class UnitType(models.TextChoices):
        WEIGHT  = 'WEIGHT',  'Weight'
        VOLUME  = 'VOLUME',  'Volume'
        LENGTH  = 'LENGTH',  'Length'
        AREA    = 'AREA',    'Area'
        COUNT   = 'COUNT',   'Count'
        OTHER   = 'OTHER',   'Other'

    name         = models.CharField(max_length=50, unique=True)
    abbreviation = models.CharField(max_length=10, unique=True)
    unit_type    = models.CharField(
        max_length=10,
        choices=UnitType.choices,
        default=UnitType.COUNT,
    )

    def __str__(self):
        return f'{self.abbreviation} ({self.get_unit_type_display()})'


class UnitConversion(TimeStampedModel):
    """
    Defines a conversion rate between two UOMs of the same type.
    e.g. from_unit=kg, to_unit=ton, factor=0.001
    meaning 1 kg = 0.001 tons
    Conversions are bidirectional — only define one direction.
    """
    from_unit = models.ForeignKey(
        UnitOfMeasure, on_delete=models.CASCADE, related_name='conversions_from'
    )
    to_unit   = models.ForeignKey(
        UnitOfMeasure, on_delete=models.CASCADE, related_name='conversions_to'
    )
    factor    = models.DecimalField(
        max_digits=20, decimal_places=10,
        help_text='Multiply from_unit quantity by this to get to_unit quantity.'
    )

    class Meta:
        unique_together = ('from_unit', 'to_unit')

    def __str__(self):
        return f'1 {self.from_unit.abbreviation} = {self.factor} {self.to_unit.abbreviation}'


# Material Spec
class MaterialSpec(TimeStampedModel):
    """
    Stores construction-specific technical attributes for an item.
    All fields are optional — only fill what's relevant per material type.
    """
    # Grade / classification
    grade           = models.CharField(max_length=100, blank=True,
                        help_text='e.g. Grade 60, S275, C25/30, F17')
    standard        = models.CharField(max_length=100, blank=True,
                        help_text='e.g. ASTM A615, BS 4449, NSCP 2015')
    certification   = models.CharField(max_length=200, blank=True,
                        help_text='e.g. ISO 9001, PNS certified, mill cert required')

    # Strength / mix
    compressive_strength = models.CharField(max_length=50, blank=True,
                            help_text='e.g. 3000 psi, 20 MPa')
    yield_strength       = models.CharField(max_length=50, blank=True,
                            help_text='e.g. 60,000 psi, 415 MPa')
    mix_ratio            = models.CharField(max_length=100, blank=True,
                            help_text='e.g. 1:2:4, 1:1.5:3 (cement:sand:gravel)')

    # Dimensions
    diameter    = models.DecimalField(max_digits=10, decimal_places=3,
                    null=True, blank=True, help_text='mm')
    length      = models.DecimalField(max_digits=10, decimal_places=3,
                    null=True, blank=True, help_text='mm or m depending on item')
    width       = models.DecimalField(max_digits=10, decimal_places=3,
                    null=True, blank=True, help_text='mm')
    thickness   = models.DecimalField(max_digits=10, decimal_places=3,
                    null=True, blank=True, help_text='mm')
    weight_per_unit = models.DecimalField(max_digits=10, decimal_places=4,
                        null=True, blank=True, help_text='kg per piece/unit')

    # Material properties
    material_type = models.CharField(max_length=100, blank=True,
                      help_text='e.g. deformed bar, plain bar, OPC, PPC, softwood, hardwood')
    finish        = models.CharField(max_length=100, blank=True,
                      help_text='e.g. galvanized, painted, rough-sawn, dressed')
    color         = models.CharField(max_length=50, blank=True)

    # Notes
    notes = models.TextField(blank=True,
              help_text='Any additional technical notes or special handling instructions')

    def __str__(self):
        parts = [self.grade, self.material_type, self.standard]
        return ' | '.join(p for p in parts if p) or 'No spec'


# Project / Site

class Project(TimeStampedModel):
    class Status(models.TextChoices):
        PLANNING    = 'PLANNING',    'Planning'
        ACTIVE      = 'ACTIVE',      'Active'
        ON_HOLD     = 'ON_HOLD',     'On Hold'
        COMPLETED   = 'COMPLETED',   'Completed'
        CANCELLED   = 'CANCELLED',   'Cancelled'

    name         = models.CharField(max_length=200)
    project_code = models.CharField(max_length=50, unique=True)
    client       = models.CharField(max_length=200, blank=True)
    location     = models.TextField(blank=True)
    status       = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    start_date   = models.DateField(null=True, blank=True)
    end_date     = models.DateField(null=True, blank=True)
    description  = models.TextField(blank=True)

    def __str__(self):
        return f'{self.project_code} — {self.name}'


# Inventory Item
class Item(TimeStampedModel):
    sku           = models.CharField(max_length=50, unique=True, blank=True)
    name          = models.CharField(max_length=200)
    category      = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True
    )
    uom           = models.ForeignKey(
        UnitOfMeasure, on_delete=models.SET_NULL, null=True, blank=True
    )
    material_spec = models.OneToOneField(
        MaterialSpec, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='item'
    )
    description      = models.TextField(blank=True)
    reorder_point    = models.IntegerField(default=0)
    standard_cost    = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    current_quantity = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    is_active        = models.BooleanField(default=True)

    def generate_sku(self):
        if self.category and self.category.name:
            prefix = self.category.name[:3].upper()
        else:
            prefix = 'GEN'

        existing = Item.objects.filter(
            sku__startswith=f'{prefix}-'
        ).values_list('sku', flat=True)

        max_num = 0
        for sku in existing:
            try:
                num = int(sku.split('-')[-1])
                if num > max_num:
                    max_num = num
            except (ValueError, IndexError):
                continue

        return f'{prefix}-{max_num + 1:06d}'

    def save(self, *args, **kwargs):
        if not self.pk and not self.sku:
            self.sku = self.generate_sku()
        super().save(*args, **kwargs)

    def convert_quantity(self, quantity, to_uom):
        """
        Convert a quantity from this item's UOM to another UOM.
        Raises ValueError if no conversion path exists.
        """
        if not self.uom or self.uom == to_uom:
            return quantity
        try:
            conv = UnitConversion.objects.get(from_unit=self.uom, to_unit=to_uom)
            return quantity * conv.factor
        except UnitConversion.DoesNotExist:
            pass
        try:
            conv = UnitConversion.objects.get(from_unit=to_uom, to_unit=self.uom)
            return quantity / conv.factor
        except UnitConversion.DoesNotExist:
            raise ValueError(
                f'No conversion defined between '
                f'{self.uom.abbreviation} and {to_uom.abbreviation}'
            )

    def __str__(self):
        return f'{self.sku} — {self.name}'


# Project Material Allocation 
class ProjectMaterial(TimeStampedModel):
    """
    Ties an inventory item to a specific project.
    Tracks how much is allocated, delivered, and remaining.
    """
    class Status(models.TextChoices):
        REQUESTED  = 'REQUESTED',  'Requested'
        APPROVED   = 'APPROVED',   'Approved'
        PARTIAL    = 'PARTIAL',    'Partially Delivered'
        DELIVERED  = 'DELIVERED',  'Fully Delivered'
        CANCELLED  = 'CANCELLED',  'Cancelled'

    project           = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name='materials'
    )
    item              = models.ForeignKey(
        Item, on_delete=models.PROTECT, related_name='project_allocations'
    )
    allocated_quantity = models.DecimalField(max_digits=12, decimal_places=4)
    delivered_quantity = models.DecimalField(max_digits=12, decimal_places=4, default=0)
    display_uom        = models.ForeignKey(
        UnitOfMeasure, on_delete=models.SET_NULL,
        null=True, blank=True,
        help_text='UOM to display quantities in for this project (can differ from item UOM)'
    )
    status        = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.REQUESTED,
    )
    needed_by     = models.DateField(null=True, blank=True)
    notes         = models.TextField(blank=True)

    @property
    def remaining_quantity(self):
        return self.allocated_quantity - self.delivered_quantity

    @property
    def allocated_in_display_uom(self):
        if self.display_uom and self.display_uom != self.item.uom:
            try:
                return self.item.convert_quantity(self.allocated_quantity, self.display_uom)
            except ValueError:
                return self.allocated_quantity
        return self.allocated_quantity

    def __str__(self):
        return f'{self.project.project_code} — {self.item.name}'


# Inventory Transaction Ledger
class InventoryTransaction(TimeStampedModel):
    class TransactionType(models.TextChoices):
        MANUAL_IN     = 'MANUAL_IN',     'Manual Stock In'
        INITIAL_STOCK = 'INITIAL_STOCK', 'Initial Stock'
        PO_RECEIPT    = 'PO_RECEIPT',    'Purchase Order Receipt'
        DO_DISPATCH   = 'DO_DISPATCH',   'Delivery Order Dispatch'
        ADJUSTMENT    = 'ADJUSTMENT',    'Stock Adjustment'
        RETURN        = 'RETURN',        'Return to Stock'
        PROJECT_ISSUE = 'PROJECT_ISSUE', 'Issued to Project'

    item             = models.ForeignKey(
        Item, on_delete=models.PROTECT, related_name='transactions'
    )
    transaction_type = models.CharField(
        max_length=20, choices=TransactionType.choices
    )
    quantity_change  = models.DecimalField(
        max_digits=12, decimal_places=4,
        help_text='Positive = stock in, Negative = stock out'
    )
    project          = models.ForeignKey(
        Project, on_delete=models.SET_NULL,
        null=True, blank=True,
        help_text='Project this transaction is tied to, if any'
    )
    reference_id     = models.IntegerField(null=True, blank=True)
    reference_type   = models.CharField(max_length=50, blank=True)
    performed_by     = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True
    )
    reason_note      = models.TextField(blank=True)

    class Meta:
        ordering = ['-created']

    def __str__(self):
        return (
            f'{self.transaction_type} | {self.item.sku} | '
            f'{self.quantity_change:+} | {self.created}'
        )