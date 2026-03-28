import { create } from 'zustand'

function decodeToken(accessToken) {
    try {
        return JSON.parse(atob(accessToken.split('.')[1]))
    } catch {
        return {}
    }
}

function getInitialUser() {
    const token = localStorage.getItem('access_token')
    if (!token) return null
    const payload = decodeToken(token)
    const role = payload?.role || payload?.user_role || ''
    return role ? { role } : null
}

export const useAuthStore = create((set) => ({
    user: getInitialUser(),
    isAuthenticated: !!localStorage.getItem('access_token'),

    login: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', refreshToken)

        // Decode role from JWT payload
        const payload = decodeToken(accessToken)
        const role = payload?.role || payload?.user_role || ''
        if (role) {
            localStorage.setItem('user_role', role)
        }

        const normalizedUser = user || (role ? { role } : null)
        set({ user: normalizedUser, isAuthenticated: true })
    },

    logout: () => {
        localStorage.clear()
        set({ user: null, isAuthenticated: false })
    },
}))