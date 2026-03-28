import { useQuery } from '@tanstack/react-query'
import { getItems } from '../../api/inventory'
import { getPurchaseOrders } from '../../api/purchasing'

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
    const lowStock = items.filter(i => i.current_quantity <= i.reorder_point)
    const toWholeNumber = (value) => Math.round(Number(value) || 0)

    const stats = [
        { label: 'Total Items', value: itemsData?.data?.count ?? 0 },
        { label: 'Open POs', value: pos.filter(p => p.status !== 'FULFILLED' && p.status !== 'CANCELLED').length },
        { label: 'Low Stock', value: lowStock.length },
    ]

    return (
        <div>
            <h1 className="text-2xl font-bold text-[#1F3864] mb-6">Dashboard</h1>

            <div className="grid grid-cols-3 gap-4 mb-8">
                {stats.map((stat) => (
                    <div key={stat.label} className="bg-white rounded-lg shadow-sm p-6">
                        <p className="text-sm text-gray-500">{stat.label}</p>
                        <p className="text-3xl font-bold text-[#1F3864] mt-1">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-[#1F3864] mb-4">Low Stock Items</h2>
                {lowStock.length === 0 ? (
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
                            {lowStock.map((item, i) => (
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