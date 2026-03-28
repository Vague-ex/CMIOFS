from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, SalesOrderViewSet, ClientRequestViewSet

router = DefaultRouter()
router.register(r'clients', ClientViewSet)
router.register(r'client-requests', ClientRequestViewSet, basename='client-request')
router.register(r'sales-orders', SalesOrderViewSet)

urlpatterns = [path('', include(router.urls))]