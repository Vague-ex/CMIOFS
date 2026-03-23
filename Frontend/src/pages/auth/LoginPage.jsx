import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../../api/auth'
import { useAuthStore } from '../../store/authstore'

export default function LoginPage() {
    const navigate = useNavigate()
    const loginStore = useAuthStore((s) => s.login)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const { data } = await login(username, password)
            loginStore(null, data.access, data.refresh)
            navigate('/dashboard')
        } catch {
            setError('Invalid username or password.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#1F3864] flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
                <h1 className="text-2xl font-bold text-[#1F3864] mb-2">CMIOFS</h1>
                <p className="text-gray-500 mb-6">Sign in to your account</p>

                {error && (
                    <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#2E75B6] hover:bg-[#1F3864] text-white font-medium py-2 rounded-md transition disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    )
}