from django.db.models import (
    Sum, Count, Avg, F, Q, ExpressionWrapper, DurationField, FloatField
)
from django.db.models.functions import TruncMonth, TruncQuarter, Coalesce
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from accounts.models import AuditLog, User
from accounts.permissions import IsSystemAdmin
from inventory.models import Item, Category, UnitOfMeasure, InventoryTransaction, Project, ProjectMaterial
from purchasing.models import PurchaseOrder, POReceipt
from clients.models import SalesOrder, SalesOrderLine, Client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_date_range(request):
    """Return (date_from, date_to) from query params, defaulting to last 90 days."""
    from datetime import datetime
    date_from_str = request.query_params.get("date_from")
    date_to_str = request.query_params.get("date_to")
    try:
        date_from = datetime.strptime(date_from_str, "%Y-%m-%d").date() if date_from_str else (timezone.now() - timedelta(days=90)).date()
        date_to = datetime.strptime(date_to_str, "%Y-%m-%d").date() if date_to_str else timezone.now().date()
    except ValueError:
        date_from = (timezone.now() - timedelta(days=90)).date()
        date_to = timezone.now().date()
    return date_from, date_to


# ===========================================================================
# 1. INVENTORY REPORTS
# ===========================================================================

class InventoryStockLevelView(APIView):
    """Current stock levels grouped by category and UOM."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Per category
        by_category = (
            Item.objects
            .filter(is_active=True)
            .values(category_name=F("category__name"))
            .annotate(
                item_count=Count("id"),
                total_quantity=Sum("current_quantity"),
                total_value=Sum(
                    ExpressionWrapper(F("current_quantity") * F("standard_cost"), output_field=FloatField())
                ),
            )
            .order_by("category_name")
        )

        # Per UOM
        by_uom = (
            Item.objects
            .filter(is_active=True)
            .values(
                uom_name=F("uom__name"),
                uom_abbreviation=F("uom__abbreviation"),
                unit_type=F("uom__unit_type"),
            )
            .annotate(
                item_count=Count("id"),
                total_quantity=Sum("current_quantity"),
            )
            .order_by("uom_name")
        )

        # Summary totals
        summary = Item.objects.filter(is_active=True).aggregate(
            total_items=Count("id"),
            total_stock_value=Coalesce(
                Sum(
                    ExpressionWrapper(F("current_quantity") * F("standard_cost"), output_field=FloatField())
                ),
                0.0,
            ),
            out_of_stock=Count("id", filter=Q(current_quantity__lte=0)),
            low_stock=Count("id", filter=Q(current_quantity__gt=0, current_quantity__lte=F("reorder_point"))),
        )

        return Response({
            "summary": summary,
            "by_category": list(by_category),
            "by_uom": list(by_uom),
        })


class InventoryLowStockView(APIView):
    """Items at or below their reorder point."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        include_zero = request.query_params.get("include_zero", "true") == "true"
        qs = Item.objects.filter(is_active=True, current_quantity__lte=F("reorder_point"))
        if not include_zero:
            qs = qs.filter(current_quantity__gt=0)

        items = qs.select_related("category", "uom").order_by("current_quantity").values(
            "id", "sku", "name", "current_quantity", "reorder_point", "standard_cost",
            category_name=F("category__name"),
            uom_abbreviation=F("uom__abbreviation"),
        )

        result = []
        for item in items:
            shortage = float(item["reorder_point"] or 0) - float(item["current_quantity"] or 0)
            item["shortage"] = max(shortage, 0)
            item["estimated_reorder_cost"] = round(
                shortage * float(item["standard_cost"] or 0), 4
            )
            result.append(item)

        return Response({
            "count": len(result),
            "items": result,
        })


