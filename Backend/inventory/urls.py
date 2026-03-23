from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ItemViewSet, CategoryViewSet, UnitOfMeasureViewSet

router = DefaultRouter()
router.register(r'items', ItemViewSet)
router.register(r'categories', CategoryViewSet)
router.register(r'uom', UnitOfMeasureViewSet)

urlpatterns = [
    path('', include(router.urls)),
]