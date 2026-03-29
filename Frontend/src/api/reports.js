import client from './client'

// Shared helper: build query string from a params object, skipping null/undefined/empty
function qs(params = {}) {
    const p = {}
    for (const [k, v] of Object.entries(params)) {
        if (v !== null && v !== undefined && v !== '') p[k] = v
    }
    return p
}

// ------------------------------------------------------------------
// Inventory reports
// ------------------------------------------------------------------
export const getStockLevels = () =>
    client.get('/reports/inventory/stock-levels/')

export const getLowStock = (includeZero = true) =>
    client.get('/reports/inventory/low-stock/', { params: { include_zero: includeZero } })

export const getStockMovement = (params = {}) =>
    client.get('/reports/inventory/stock-movement/', { params: qs(params) })

export const getProjectAllocation = (params = {}) =>
    client.get('/reports/inventory/project-allocation/', { params: qs(params) })

// ------------------------------------------------------------------
// Supplier reports
// ------------------------------------------------------------------
export const getSupplierPOHistory = (params = {}) =>
    client.get('/reports/suppliers/po-history/', { params: qs(params) })

export const getSupplierSpend = (params = {}) =>
    client.get('/reports/suppliers/spend/', { params: qs(params) })

export const getSupplierLeadTimes = (params = {}) =>
    client.get('/reports/suppliers/lead-times/', { params: qs(params) })

export const getSupplierPerformance = (params = {}) =>
    client.get('/reports/suppliers/performance/', { params: qs(params) })

// ------------------------------------------------------------------
// Client reports
// ------------------------------------------------------------------
export const getClientSOHistory = (params = {}) =>
    client.get('/reports/clients/so-history/', { params: qs(params) })

export const getClientRevenue = (params = {}) =>
    client.get('/reports/clients/revenue/', { params: qs(params) })

export const getClientMaterialUsage = (params = {}) =>
    client.get('/reports/clients/material-usage/', { params: qs(params) })

export const getClientOutstandingOrders = () =>
    client.get('/reports/clients/outstanding-orders/')

// ------------------------------------------------------------------
// User activity reports (admin only)
// ------------------------------------------------------------------
export const getUserPOActivity = (params = {}) =>
    client.get('/reports/users/po-activity/', { params: qs(params) })

export const getUserRoleChanges = (params = {}) =>
    client.get('/reports/users/role-changes/', { params: qs(params) })

export const getUserAccountActivity = (params = {}) =>
    client.get('/reports/users/account-activity/', { params: qs(params) })

export const getAuditLogReport = (params = {}) =>
    client.get('/reports/users/audit-log/', { params: qs(params) })