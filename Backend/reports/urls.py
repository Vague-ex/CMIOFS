from django.urls import path
from .views import (
    # Inventory
    InventoryStockLevelView,
    InventoryLowStockView,
    InventoryStockMovementView,
    InventoryProjectAllocationView,
    # Supplier
    SupplierPOHistoryView,
    SupplierSpendView,
    SupplierLeadTimeView,
    SupplierPerformanceView,
    # Client
    ClientSOHistoryView,
    ClientRevenueView,
    ClientMaterialUsageView,
    ClientOutstandingOrdersView,
    # User activity
    UserActivityPOView,
    UserRoleChangesView,
    UserAccountActivityView,
    AuditLogReportView,
)

urlpatterns = [
    # -- Inventory --
    path('reports/inventory/stock-levels/', InventoryStockLevelView.as_view(), name='report-stock-levels'),
    path('reports/inventory/low-stock/', InventoryLowStockView.as_view(), name='report-low-stock'),
    path('reports/inventory/stock-movement/', InventoryStockMovementView.as_view(), name='report-stock-movement'),
    path('reports/inventory/project-allocation/', InventoryProjectAllocationView.as_view(), name='report-project-allocation'),

    # -- Supplier --
    path('reports/suppliers/po-history/', SupplierPOHistoryView.as_view(), name='report-supplier-po-history'),
    path('reports/suppliers/spend/', SupplierSpendView.as_view(), name='report-supplier-spend'),
    path('reports/suppliers/lead-times/', SupplierLeadTimeView.as_view(), name='report-supplier-lead-times'),
    path('reports/suppliers/performance/', SupplierPerformanceView.as_view(), name='report-supplier-performance'),

    # -- Client --
    path('reports/clients/so-history/', ClientSOHistoryView.as_view(), name='report-client-so-history'),
    path('reports/clients/revenue/', ClientRevenueView.as_view(), name='report-client-revenue'),
    path('reports/clients/material-usage/', ClientMaterialUsageView.as_view(), name='report-client-material-usage'),
    path('reports/clients/outstanding-orders/', ClientOutstandingOrdersView.as_view(), name='report-client-outstanding'),

    # -- User activity (admin only) --
    path('reports/users/po-activity/', UserActivityPOView.as_view(), name='report-user-po-activity'),
    path('reports/users/role-changes/', UserRoleChangesView.as_view(), name='report-user-role-changes'),
    path('reports/users/account-activity/', UserAccountActivityView.as_view(), name='report-user-account-activity'),
    path('reports/users/audit-log/', AuditLogReportView.as_view(), name='report-audit-log'),
]