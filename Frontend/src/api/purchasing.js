import client from './client'

export const getPurchaseOrders = (params) => client.get('/purchase-orders/', { params })
export const getPurchaseOrder = (id) => client.get(`/purchase-orders/${id}/`)
export const createPurchaseOrder = (data) => client.post('/purchase-orders/', data)
export const updatePurchaseOrder = (id, data) => client.patch(`/purchase-orders/${id}/`, data)
export const submitPO = (id) => client.post(`/purchase-orders/${id}/submit/`)
export const supplierAcceptPO = (id, data) => client.post(`/purchase-orders/${id}/supplier-accept/`, data)
export const supplierRejectPO = (id, data) => client.post(`/purchase-orders/${id}/supplier-reject/`, data)
export const receivePO = (id, data) => client.post(`/purchase-orders/${id}/receive/`, data)
export const cancelPO = (id) => client.post(`/purchase-orders/${id}/cancel/`)