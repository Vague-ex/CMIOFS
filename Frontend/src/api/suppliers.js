import client from './client'

export const getSuppliers = (params) => client.get('/suppliers/', { params })
export const getSupplier = (id) => client.get(`/suppliers/${id}/`)
export const createSupplier = (data) => client.post('/suppliers/', data)
export const updateSupplier = (id, data) => client.patch(`/suppliers/${id}/`, data)
export const deleteSupplier = (id) => client.delete(`/suppliers/${id}/`)