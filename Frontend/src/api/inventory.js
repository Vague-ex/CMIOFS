import client from './client'

export const getItems = (params) => client.get('/items/', { params })
export const getItem = (id) => client.get(`/items/${id}/`)
export const createItem = (data) => client.post('/items/', data)
export const updateItem = (id, data) => client.patch(`/items/${id}/`, data)
export const deleteItem = (id) => client.delete(`/items/${id}/`)
export const previewSku = (categoryId) =>
    client.get('/items/preview-sku/', { params: categoryId ? { category_id: categoryId } : {} })
export const getTransactions = (params) => client.get('/inventory/transactions/', { params })
export const stockIn = (data) => client.post('/inventory/stock-in/', data)