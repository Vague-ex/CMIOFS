import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './sidebar'
import DashboardPage from '../../pages/dashboard/DashboardPage'
import ItemsPage from '../../pages/inventory/ItemsPage'
import SettingsPage from '../../pages/settings/SettingsPage'
import UsersPage from '../../pages/users/UsersPage'

export default function AppShell() {
    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar />
            <main className="flex-1 p-6 overflow-auto">
                <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/inventory/items" element={<ItemsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                </Routes>
            </main>
        </div>
    )
}