import client from './client'

export const getDeliveryOrders = (params) => client.get('/delivery-orders/', { params })
export const getDeliveryOrder = (id) => client.get(`/delivery-orders/${id}/`)
export const createDeliveryOrder = (data) => client.post('/delivery-orders/', data)
export const submitDO = (id) => client.post(`/delivery-orders/${id}/submit/`)
export const approveDO = (id) => client.post(`/delivery-orders/${id}/approve/`)
export const dispatchDO = (id, data) => client.post(`/delivery-orders/${id}/dispatch/`, data)
export const deliverDO = (id) => client.post(`/delivery-orders/${id}/deliver/`)