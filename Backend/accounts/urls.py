from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, RoleViewSet, AuditLogViewSet

router = DefaultRouter()
router.register(r'users',      UserViewSet,     basename='user')
router.register(r'roles',      RoleViewSet,     basename='role')
router.register(r'audit-logs', AuditLogViewSet, basename='auditlog')

urlpatterns = [
    path('', include(router.urls)),
]