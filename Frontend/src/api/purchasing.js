import client from './client'

export const getPurchaseOrders = (params) => client.get('/purchase-orders/', { params })
export const getPurchaseOrder = (id) => client.get(`/purchase-orders/${id}/`)
export const createPurchaseOrder = (data) => client.post('/purchase-orders/', data)
export const updatePurchaseOrder = (id, data) => client.patch(`/purchase-orders/${id}/`, data)
export const submitPO = (id) => client.post(`/purchase-orders/${id}/submit/`)
export const approvePO = (id) => client.post(`/purchase-orders/${id}/approve/`)
export const rejectPO = (id, reason) => client.post(`/purchase-orders/${id}/reject/`, { reason })
export const receivePO = (id, data) => client.post(`/purchase-orders/${id}/receive/`, data)
export const cancelPO = (id, reason) => client.post(`/purchase-orders/${id}/cancel/`, { reason })