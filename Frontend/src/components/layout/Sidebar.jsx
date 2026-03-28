import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authstore'
import { LayoutDashboard, Package, ClipboardList, Truck, BarChart3, LogOut, Settings, Users, Building2 } from 'lucide-react'

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/inventory/items', icon: Package, label: 'Items' },
    { to: '/suppliers', icon: Building2, label: 'Suppliers' },
    { to: '/purchase-orders', icon: ClipboardList, label: 'Purchase Orders' },
    { to: '/delivery-orders', icon: Truck, label: 'Delivery Orders' },
    { to: '/sales-orders', icon: Truck, label: 'Sales Orders' },
    { to: '/reports/stock', icon: BarChart3, label: 'Reports' },
]

export default function Sidebar() {
    const logout = useAuthStore((s) => s.logout)
    const role = useAuthStore((s) => s.user?.role || '')

    const linkClass = ({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${isActive
            ? 'bg-[#2E75B6] text-white'
            : 'text-blue-200 hover:bg-blue-900 hover:text-white'
        }`

    return (
        <div className="w-60 bg-[#1F3864] min-h-screen flex flex-col">
            <div className="p-6 border-b border-blue-900">
                <h1 className="text-white font-bold text-lg">CMIOFS</h1>
                <p className="text-blue-300 text-xs mt-1">Inventory System</p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink key={to} to={to} className={linkClass}>
                        <Icon size={16} />
                        {label}
                    </NavLink>
                ))}

                {['SYSTEM_ADMIN', 'PURCHASING_MANAGER'].includes(role) && (
                    <NavLink to="/users" className={linkClass}>
                        <Users size={16} />
                        Users
                    </NavLink>
                )}

                {role === 'SYSTEM_ADMIN' && (
                    <NavLink to="/settings" className={linkClass}>
                        <Settings size={16} />
                        Settings
                    </NavLink>
                )}
            </nav>

            <div className="p-4 border-t border-blue-900">
                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-blue-200 hover:bg-blue-900 hover:text-white w-full transition"
                >
                    <LogOut size={16} />
                    Sign Out
                </button>
            </div>
        </div>
    )
}