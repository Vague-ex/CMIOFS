import { useQuery } from '@tanstack/react-query'
import { getItems } from '../../api/inventory'
import { getPurchaseOrders } from '../../api/purchasing'
import { Package, AlertTriangle, ShoppingCart, Truck } from 'lucide-react'

export default function DashboardPage() {
    const { data: itemsData } = useQuery({
        queryKey: ['items'],
        queryFn: () => getItems({ page_size: 100 })
    })

    const { data: poData } = useQuery({
        queryKey: ['purchase-orders'],
        queryFn: () => getPurchaseOrders()
    })

    const items = itemsData?.data?.results ?? []
    const pos = poData?.data?.results ?? []
    const outOfStock = items.filter(i => i.current_quantity <= 0).length
    const lowStock = items.filter(i => i.current_quantity > 0 && i.current_quantity <= i.reorder_point).length
    const totalStockValue = items.reduce((sum, i) => sum + (i.current_quantity * i.standard_cost), 0)
    const activeItems = items.filter(i => i.is_active).length
    const toWholeNumber = (value) => Math.round(Number(value) || 0)

    const stats = [
        {
            label: 'Total Active Items',
            value: activeItems,
            icon: Package,
            bgColor: 'bg-blue-100',
            iconColor: 'text-blue-500',
            changes: [
                { text: '+3 added this week', color: 'text-green-600' },
                { text: '-2 deactivated this week', color: 'text-red-600' }
            ]
        },
        {
            label: 'Open Purchase Orders',
            value: pos.filter(p => p.status !== 'FULFILLED' && p.status !== 'CANCELLED').length,
            icon: ShoppingCart,
            bgColor: 'bg-cyan-100',
            iconColor: 'text-cyan-500',
            changes: [
                { text: '+2 today', color: 'text-green-600' }
            ]
        },
        {
            label: 'Low-Stock Items',
            value: lowStock,
            icon: AlertTriangle,
            bgColor: 'bg-orange-100',
            iconColor: 'text-orange-500',
            changes: [
                { text: '+1 today', color: 'text-red-600' }
            ]
        },
        {
            label: 'Out of Stock',
            value: outOfStock,
            icon: Truck,
            bgColor: 'bg-green-100',
            iconColor: 'text-green-500',
            changes: [
                { text: '0 today', color: 'text-gray-500' }
            ]
        },
    ]

    return (
        <div>
            <h1 className="text-2xl font-bold text-[#1F3864] mb-6">Dashboard</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <div key={stat.label} className="bg-white rounded-lg p-6 shadow-sm">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`${stat.bgColor} rounded-lg p-3`}>
                                    <Icon className={`${stat.iconColor} w-6 h-6`} />
                                </div>
                                <div className="text-right">
                                    {stat.changes.map((change, idx) => (
                                        <div key={idx} className={`text-xs font-semibold ${change.color}`}>
                                            {change.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-[#1F3864] mb-1">{stat.value}</p>
                            <p className="text-sm text-gray-500">{stat.label}</p>
                        </div>
                    )
                })}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-[#1F3864] mb-4">Low Stock Items</h2>
                {lowStock === 0 ? (
                    <p className="text-gray-400 text-sm">All items are sufficiently stocked.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[#1F3864] text-white">
                                <th className="text-left px-4 py-2">Item</th>
                                <th className="text-left px-4 py-2">Current Qty</th>
                                <th className="text-left px-4 py-2">Reorder Point</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.filter(i => i.current_quantity > 0 && i.current_quantity <= i.reorder_point).map((item, i) => (
                                <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-2">{item.name}</td>
                                    <td className="px-4 py-2 text-red-600 font-medium">{toWholeNumber(item.current_quantity)}</td>
                                    <td className="px-4 py-2">{item.reorder_point}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}