import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, ClipboardList, Truck, BarChart3, LogOut } from 'lucide-react'
import { useAuthStore } from '../../store/authstore'

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/inventory/items', icon: Package, label: 'Items' },
    { to: '/purchase-orders', icon: ClipboardList, label: 'Purchase Orders' },
    { to: '/delivery-orders', icon: Truck, label: 'Delivery Orders' },
    { to: '/reports/stock', icon: BarChart3, label: 'Reports' },
]

export default function Sidebar() {
    const logout = useAuthStore((s) => s.logout)

    return (
        <div className="w-60 bg-[#1F3864] min-h-screen flex flex-col">
            <div className="p-6 border-b border-blue-900">
                <h1 className="text-white font-bold text-lg">CMIOFS</h1>
                <p className="text-blue-300 text-xs mt-1">Inventory System</p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${isActive
                                ? 'bg-[#2E75B6] text-white'
                                : 'text-blue-200 hover:bg-blue-900 hover:text-white'
                            }`
                        }
                    >
                        <Icon size={16} />
                        {label}
                    </NavLink>
                ))}
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