import axios from 'axios'

function getStoredAccessToken() {
    return localStorage.getItem('access_token') || localStorage.getItem('access')
}

function getStoredRefreshToken() {
    return localStorage.getItem('refresh_token') || localStorage.getItem('refresh')
}

function storeTokens(access, refresh) {
    if (access) {
        localStorage.setItem('access_token', access)
        localStorage.setItem('access', access)
    }
    if (refresh) {
        localStorage.setItem('refresh_token', refresh)
        localStorage.setItem('refresh', refresh)
    }
}

const client = axios.create({
    baseURL: '/api/v1',
    headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
client.interceptors.request.use((config) => {
    const token = getStoredAccessToken()
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
                const refresh = getStoredRefreshToken()
                const { data } = await axios.post('/api/v1/auth/token/refresh/', { refresh })
                storeTokens(data.access, data.refresh)
                original.headers = original.headers || {}
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