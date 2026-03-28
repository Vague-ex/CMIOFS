from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SupplierViewSet, SupplierRequestViewSet

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet)
router.register(r'supplier-requests', SupplierRequestViewSet, basename='supplier-request')

urlpatterns = [path('', include(router.urls))]