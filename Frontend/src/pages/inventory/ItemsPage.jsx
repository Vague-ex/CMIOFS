import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getItems, createItem, deleteItem } from '../../api/inventory'
import { toast } from 'sonner'

export default function ItemsPage() {
    const queryClient = useQueryClient()
    const [showForm, setShowForm] = useState(false)
    const [search, setSearch] = useState('')
    const [form, setForm] = useState({
        name: '', sku: '', description: '',
        reorder_point: 0, standard_cost: 0
    })

    const { data, isLoading } = useQuery({
        queryKey: ['items', search],
        queryFn: () => getItems({ search })
    })

    const createMutation = useMutation({
        mutationFn: createItem,
        onSuccess: () => {
            queryClient.invalidateQueries(['items'])
            toast.success('Item created successfully.')
            setShowForm(false)
            setForm({ name: '', sku: '', description: '', reorder_point: 0, standard_cost: 0 })
        },
        onError: () => toast.error('Failed to create item.')
    })

    const deleteMutation = useMutation({
        mutationFn: deleteItem,
        onSuccess: () => {
            queryClient.invalidateQueries(['items'])
            toast.success('Item deleted.')
        },
        onError: () => toast.error('Failed to delete item.')
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        createMutation.mutate(form)
    }

    const items = data?.data?.results ?? []

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-[#1F3864]">Inventory Items</h1>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-[#2E75B6] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#1F3864] transition"
                >
                    + Add Item
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h2 className="text-lg font-semibold text-[#1F3864] mb-4">New Item</h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                            <input
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                            <input
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                                value={form.sku}
                                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Point</label>
                            <input
                                type="number"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                                value={form.reorder_point}
                                onChange={(e) => setForm({ ...form, reorder_point: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Standard Cost</label>
                            <input
                                type="number"
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                                value={form.standard_cost}
                                onChange={(e) => setForm({ ...form, standard_cost: e.target.value })}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={2}
                            />
                        </div>
                        <div className="col-span-2 flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="px-4 py-2 text-sm bg-[#2E75B6] text-white rounded-md hover:bg-[#1F3864] disabled:opacity-50"
                            >
                                {createMutation.isPending ? 'Saving...' : 'Save Item'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm">
                <div className="p-4 border-b">
                    <input
                        type="text"
                        placeholder="Search items..."
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-gray-400">Loading...</div>
                ) : items.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">No items found.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-[#1F3864] text-white">
                                <th className="text-left px-4 py-3">SKU</th>
                                <th className="text-left px-4 py-3">Name</th>
                                <th className="text-left px-4 py-3">Current Qty</th>
                                <th className="text-left px-4 py-3">Reorder Point</th>
                                <th className="text-left px-4 py-3">Status</th>
                                <th className="text-left px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, i) => (
                                <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                                    <td className="px-4 py-3 font-medium">{item.name}</td>
                                    <td className="px-4 py-3">{item.current_quantity}</td>
                                    <td className="px-4 py-3">{item.reorder_point}</td>
                                    <td className="px-4 py-3">
                                        {item.current_quantity <= 0 ? (
                                            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded">OUT OF STOCK</span>
                                        ) : item.current_quantity <= item.reorder_point ? (
                                            <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded">LOW STOCK</span>
                                        ) : (
                                            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">IN STOCK</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => deleteMutation.mutate(item.id)}
                                            className="text-red-500 hover:text-red-700 text-xs"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}