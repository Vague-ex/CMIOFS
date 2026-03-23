import client from './client'
import axios from 'axios'

export const login = (email, password) =>
    axios.post('/api/v1/auth/token/', { username: email, password })

export const refreshToken = (refresh) =>
    axios.post('/api/v1/auth/token/refresh/', { refresh })