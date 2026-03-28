from django.utils import timezone
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from accounts.permissions import IsAdminOrManager, IsSystemAdmin
from .models import Supplier, SupplierRequest
from .serializers import SupplierSerializer, SupplierRequestSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.filter(is_active=True).order_by('name')
    serializer_class = SupplierSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'contact_name', 'email']


class SupplierRequestViewSet(viewsets.ModelViewSet):
    queryset = SupplierRequest.objects.select_related(
        'requested_by', 'reviewed_by', 'linked_supplier'
    ).order_by('-created')
    serializer_class = SupplierRequestSerializer
    permission_classes = [IsAdminOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status']
    search_fields = ['name', 'contact_name', 'email']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        is_admin = user.is_superuser or user.role == 'SYSTEM_ADMIN'
        if not is_admin:
            qs = qs.filter(requested_by=user)
        return qs

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsSystemAdmin])
    def approve(self, request, pk=None):
        req = self.get_object()
        if req.status != SupplierRequest.Status.PENDING:
            return Response({'error': 'Only pending requests can be approved.'}, status=400)

        supplier = Supplier.objects.create(
            name=req.name,
            contact_name=req.contact_name,
            email=req.email,
            phone=req.phone,
            address=req.address,
            is_active=True,
        )
        req.status = SupplierRequest.Status.APPROVED
        req.review_note = request.data.get('review_note', '')
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.linked_supplier = supplier
        req.save()

        return Response(self.get_serializer(req).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsSystemAdmin])
    def reject(self, request, pk=None):
        req = self.get_object()
        if req.status != SupplierRequest.Status.PENDING:
            return Response({'error': 'Only pending requests can be rejected.'}, status=400)

        req.status = SupplierRequest.Status.REJECTED
        req.review_note = request.data.get('review_note', '')
        req.reviewed_by = request.user
        req.reviewed_at = timezone.now()
        req.save()

        return Response(self.get_serializer(req).data, status=status.HTTP_200_OK)