import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './sidebar'
import { useSidebar } from '../../context/SidebarContext'
import { useAuthStore } from '../../store/authstore'
import DashboardPage from '../../pages/dashboard/DashboardPage'
import ItemsPage from '../../pages/inventory/ItemsPage'
import SettingsPage from '../../pages/settings/SettingsPage'
import UsersPage from '../../pages/users/UsersPage'
import PurchaseOrdersPage from '../../pages/purchasing/PurchaseOrdersPage'
import SalesOrdersPage from '../../pages/clients/SalesOrdersPage'
import SuppliersPage from '../../pages/suppliers/SuppliersPage'
import ReportsPage from '../../pages/reports/ReportsPage'

export default function AppShell() {
    const role = useAuthStore((s) => s.user?.role || '')
    const canViewSuppliers = ['SYSTEM_ADMIN', 'PURCHASING_MANAGER'].includes(role)
    const { collapsed } = useSidebar()

    return (
        <div className="flex min-h-screen bg-gray-100">
            <Sidebar />
            <main className={`flex-1 p-6 overflow-auto transition-all duration-300 ease-in-out ${collapsed ? 'ml-20' : 'ml-60'}`}>
                <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/inventory/items" element={<ItemsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/users" element={<UsersPage />} />
                    <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
                    <Route path="/delivery-orders" element={<Navigate to="/sales-orders" replace />} />
                    <Route path="/sales-orders" element={<SalesOrdersPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/reports/*" element={<ReportsPage />} />
                    <Route
                        path="/suppliers"
                        element={canViewSuppliers ? <SuppliersPage /> : <Navigate to="/dashboard" replace />}
                    />
                </Routes>
            </main>
        </div>
    )
}