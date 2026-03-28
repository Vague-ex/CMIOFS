from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    Item, Category, UnitOfMeasure, UnitConversion,
    MaterialSpec, Project, ProjectMaterial, InventoryTransaction
)
from .serializers import (
    ItemSerializer, ItemWriteSerializer,
    CategorySerializer, UnitOfMeasureSerializer, UnitConversionSerializer,
    MaterialSpecSerializer, ProjectSerializer,
    ProjectMaterialSerializer, InventoryTransactionSerializer
)


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.filter(is_active=True).select_related(
        'category', 'uom', 'material_spec'
    ).order_by('-created')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields   = ['name', 'sku', 'description']
    filterset_fields = ['category', 'uom']
    ordering_fields = ['name', 'sku', 'current_quantity']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ItemWriteSerializer
        return ItemSerializer

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        item.is_active = False
        item.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='preview-sku')
    def preview_sku(self, request):
        category_id = request.query_params.get('category_id')
        temp = Item()
        if category_id:
            try:
                temp.category = Category.objects.get(pk=category_id)
            except Category.DoesNotExist:
                pass
        return Response({'sku': temp.generate_sku()})

    @action(detail=True, methods=['post'], url_path='stock-in')
    def stock_in(self, request, pk=None):
        item = self.get_object()
        quantity   = request.data.get('quantity')
        reason     = request.data.get('reason', 'MANUAL_IN')
        note       = request.data.get('note', '')
        project_id = request.data.get('project_id')

        if not quantity or float(quantity) <= 0:
            return Response(
                {'error': 'Quantity must be a positive number.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            project = None
            if project_id:
                try:
                    project = Project.objects.get(pk=project_id)
                except Project.DoesNotExist:
                    pass

            InventoryTransaction.objects.create(
                item=item,
                transaction_type=reason,
                quantity_change=quantity,
                project=project,
                performed_by=request.user,
                reason_note=note,
            )
            item.current_quantity += float(quantity)
            item.save()

        return Response(ItemSerializer(item).data)

    @action(detail=True, methods=['get'], url_path='convert')
    def convert(self, request, pk=None):
        """
        Convert item quantity to another UOM.
        ?quantity=100&to_uom_id=3
        """
        item     = self.get_object()
        qty      = float(request.query_params.get('quantity', 0))
        to_uom_id = request.query_params.get('to_uom_id')

        if not to_uom_id:
            return Response({'error': 'to_uom_id is required.'}, status=400)

        try:
            to_uom  = UnitOfMeasure.objects.get(pk=to_uom_id)
            result  = item.convert_quantity(qty, to_uom)
            return Response({
                'original_quantity': qty,
                'original_uom': item.uom.abbreviation if item.uom else None,
                'converted_quantity': float(result),
                'converted_uom': to_uom.abbreviation,
            })
        except UnitOfMeasure.DoesNotExist:
            return Response({'error': 'UOM not found.'}, status=404)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class UnitOfMeasureViewSet(viewsets.ModelViewSet):
    queryset = UnitOfMeasure.objects.all().order_by('unit_type', 'name')
    serializer_class = UnitOfMeasureSerializer
    filterset_fields = ['unit_type']


class UnitConversionViewSet(viewsets.ModelViewSet):
    queryset = UnitConversion.objects.select_related('from_unit', 'to_unit').all()
    serializer_class = UnitConversionSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all().order_by('-created')
    serializer_class = ProjectSerializer
    filter_backends  = [filters.SearchFilter, DjangoFilterBackend]
    search_fields    = ['name', 'project_code', 'client']
    filterset_fields = ['status']


class ProjectMaterialViewSet(viewsets.ModelViewSet):
    queryset = ProjectMaterial.objects.select_related(
        'project', 'item', 'item__uom', 'display_uom'
    ).all().order_by('-created')
    serializer_class = ProjectMaterialSerializer
    filterset_fields = ['project', 'item', 'status']

    @action(detail=True, methods=['post'], url_path='deliver')
    def deliver(self, request, pk=None):
        """
        Record a partial or full delivery of this project material.
        Deducts from item stock and updates delivered_quantity.
        """
        pm       = self.get_object()
        quantity = float(request.data.get('quantity', 0))

        if quantity <= 0:
            return Response({'error': 'Quantity must be positive.'}, status=400)
        if quantity > float(pm.remaining_quantity):
            return Response(
                {'error': f'Cannot deliver more than remaining quantity ({pm.remaining_quantity}).'},
                status=400
            )

        with transaction.atomic():
            InventoryTransaction.objects.create(
                item=pm.item,
                transaction_type=InventoryTransaction.TransactionType.PROJECT_ISSUE,
                quantity_change=-quantity,
                project=pm.project,
                performed_by=request.user,
                reason_note=f'Issued to project {pm.project.project_code}',
            )
            pm.item.current_quantity -= quantity
            pm.item.save()

            pm.delivered_quantity += quantity
            if pm.delivered_quantity >= pm.allocated_quantity:
                pm.status = ProjectMaterial.Status.DELIVERED
            else:
                pm.status = ProjectMaterial.Status.PARTIAL
            pm.save()

        return Response(ProjectMaterialSerializer(pm).data)


class InventoryTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InventoryTransaction.objects.select_related(
        'item', 'performed_by', 'project'
    ).all()
    serializer_class = InventoryTransactionSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['item', 'transaction_type', 'project']
    search_fields    = ['item__name', 'item__sku', 'reason_note']