class InventoryStockMovementView(APIView):
    """Inbound vs outbound stock movements over a date range."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)
        item_id = request.query_params.get("item_id")

        qs = InventoryTransaction.objects.filter(
            created__date__gte=date_from,
            created__date__lte=date_to,
        )
        if item_id:
            qs = qs.filter(item_id=item_id)

        # Totals
        inbound = qs.filter(quantity_change__gt=0).aggregate(
            total=Coalesce(Sum("quantity_change"), 0.0)
        )["total"]
        outbound = qs.filter(quantity_change__lt=0).aggregate(
            total=Coalesce(Sum("quantity_change"), 0.0)
        )["total"]

        # By transaction type
        by_type = (
            qs.values("transaction_type")
            .annotate(total=Sum("quantity_change"), txn_count=Count("id"))
            .order_by("transaction_type")
        )

        # Monthly trend
        monthly = (
            qs.annotate(month=TruncMonth("created"))
            .values("month")
            .annotate(
                inbound=Coalesce(Sum("quantity_change", filter=Q(quantity_change__gt=0)), 0.0),
                outbound=Coalesce(Sum("quantity_change", filter=Q(quantity_change__lt=0)), 0.0),
            )
            .order_by("month")
        )
        monthly_list = [
            {
                "month": row["month"].strftime("%Y-%m"),
                "inbound": float(row["inbound"]),
                "outbound": float(row["outbound"]),
                "net": float(row["inbound"]) + float(row["outbound"]),
            }
            for row in monthly
        ]

        # Recent transactions
        recent = (
            qs.select_related("item", "performed_by", "project")
            .order_by("-created")[:50]
            .values(
                "id", "transaction_type", "quantity_change", "reason_note", "created",
                item_name=F("item__name"),
                item_sku=F("item__sku"),
                performed_by_name=F("performed_by__username"),
                project_name=F("project__name"),
            )
        )

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "summary": {
                "inbound": float(inbound),
                "outbound": float(outbound),
                "net": float(inbound) + float(outbound),
            },
            "by_type": list(by_type),
            "monthly_trend": monthly_list,
            "recent_transactions": list(recent),
        })


class InventoryProjectAllocationView(APIView):
    """Project-based material allocation and delivery status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get("project_id")

        qs = ProjectMaterial.objects.select_related("project", "item", "item__uom")
        if project_id:
            qs = qs.filter(project_id=project_id)

        by_project = {}
        for pm in qs:
            pid = pm.project_id
            if pid not in by_project:
                by_project[pid] = {
                    "project_id": pid,
                    "project_name": pm.project.name,
                    "project_code": pm.project.project_code,
                    "status": pm.project.status,
                    "total_allocated": 0,
                    "total_delivered": 0,
                    "materials": [],
                }
            by_project[pid]["total_allocated"] += float(pm.allocated_quantity)
            by_project[pid]["total_delivered"] += float(pm.delivered_quantity)
            by_project[pid]["materials"].append({
                "item_name": pm.item.name,
                "item_sku": pm.item.sku,
                "uom": pm.item.uom.abbreviation if pm.item.uom else "",
                "allocated": float(pm.allocated_quantity),
                "delivered": float(pm.delivered_quantity),
                "remaining": float(pm.allocated_quantity) - float(pm.delivered_quantity),
                "status": pm.status,
            })

        projects = list(by_project.values())
        for p in projects:
            allocated = p["total_allocated"]
            delivered = p["total_delivered"]
            p["completion_pct"] = round(
                (delivered / allocated * 100) if allocated else 0, 1
            )

        return Response({"projects": projects})


# ===========================================================================
# 2. SUPPLIER REPORTS
# ===========================================================================

