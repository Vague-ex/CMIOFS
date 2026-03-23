import { create } from 'zustand'

export const useAuthStore = create((set) => ({
    user: null,
    isAuthenticated: !!localStorage.getItem('access_token'),

    login: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', refreshToken)
        set({ user, isAuthenticated: true })
    },

    logout: () => {
        localStorage.clear()
        set({ user: null, isAuthenticated: false })
    },
}))