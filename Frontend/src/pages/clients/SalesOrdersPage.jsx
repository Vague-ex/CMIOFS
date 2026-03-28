import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    getSalesOrders, createSalesOrder,
    confirmSO, approveSO, dispatchSO, deliverSO, cancelSO,
} from '../../api/clients'
import { getClients } from '../../api/clients'
import { getItems } from '../../api/inventory'
import { toast } from 'sonner'
import { X, Plus, Trash2, Truck, CheckCircle2 } from 'lucide-react'

// ── helpers ────────────────────────────────────────────────────────────────────

const inputCls =
    'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]'

const STATUS_META = {
    DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', step: 0 },
    CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700', step: 1 },
    APPROVED: { label: 'Approved', color: 'bg-violet-100 text-violet-700', step: 2 },
    DISPATCHED: { label: 'Dispatched', color: 'bg-amber-100 text-amber-700', step: 3 },
    DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700', step: 4 },
    CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-400', step: -1 },
}

const STEPS = ['Draft', 'Confirmed', 'Approved', 'Dispatched', 'Delivered']

function StatusBadge({ status }) {
    const m = STATUS_META[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
    return (
        <span className={`text-xs font-semibold px-2 py-1 rounded ${m.color}`}>{m.label}</span>
    )
}

function SOProgress({ status }) {
    const current = STATUS_META[status]?.step ?? 0
    if (status === 'CANCELLED') return null
    return (
        <div className="flex items-center gap-1 mt-3">
            {STEPS.map((label, idx) => (
                <div key={label} className="flex items-center gap-1 flex-1">
                    <div className="flex flex-col items-center flex-1">
                        <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${idx < current
                                    ? 'bg-[#2E75B6] text-white'
                                    : idx === current
                                        ? 'bg-[#1F3864] text-white ring-2 ring-[#2E75B6] ring-offset-1'
                                        : 'bg-gray-200 text-gray-400'
                                }`}
                        >
                            {idx < current ? '✓' : idx + 1}
                        </div>
                        <span className="text-xs text-gray-400 mt-1 whitespace-nowrap">{label}</span>
                    </div>
                    {idx < STEPS.length - 1 && (
                        <div
                            className={`h-0.5 flex-1 mb-4 ${idx < current ? 'bg-[#2E75B6]' : 'bg-gray-200'}`}
                        />
                    )}
                </div>
            ))}
        </div>
    )
}

// ── Create SO modal ────────────────────────────────────────────────────────────

function CreateSOModal({ onClose, onCreated, clients, items }) {
    const [clientId, setClientId] = useState('')
    const [notes, setNotes] = useState('')
    const [lines, setLines] = useState([{ item: '', quantity_requested: 1, unit_price: 0 }])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const addLine = () => setLines(l => [...l, { item: '', quantity_requested: 1, unit_price: 0 }])
    const removeLine = i => setLines(l => l.filter((_, idx) => idx !== i))
    const setLine = (i, k, v) =>
        setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [k]: v } : ln))

    const total = lines.reduce(
        (s, l) => s + (Number(l.quantity_requested) * Number(l.unit_price)), 0
    )

    // Show current stock when item selected
    const getItemStock = itemId => {
        const it = items.find(i => String(i.id) === String(itemId))
        return it ? Number(it.current_quantity) : null
    }

    const handleSubmit = async e => {
        e.preventDefault()
        if (!clientId) { setError('Please select a client.'); return }
        if (lines.some(l => !l.item)) { setError('All lines need an item.'); return }

        // Client-side stock check
        for (const l of lines) {
            const stock = getItemStock(l.item)
            if (stock !== null && Number(l.quantity_requested) > stock) {
                const it = items.find(i => String(i.id) === String(l.item))
                setError(`Insufficient stock for ${it?.name}: available ${stock}.`)
                return
            }
        }

        setSaving(true)
        setError('')
        try {
            const res = await createSalesOrder({
                client: clientId,
                notes,
                lines: lines.map(l => ({
                    item: l.item,
                    quantity_requested: Number(l.quantity_requested),
                    unit_price: Number(l.unit_price),
                })),
            })
            onCreated(res.data)
        } catch (err) {
            const d = err?.response?.data
            setError(
                typeof d === 'string' ? d :
                    d?.detail || d?.non_field_errors?.[0] ||
                    Object.values(d || {})[0] ||
                    'Failed to create sales order.'
            )
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 pt-12 pb-8 px-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-base font-semibold text-[#1F3864]">New Sales Order</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Client */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                        <select
                            className={inputCls}
                            value={clientId}
                            onChange={e => setClientId(e.target.value)}
                            required
                        >
                            <option value="">— Select client —</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Lines */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">Materials *</label>
                            <button
                                type="button"
                                onClick={addLine}
                                className="flex items-center gap-1 text-xs text-[#2E75B6] hover:text-[#1F3864]"
                            >
                                <Plus size={12} /> Add line
                            </button>
                        </div>

                        <div className="border border-gray-200 rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600 text-xs">
                                    <tr>
                                        <th className="text-left px-3 py-2">Item</th>
                                        <th className="text-left px-3 py-2 w-28">Quantity</th>
                                        <th className="text-left px-3 py-2 w-32">Unit Price (₱)</th>
                                        <th className="w-8" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {lines.map((ln, i) => {
                                        const stock = getItemStock(ln.item)
                                        const over = stock !== null && Number(ln.quantity_requested) > stock
                                        return (
                                            <tr key={i}>
                                                <td className="px-3 py-2">
                                                    <select
                                                        className="w-full text-sm border-0 focus:ring-0 focus:outline-none"
                                                        value={ln.item}
                                                        onChange={e => setLine(i, 'item', e.target.value)}
                                                        required
                                                    >
                                                        <option value="">— Select —</option>
                                                        {items.map(it => (
                                                            <option key={it.id} value={it.id}>
                                                                {it.name} (stock: {Number(it.current_quantity).toFixed(0)} {it.uom_abbreviation || ''})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {over && (
                                                        <p className="text-xs text-red-500 mt-0.5">
                                                            Exceeds available stock ({stock})
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        min="0.0001"
                                                        step="any"
                                                        className={`w-full text-sm border-0 focus:ring-0 focus:outline-none ${over ? 'text-red-500' : ''}`}
                                                        value={ln.quantity_requested}
                                                        onChange={e => setLine(i, 'quantity_requested', e.target.value)}
                                                        required
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="w-full text-sm border-0 focus:ring-0 focus:outline-none"
                                                        value={ln.unit_price}
                                                        onChange={e => setLine(i, 'unit_price', e.target.value)}
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    {lines.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeLine(i)}
                                                            className="text-red-400 hover:text-red-600"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="text-right text-sm text-gray-600 mt-2">
                            Total:{' '}
                            <span className="font-semibold text-[#1F3864]">
                                ₱{total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            className={inputCls}
                            rows={2}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Delivery instructions, client references..."
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 border border-red-200">
                            {error}
                        </p>
                    )}

                    <div className="flex gap-2 justify-end border-t pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm bg-[#2E75B6] text-white rounded-md hover:bg-[#1F3864] disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Create Sales Order'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ── Delivery confirm modal ─────────────────────────────────────────────────────

function DeliverModal({ so, onClose, onDelivered }) {
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async e => {
        e.preventDefault()
        setSaving(true)
        setError('')
        try {
            const res = await deliverSO(so.id, { note })
            onDelivered(res.data)
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to confirm delivery.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-green-600" />
                        <h3 className="text-base font-semibold text-[#1F3864]">Confirm Delivery</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">
                        Confirm that all materials for <span className="font-medium">{so.so_number}</span> have
                        been delivered to <span className="font-medium">{so.client_name}</span>.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Confirmation note (optional)
                        </label>
                        <textarea
                            className={inputCls}
                            rows={3}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Signed by, delivery reference, remarks..."
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 border border-red-200">
                            {error}
                        </p>
                    )}
                    <div className="flex gap-2 justify-end border-t pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                            {saving ? 'Confirming...' : 'Mark as Delivered'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ── SO detail drawer ───────────────────────────────────────────────────────────

function SODetailDrawer({ so, onClose, onAction }) {
    if (!so) return null

    const canConfirm = so.status === 'DRAFT'
    const canApprove = so.status === 'CONFIRMED'
    const canDispatch = so.status === 'APPROVED'
    const canDeliver = so.status === 'DISPATCHED'
    const canCancel = !['DELIVERED', 'CANCELLED'].includes(so.status)

    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative bg-white w-full max-w-lg shadow-2xl flex flex-col overflow-y-auto">
                {/* Header */}
                <div className="px-6 py-5 border-b flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-xs text-gray-500 font-mono mb-1">{so.so_number}</p>
                        <h2 className="text-lg font-bold text-[#1F3864]">{so.client_name}</h2>
                        <div className="mt-2">
                            <StatusBadge status={so.status} />
                        </div>
                        <SOProgress status={so.status} />
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 mt-1">
                        <X size={18} />
                    </button>
                </div>

                {/* Actions */}
                <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap gap-2">
                    {canConfirm && (
                        <button
                            onClick={() => onAction('confirm', so)}
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            Confirm Order
                        </button>
                    )}
                    {canApprove && (
                        <button
                            onClick={() => onAction('approve', so)}
                            className="px-3 py-1.5 text-xs bg-violet-600 text-white rounded-md hover:bg-violet-700"
                        >
                            Approve
                        </button>
                    )}
                    {canDispatch && (
                        <button
                            onClick={() => onAction('dispatch', so)}
                            className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-md hover:bg-amber-600 flex items-center gap-1"
                        >
                            <Truck size={11} /> Dispatch
                        </button>
                    )}
                    {canDeliver && (
                        <button
                            onClick={() => onAction('deliver', so)}
                            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
                        >
                            <CheckCircle2 size={11} /> Confirm Delivery
                        </button>
                    )}
                    {canCancel && (
                        <button
                            onClick={() => onAction('cancel', so)}
                            className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-md hover:bg-red-50"
                        >
                            Cancel
                        </button>
                    )}
                </div>

                {/* Info */}
                <div className="px-6 py-4 space-y-4 flex-1">
                    {so.notes && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                            <p className="text-sm text-gray-700">{so.notes}</p>
                        </div>
                    )}
                    {so.client_confirmation_note && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                Delivery confirmation
                            </p>
                            <p className="text-sm text-gray-700">{so.client_confirmation_note}</p>
                        </div>
                    )}

                    {/* Lines */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Materials
                        </p>
                        <div className="border border-gray-200 rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500">
                                    <tr>
                                        <th className="text-left px-3 py-2">Item</th>
                                        <th className="text-right px-3 py-2">Qty</th>
                                        <th className="text-right px-3 py-2">Price</th>
                                        <th className="text-right px-3 py-2">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(so.lines || []).map(l => (
                                        <tr key={l.id}>
                                            <td className="px-3 py-2">
                                                <p className="font-medium text-gray-900">{l.item_name}</p>
                                                <p className="text-xs text-gray-400">{l.item_sku}</p>
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-700">
                                                {Number(l.quantity_requested).toFixed(2)} {l.item_uom}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-700">
                                                ₱{Number(l.unit_price).toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium text-gray-900">
                                                ₱{(Number(l.quantity_requested) * Number(l.unit_price)).toLocaleString('en-PH', {
                                                    minimumFractionDigits: 2,
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="text-right text-sm text-gray-600 mt-2">
                            Total:{' '}
                            <span className="font-semibold text-[#1F3864]">
                                ₱{(so.total_value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="text-xs text-gray-400 space-y-1 pt-2 border-t">
                        <p>Created by: {so.created_by_name}</p>
                        <p>Date: {new Date(so.created).toLocaleDateString('en-PH', { dateStyle: 'long' })}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SalesOrdersPage() {
    const queryClient = useQueryClient()
    const [modal, setModal] = useState(null) // 'create' | 'deliver'
    const [selectedSO, setSelectedSO] = useState(null)
    const [drawerSO, setDrawerSO] = useState(null)
    const [statusFilter, setStatusFilter] = useState('')
    const [search, setSearch] = useState('')

    const { data, isLoading } = useQuery({
        queryKey: ['sales-orders', statusFilter, search],
        queryFn: () => getSalesOrders({ status: statusFilter || undefined, search: search || undefined }),
    })

    const { data: clientData } = useQuery({
        queryKey: ['clients'],
        queryFn: () => getClients(),
    })

    const { data: itemData } = useQuery({
        queryKey: ['items'],
        queryFn: () => getItems({ page_size: 200 }),
    })

    const clients = clientData?.data?.results ?? clientData?.data ?? []
    const items = itemData?.data?.results ?? []
    const orders = data?.data?.results ?? []

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sales-orders'] })

    // Inline action mutations
    const confirmMut = useMutation({
        mutationFn: id => confirmSO(id),
        onSuccess: res => { invalidate(); setDrawerSO(res.data); toast.success('Order confirmed.') },
        onError: () => toast.error('Failed to confirm.'),
    })

    const approveMut = useMutation({
        mutationFn: id => approveSO(id),
        onSuccess: res => { invalidate(); setDrawerSO(res.data); toast.success('Order approved.') },
        onError: () => toast.error('Failed to approve.'),
    })

    const dispatchMut = useMutation({
        mutationFn: id => dispatchSO(id),
        onSuccess: res => {
            invalidate()
            setDrawerSO(res.data)
            toast.success('Order dispatched. Inventory deducted.')
        },
        onError: err => toast.error(err?.response?.data?.error || 'Failed to dispatch.'),
    })

    const cancelMut = useMutation({
        mutationFn: id => cancelSO(id),
        onSuccess: res => { invalidate(); setDrawerSO(res.data); toast.success('Order cancelled.') },
        onError: () => toast.error('Failed to cancel.'),
    })

    const handleAction = (action, so) => {
        if (action === 'confirm') confirmMut.mutate(so.id)
        if (action === 'approve') approveMut.mutate(so.id)
        if (action === 'dispatch') dispatchMut.mutate(so.id)
        if (action === 'cancel') cancelMut.mutate(so.id)
        if (action === 'deliver') { setSelectedSO(so); setModal('deliver') }
    }

    const handleCreated = so => {
        invalidate()
        toast.success(`${so.so_number} created.`)
        setModal(null)
        setDrawerSO(so)
    }

    const handleDelivered = so => {
        invalidate()
        setModal(null)
        setDrawerSO(so)
        toast.success('Delivery confirmed. Invoice can now be generated.')
    }

    return (
        <div>
            {/* Modals */}
            {modal === 'create' && (
                <CreateSOModal
                    onClose={() => setModal(null)}
                    onCreated={handleCreated}
                    clients={clients}
                    items={items}
                />
            )}
            {modal === 'deliver' && selectedSO && (
                <DeliverModal
                    so={selectedSO}
                    onClose={() => setModal(null)}
                    onDelivered={handleDelivered}
                />
            )}

            {/* Drawer */}
            {drawerSO && (
                <SODetailDrawer
                    so={drawerSO}
                    onClose={() => setDrawerSO(null)}
                    onAction={handleAction}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[#1F3864]">Sales Orders</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Outbound materials to clients</p>
                </div>
                <button
                    onClick={() => setModal('create')}
                    className="bg-[#2E75B6] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#1F3864] transition"
                >
                    + New Sales Order
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
                <input
                    type="text"
                    placeholder="Search SO number or client..."
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                    {['', 'DRAFT', 'CONFIRMED', 'APPROVED', 'DISPATCHED', 'DELIVERED', 'CANCELLED'].map(s => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition ${statusFilter === s
                                    ? 'bg-[#2E75B6] text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {s === '' ? 'All' : STATUS_META[s]?.label || s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm">
                {isLoading ? (
                    <div className="p-8 text-center text-gray-400">Loading...</div>
                ) : orders.length === 0 ? (
                    <div className="p-12 text-center">
                        <Truck size={32} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400">No sales orders found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1F3864] text-white">
                                    <th className="text-left px-4 py-3">SO Number</th>
                                    <th className="text-left px-4 py-3">Client</th>
                                    <th className="text-left px-4 py-3">Items</th>
                                    <th className="text-right px-4 py-3">Total</th>
                                    <th className="text-left px-4 py-3">Status</th>
                                    <th className="text-left px-4 py-3">Date</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((so, i) => (
                                    <tr
                                        key={so.id}
                                        className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition cursor-pointer`}
                                        onClick={() => setDrawerSO(so)}
                                    >
                                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{so.so_number}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{so.client_name}</td>
                                        <td className="px-4 py-3 text-gray-500">{(so.lines || []).length} line(s)</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                                            ₱{(so.total_value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={so.status} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                                            {new Date(so.created).toLocaleDateString('en-PH')}
                                        </td>
                                        <td className="px-4 py-3 text-[#2E75B6] text-xs">View →</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}