class SupplierPOHistoryView(APIView):
    """Purchase order history per supplier."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)
        supplier_id = request.query_params.get("supplier_id")

        qs = PurchaseOrder.objects.filter(
            created__date__gte=date_from,
            created__date__lte=date_to,
        )
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        by_supplier = (
            qs.values(
                supplier_name=F("supplier__name"),
                supplier_id_val=F("supplier_id"),
            )
            .annotate(
                total_pos=Count("id"),
                accepted=Count("id", filter=Q(status__in=["ACCEPTED", "PARTIALLY", "RECEIVED"])),
                rejected=Count("id", filter=Q(status="REJECTED")),
                cancelled=Count("id", filter=Q(status="CANCELLED")),
                received=Count("id", filter=Q(status="RECEIVED")),
            )
            .order_by("supplier_name")
        )

        status_summary = (
            qs.values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "by_supplier": list(by_supplier),
            "status_summary": list(status_summary),
        })


class SupplierSpendView(APIView):
    """Spend per supplier broken down by month or quarter."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)
        period = request.query_params.get("period", "monthly")  # monthly | quarterly

        receipts = POReceipt.objects.filter(
            created__date__gte=date_from,
            created__date__lte=date_to,
        ).select_related("po__supplier")

        # Build spend from received lines only (good qty * unit price)
        spend_map = {}
        for receipt in receipts:
            supplier_name = receipt.po.supplier.name
            supplier_id = receipt.po.supplier_id
            for line in receipt.lines.select_related("po_line__item"):
                good_qty = float(line.quantity_received) - float(line.quantity_damaged)
                spend = good_qty * float(line.po_line.unit_price)
                key = (supplier_id, supplier_name)
                spend_map[key] = spend_map.get(key, 0) + spend

        by_supplier = [
            {"supplier_id": k[0], "supplier_name": k[1], "total_spend": round(v, 2)}
            for k, v in sorted(spend_map.items(), key=lambda x: -x[1])
        ]

        # Monthly/quarterly trend per supplier
        trunc_fn = TruncMonth if period == "monthly" else TruncQuarter
        trend_qs = (
            POReceipt.objects
            .filter(created__date__gte=date_from, created__date__lte=date_to)
            .annotate(period=trunc_fn("created"))
            .values("period", supplier_name=F("po__supplier__name"))
            .order_by("period", "supplier_name")
        )

        # We cannot aggregate spend in a single query because it requires
        # join through lines. Return per-period counts instead; the frontend
        # uses the by_supplier totals for the chart.
        trend_counts = (
            POReceipt.objects
            .filter(created__date__gte=date_from, created__date__lte=date_to)
            .annotate(period=trunc_fn("created"))
            .values("period", supplier_name=F("po__supplier__name"))
            .annotate(receipt_count=Count("id"))
            .order_by("period")
        )
        trend_list = [
            {
                "period": row["period"].strftime("%Y-%m") if row["period"] else None,
                "supplier_name": row["supplier_name"],
                "receipt_count": row["receipt_count"],
            }
            for row in trend_counts
        ]

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "by_supplier": by_supplier,
            "trend": trend_list,
        })


class SupplierLeadTimeView(APIView):
    """Average lead time from PO creation to first receipt per supplier."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)

        # Pair each receipt with its PO creation time
        receipts = (
            POReceipt.objects
            .filter(created__date__gte=date_from, created__date__lte=date_to)
            .select_related("po__supplier")
        )

        lead_map = {}
        for receipt in receipts:
            supplier_name = receipt.po.supplier.name
            supplier_id = receipt.po.supplier_id
            delta = (receipt.created - receipt.po.created).days
            key = (supplier_id, supplier_name)
            if key not in lead_map:
                lead_map[key] = []
            lead_map[key].append(max(delta, 0))

        result = []
        for (sid, sname), deltas in lead_map.items():
            avg = sum(deltas) / len(deltas) if deltas else 0
            result.append({
                "supplier_id": sid,
                "supplier_name": sname,
                "average_lead_days": round(avg, 1),
                "min_lead_days": min(deltas),
                "max_lead_days": max(deltas),
                "sample_count": len(deltas),
            })

        result.sort(key=lambda x: x["average_lead_days"])

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "suppliers": result,
        })


class SupplierPerformanceView(APIView):
    """On-time delivery rate and rejection rate per supplier."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)

        pos = (
            PurchaseOrder.objects
            .filter(created__date__gte=date_from, created__date__lte=date_to)
            .values(
                supplier_name=F("supplier__name"),
                supplier_id_val=F("supplier_id"),
            )
            .annotate(
                total=Count("id"),
                received=Count("id", filter=Q(status="RECEIVED")),
                partially=Count("id", filter=Q(status="PARTIALLY")),
                rejected=Count("id", filter=Q(status="REJECTED")),
                cancelled=Count("id", filter=Q(status="CANCELLED")),
            )
        )

        result = []
        for row in pos:
            total = row["total"] or 1
            fulfillment_rate = round((row["received"] / total) * 100, 1)
            rejection_rate = round((row["rejected"] / total) * 100, 1)
            result.append({
                "supplier_id": row["supplier_id_val"],
                "supplier_name": row["supplier_name"],
                "total_pos": row["total"],
                "received": row["received"],
                "partially_received": row["partially"],
                "rejected": row["rejected"],
                "cancelled": row["cancelled"],
                "fulfillment_rate_pct": fulfillment_rate,
                "rejection_rate_pct": rejection_rate,
            })

        result.sort(key=lambda x: -x["fulfillment_rate_pct"])

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "suppliers": result,
        })


