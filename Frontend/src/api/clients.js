import client from './client'

export const getClients = (params) => client.get('/clients/', { params })
export const createClient = (data) => client.post('/clients/', data)
export const updateClient = (id, data) => client.patch(`/clients/${id}/`, data)
export const deleteClient = (id) => client.delete(`/clients/${id}/`)

export const getSalesOrders = (params) => client.get('/sales-orders/', { params })
export const getSalesOrder = (id) => client.get(`/sales-orders/${id}/`)
export const createSalesOrder = (data) => client.post('/sales-orders/', data)
export const confirmSO = (id) => client.post(`/sales-orders/${id}/confirm/`)
export const approveSO = (id) => client.post(`/sales-orders/${id}/approve/`)
export const dispatchSO = (id) => client.post(`/sales-orders/${id}/dispatch/`)
export const deliverSO = (id, data) => client.post(`/sales-orders/${id}/deliver/`, data)
export const cancelSO = (id) => client.post(`/sales-orders/${id}/cancel/`)