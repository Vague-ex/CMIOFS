import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authstore'
import { useSidebar } from '../../context/SidebarContext'
import { LayoutDashboard, Package, ClipboardList, Truck, BarChart3, LogOut, Settings, Users, Building2, ChevronLeft, ChevronRight } from 'lucide-react'

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/inventory/items', icon: Package, label: 'Items' },
    { to: '/purchase-orders', icon: ClipboardList, label: 'Purchase Orders' },
    { to: '/sales-orders', icon: Truck, label: 'Sales Orders' },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
]

export default function Sidebar() {
    const logout = useAuthStore((s) => s.logout)
    const role = useAuthStore((s) => s.user?.role || '')
    const canViewSuppliers = ['SYSTEM_ADMIN', 'PURCHASING_MANAGER'].includes(role)
    const { collapsed, setCollapsed } = useSidebar()

    const linkClass = ({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${isActive
            ? 'bg-[#2E75B6] text-white'
            : 'text-blue-200 hover:bg-blue-900 hover:text-white'
        }`

    return (
        <div className={`fixed left-0 top-0 h-screen bg-[#1F3864] flex flex-col border-r border-blue-900 transition-all duration-300 z-50 ${collapsed ? 'w-20' : 'w-60'}`}>
            <div className={`p-6 border-b border-blue-900 flex flex-col items-center ${collapsed ? 'px-3' : ''}`}>
                <img src="/logo.png" alt="CMIOFS Logo" className="w-12 h-12 mb-3" />
                {!collapsed && (
                    <>
                        <h1 className="text-white font-bold text-lg">CMIOFS</h1>
                        <p className="text-blue-300 text-xs mt-1">Inventory System</p>
                    </>
                )}
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink key={to} to={to} className={linkClass} title={collapsed ? label : ''}>
                        <Icon size={16} className="flex-shrink-0" />
                        {!collapsed && <span>{label}</span>}
                    </NavLink>
                ))}

                {canViewSuppliers && (
                    <NavLink to="/suppliers" className={linkClass} title={collapsed ? 'Suppliers' : ''}>
                        <Building2 size={16} className="flex-shrink-0" />
                        {!collapsed && <span>Suppliers</span>}
                    </NavLink>
                )}

                {['SYSTEM_ADMIN', 'PURCHASING_MANAGER'].includes(role) && (
                    <NavLink to="/users" className={linkClass} title={collapsed ? 'Users' : ''}>
                        <Users size={16} className="flex-shrink-0" />
                        {!collapsed && <span>Users</span>}
                    </NavLink>
                )}

                {role === 'SYSTEM_ADMIN' && (
                    <NavLink to="/settings" className={linkClass} title={collapsed ? 'Settings' : ''}>
                        <Settings size={16} className="flex-shrink-0" />
                        {!collapsed && <span>Settings</span>}
                    </NavLink>
                )}
            </nav>

            <div className="p-4 border-t border-blue-900 space-y-2">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-blue-300 hover:bg-blue-900 hover:text-white w-full transition"
                    title={collapsed ? 'Expand' : 'Collapse'}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    {!collapsed && <span>Collapse</span>}
                </button>
                <button
                    onClick={logout}
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-blue-200 hover:bg-blue-900 hover:text-white w-full transition"
                    title={collapsed ? 'Sign Out' : ''}
                >
                    <LogOut size={16} className="flex-shrink-0" />
                    {!collapsed && <span>Sign Out</span>}
                </button>
            </div>
        </div>
    )
}