# ===========================================================================
# 3. CLIENT REPORTS
# ===========================================================================

class ClientSOHistoryView(APIView):
    """Sales order history per client."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)
        client_id = request.query_params.get("client_id")

        qs = SalesOrder.objects.filter(
            created__date__gte=date_from,
            created__date__lte=date_to,
        )
        if client_id:
            qs = qs.filter(client_id=client_id)

        by_client = (
            qs.values(client_name=F("client__name"), client_id_val=F("client_id"))
            .annotate(
                total_orders=Count("id"),
                delivered=Count("id", filter=Q(status="DELIVERED")),
                cancelled=Count("id", filter=Q(status="CANCELLED")),
                pending=Count("id", filter=Q(status__in=["DRAFT", "CONFIRMED", "APPROVED", "DISPATCHED"])),
            )
            .order_by("client_name")
        )

        status_summary = (
            qs.values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "by_client": list(by_client),
            "status_summary": list(status_summary),
        })


class ClientRevenueView(APIView):
    """Revenue per client over a date range."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)
        period = request.query_params.get("period", "monthly")

        delivered_sos = SalesOrder.objects.filter(
            status="DELIVERED",
            created__date__gte=date_from,
            created__date__lte=date_to,
        )

        # Revenue per client using SO lines
        revenue_map = {}
        for so in delivered_sos.prefetch_related("lines"):
            client_name = so.client.name if so.client_id else "Unknown"
            client_id = so.client_id
            total = sum(
                float(line.quantity_requested) * float(line.unit_price)
                for line in so.lines.all()
            )
            key = (client_id, client_name)
            revenue_map[key] = revenue_map.get(key, 0) + total

        by_client = [
            {"client_id": k[0], "client_name": k[1], "total_revenue": round(v, 2)}
            for k, v in sorted(revenue_map.items(), key=lambda x: -x[1])
        ]

        # Monthly trend (count of delivered SOs as proxy)
        trunc_fn = TruncMonth if period == "monthly" else TruncQuarter
        monthly = (
            delivered_sos
            .annotate(period=trunc_fn("created"))
            .values("period")
            .annotate(order_count=Count("id"))
            .order_by("period")
        )
        trend = [
            {
                "period": row["period"].strftime("%Y-%m") if row["period"] else None,
                "order_count": row["order_count"],
            }
            for row in monthly
        ]

        total_revenue = sum(r["total_revenue"] for r in by_client)

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "total_revenue": round(total_revenue, 2),
            "by_client": by_client,
            "trend": trend,
        })


class ClientMaterialUsageView(APIView):
    """Material usage per client derived from delivered SO lines."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)
        client_id = request.query_params.get("client_id")

        qs = SalesOrderLine.objects.filter(
            so__status="DELIVERED",
            so__created__date__gte=date_from,
            so__created__date__lte=date_to,
        ).select_related("so__client", "item", "item__uom")
        if client_id:
            qs = qs.filter(so__client_id=client_id)

        usage_map = {}
        for line in qs:
            item_key = (line.item_id, line.item.name, line.item.sku,
                        line.item.uom.abbreviation if line.item.uom else "")
            if item_key not in usage_map:
                usage_map[item_key] = {"total_quantity": 0, "total_value": 0}
            usage_map[item_key]["total_quantity"] += float(line.quantity_requested)
            usage_map[item_key]["total_value"] += float(line.quantity_requested) * float(line.unit_price)

        items = [
            {
                "item_id": k[0],
                "item_name": k[1],
                "item_sku": k[2],
                "uom": k[3],
                "total_quantity": round(v["total_quantity"], 4),
                "total_value": round(v["total_value"], 2),
            }
            for k, v in sorted(usage_map.items(), key=lambda x: -x[1]["total_quantity"])
        ]

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "items": items,
        })


class ClientOutstandingOrdersView(APIView):
    """Sales orders that are not yet delivered or cancelled."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = SalesOrder.objects.filter(
            status__in=["DRAFT", "CONFIRMED", "APPROVED", "DISPATCHED"]
        ).select_related("client", "created_by").prefetch_related("lines")

        orders = []
        for so in qs.order_by("created"):
            total = sum(
                float(line.quantity_requested) * float(line.unit_price)
                for line in so.lines.all()
            )
            age_days = (timezone.now().date() - so.created.date()).days
            orders.append({
                "id": so.id,
                "so_number": so.so_number,
                "client_name": so.client.name if so.client else "",
                "status": so.status,
                "total_value": round(total, 2),
                "created": so.created.date().isoformat(),
                "age_days": age_days,
                "created_by": so.created_by.get_full_name() or so.created_by.username if so.created_by else "",
            })

        return Response({
            "count": len(orders),
            "orders": orders,
        })


