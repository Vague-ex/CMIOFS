import client from './client'

// Items
export const getItems = (params) => client.get('/items/', { params })
export const getItem = (id) => client.get(`/items/${id}/`)
export const createItem = (data) => client.post('/items/', data)
export const updateItem = (id, data) => client.patch(`/items/${id}/`, data)
export const deleteItem = (id) => client.delete(`/items/${id}/`)
export const previewSku = (categoryId) =>
    client.get('/items/preview-sku/', { params: categoryId ? { category_id: categoryId } : {} })
export const convertQty = (id, quantity, toUomId) =>
    client.get(`/items/${id}/convert/`, { params: { quantity, to_uom_id: toUomId } })
export const stockInItem = (id, data) => client.post(`/items/${id}/stock-in/`, data)

// Reference data
export const getCategories = () => client.get('/categories/')
export const getUOMs = (params) => client.get('/uom/', { params })
export const getConversions = () => client.get('/uom-conversions/')

// Projects
export const getProjects = (params) => client.get('/projects/', { params })
export const getProject = (id) => client.get(`/projects/${id}/`)
export const createProject = (data) => client.post('/projects/', data)
export const updateProject = (id, data) => client.patch(`/projects/${id}/`, data)

// Project materials
export const getProjectMaterials = (params) => client.get('/project-materials/', { params })
export const createProjectMaterial = (data) => client.post('/project-materials/', data)
export const updateProjectMaterial = (id, data) => client.patch(`/project-materials/${id}/`, data)
export const deliverProjectMaterial = (id, data) => client.post(`/project-materials/${id}/deliver/`, data)

// Transactions (read-only)
export const getTransactions = (params) => client.get('/inventory/transactions/', { params })