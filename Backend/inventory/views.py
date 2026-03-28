from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import Item, Category, UnitOfMeasure
from .serializers import ItemSerializer, CategorySerializer, UnitOfMeasureSerializer


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.filter(is_active=True).order_by('-created')
    serializer_class = ItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'sku', 'description']
    ordering_fields = ['name', 'sku', 'current_quantity']

    def destroy(self, request, *args, **kwargs):
        # Soft delete — set is_active=False instead of deleting
        item = self.get_object()
        item.is_active = False
        item.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='preview-sku')
    def preview_sku(self, request):
        """
        Returns a preview of the auto-generated SKU.
        Pass ?category_id=X to get category-specific preview.
        """
        category_id = request.query_params.get('category_id')
        temp_item = Item()
        if category_id:
            try:
                temp_item.category = Category.objects.get(pk=category_id)
            except Category.DoesNotExist:
                pass
        return Response({'sku': temp_item.generate_sku()})


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class UnitOfMeasureViewSet(viewsets.ModelViewSet):
    queryset = UnitOfMeasure.objects.all()
    serializer_class = UnitOfMeasureSerializer