# ===========================================================================
# 4. USER ACTIVITY REPORTS (Admin Only)
# ===========================================================================

class UserActivityPOView(APIView):
    """Who created and approved purchase orders."""
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)

        pos = PurchaseOrder.objects.filter(
            created__date__gte=date_from,
            created__date__lte=date_to,
        )

        by_creator = (
            pos.values(
                user_name=F("created_by__username"),
                first_name=F("created_by__first_name"),
                last_name=F("created_by__last_name"),
            )
            .annotate(
                total_created=Count("id"),
                total_value=Coalesce(
                    Sum(
                        ExpressionWrapper(
                            F("lines__quantity_ordered") * F("lines__unit_price"),
                            output_field=FloatField()
                        )
                    ),
                    0.0,
                ),
            )
            .order_by("-total_created")
        )

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "by_creator": list(by_creator),
        })


class UserRoleChangesView(APIView):
    """Role changes recorded in the audit log."""
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)

        logs = (
            AuditLog.objects
            .filter(
                resource_type="User",
                action="UPDATE",
                timestamp__date__gte=date_from,
                timestamp__date__lte=date_to,
            )
            .select_related("performed_by")
            .order_by("-timestamp")
        )

        # Filter to only those that have role change data
        role_changes = []
        for log in logs:
            changes = log.changes or {}
            if "role_before" in changes or "role_after" in changes:
                role_changes.append({
                    "id": log.id,
                    "timestamp": log.timestamp.isoformat(),
                    "performed_by": log.performed_by.username if log.performed_by else "System",
                    "resource_name": log.resource_name,
                    "role_before": changes.get("role_before"),
                    "role_after": changes.get("role_after"),
                    "ip_address": log.ip_address,
                })

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "count": len(role_changes),
            "role_changes": role_changes,
        })


class UserAccountActivityView(APIView):
    """Account creations, updates, and deletions in the audit log."""
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)

        logs = (
            AuditLog.objects
            .filter(
                resource_type="User",
                timestamp__date__gte=date_from,
                timestamp__date__lte=date_to,
            )
            .select_related("performed_by")
            .order_by("-timestamp")
            .values(
                "id",
                "action",
                "resource_name",
                "changes",
                "timestamp",
                "ip_address",
                performed_by_name=F("performed_by__username"),
            )
        )

        by_action = (
            AuditLog.objects
            .filter(resource_type="User", timestamp__date__gte=date_from, timestamp__date__lte=date_to)
            .values("action")
            .annotate(count=Count("id"))
        )

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "by_action": list(by_action),
            "logs": list(logs),
        })


class AuditLogReportView(APIView):
    """Full audit log with filtering for compliance purposes."""
    permission_classes = [IsSystemAdmin]

    def get(self, request):
        date_from, date_to = _parse_date_range(request)
        resource_type = request.query_params.get("resource_type", "")
        action = request.query_params.get("action", "")

        qs = AuditLog.objects.filter(
            timestamp__date__gte=date_from,
            timestamp__date__lte=date_to,
        ).select_related("performed_by")

        if resource_type:
            qs = qs.filter(resource_type=resource_type)
        if action:
            qs = qs.filter(action=action)

        summary = qs.values("action", "resource_type").annotate(count=Count("id")).order_by("resource_type", "action")

        logs = qs.order_by("-timestamp")[:200].values(
            "id",
            "action",
            "resource_type",
            "resource_id",
            "resource_name",
            "changes",
            "timestamp",
            "ip_address",
            performed_by_name=F("performed_by__username"),
        )

        return Response({
            "date_from": str(date_from),
            "date_to": str(date_to),
            "summary": list(summary),
            "logs": list(logs),
        })