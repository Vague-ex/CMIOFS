import axios from 'axios'

const client = axios.create({
    baseURL: '/api/v1',
    headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
client.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// Auto-refresh on 401
client.interceptors.response.use(
    (res) => res,
    async (error) => {
        const original = error.config
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true
            try {
                const refresh = localStorage.getItem('refresh_token')
                const { data } = await axios.post('/api/v1/auth/token/refresh/', { refresh })
                localStorage.setItem('access_token', data.access)
                original.headers.Authorization = `Bearer ${data.access}`
                return client(original)
            } catch {
                localStorage.clear()
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default client