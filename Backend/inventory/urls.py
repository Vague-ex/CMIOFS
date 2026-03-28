from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ItemViewSet, CategoryViewSet, UnitOfMeasureViewSet,
    UnitConversionViewSet, ProjectViewSet,
    ProjectMaterialViewSet, InventoryTransactionViewSet
)

router = DefaultRouter()
router.register(r'items',           ItemViewSet)
router.register(r'categories',      CategoryViewSet)
router.register(r'uom',             UnitOfMeasureViewSet)
router.register(r'uom-conversions', UnitConversionViewSet)
router.register(r'projects',        ProjectViewSet)
router.register(r'project-materials', ProjectMaterialViewSet)
router.register(r'inventory/transactions', InventoryTransactionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]