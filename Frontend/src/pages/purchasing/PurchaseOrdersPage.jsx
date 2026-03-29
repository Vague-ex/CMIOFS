import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    getPurchaseOrders, createPurchaseOrder,
    submitPO, supplierAcceptPO, supplierRejectPO,
    receivePO, cancelPO,
} from '../../api/purchasing'
import { getSuppliers, createSupplierRequest } from '../../api/suppliers'
import { getItems } from '../../api/inventory'
import {
    clampPhilippinePhoneInput,
    isValidPhilippinePhone,
    PH_PHONE_HINT,
    PH_PHONE_MAX_LENGTH,
} from '../../utils/phone'
import { toast } from 'sonner'
import { X, Plus, Trash2, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'

// ── helpers ────────────────────────────────────────────────────────────────────

const inputCls =
    'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]'

const STATUS_META = {
    DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
    SUBMITTED: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
    ACCEPTED: { label: 'Accepted', color: 'bg-emerald-100 text-emerald-700' },
    REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
    PARTIALLY: { label: 'Partially Received', color: 'bg-amber-100 text-amber-700' },
    RECEIVED: { label: 'Fully Received', color: 'bg-green-100 text-green-700' },
    CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-400' },
}

function StatusBadge({ status }) {
    const m = STATUS_META[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
    return (
        <span className={`text-xs font-semibold px-2 py-1 rounded ${m.color}`}>{m.label}</span>
    )
}

// ── Create PO modal ────────────────────────────────────────────────────────────

function CreatePOModal({ onClose, onCreated, suppliers, items, onSupplierRequested }) {
    const [supplierId, setSupplierId] = useState('')
    const [notes, setNotes] = useState('')
    const [lines, setLines] = useState([{ item: '', quantity_ordered: 1, unit_price: 0 }])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [showSupplierRequest, setShowSupplierRequest] = useState(false)
    const [supplierRequest, setSupplierRequest] = useState({
        name: '', contact_name: '', email: '', phone: '', address: '', justification: ''
    })
    const [requestSaving, setRequestSaving] = useState(false)
    const [requestError, setRequestError] = useState('')

    const addLine = () => setLines(l => [...l, { item: '', quantity_ordered: 1, unit_price: 0 }])
    const removeLine = i => setLines(l => l.filter((_, idx) => idx !== i))
    const setLine = (i, k, v) =>
        setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [k]: v } : ln))

    const total = lines.reduce((s, l) => s + (Number(l.quantity_ordered) * Number(l.unit_price)), 0)

    const setSupplierRequestField = (key, value) => {
        setSupplierRequest(prev => ({ ...prev, [key]: value }))
    }

    const submitSupplierRequest = async (e) => {
        e.preventDefault()
        if (!supplierRequest.name.trim()) {
            setRequestError('Supplier name is required.')
            return
        }
        if (supplierRequest.phone && !isValidPhilippinePhone(supplierRequest.phone)) {
            setRequestError(`Invalid phone number. ${PH_PHONE_HINT}`)
            return
        }
        setRequestSaving(true)
        setRequestError('')
        try {
            await createSupplierRequest({
                ...supplierRequest,
                name: supplierRequest.name.trim(),
            })
            toast.success('Supplier request submitted for admin approval.')
            setShowSupplierRequest(false)
            setSupplierRequest({ name: '', contact_name: '', email: '', phone: '', address: '', justification: '' })
            onSupplierRequested?.()
        } catch (err) {
            const msg = err?.response?.data?.detail || err?.response?.data?.error || 'Failed to submit supplier request.'
            setRequestError(msg)
        } finally {
            setRequestSaving(false)
        }
    }

    const handleSubmit = async e => {
        e.preventDefault()
        if (!supplierId) { setError('Please select a supplier.'); return }
        if (lines.some(l => !l.item)) { setError('All lines need an item.'); return }
        setSaving(true)
        setError('')
        try {
            const res = await createPurchaseOrder({
                supplier: supplierId,
                notes,
                lines: lines.map(l => ({
                    item: l.item,
                    quantity_ordered: Number(l.quantity_ordered),
                    unit_price: Number(l.unit_price),
                })),
            })
            onCreated(res.data)
        } catch (err) {
            console.error('PO creation error:', err.response?.data)
            const errorMsg = err?.response?.data?.detail ||
                (typeof err?.response?.data === 'object' ? JSON.stringify(err?.response?.data) : 'Failed to create PO.')
            setError(errorMsg)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 pt-12 pb-8 px-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-base font-semibold text-[#1F3864]">New Purchase Order</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Supplier */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                        <select
                            className={inputCls}
                            value={supplierId}
                            onChange={e => setSupplierId(e.target.value)}
                            required
                        >
                            <option value="">— Select supplier —</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                setShowSupplierRequest(v => !v)
                                setRequestError('')
                            }}
                            className="mt-2 text-xs text-[#2E75B6] hover:text-[#1F3864]"
                        >
                            {showSupplierRequest ? 'Hide request form' : "Can't find supplier? Request new supplier"}
                        </button>

                        {showSupplierRequest && (
                            <div className="mt-3 border border-blue-100 bg-blue-50 rounded-md p-3 space-y-2">
                                <p className="text-xs font-medium text-[#1F3864]">New Supplier Request</p>
                                <input
                                    className={inputCls}
                                    placeholder="Supplier name *"
                                    value={supplierRequest.name}
                                    onChange={e => setSupplierRequestField('name', e.target.value)}
                                    required
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        className={inputCls}
                                        placeholder="Contact person"
                                        value={supplierRequest.contact_name}
                                        onChange={e => setSupplierRequestField('contact_name', e.target.value)}
                                    />
                                    <input
                                        className={inputCls}
                                        placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                                        value={supplierRequest.phone}
                                        onChange={e => setSupplierRequestField('phone', clampPhilippinePhoneInput(e.target.value))}
                                        pattern="^(09[0-9]{9}|\+639[0-9]{9})$"
                                        title={PH_PHONE_HINT}
                                        maxLength={PH_PHONE_MAX_LENGTH}
                                        inputMode="tel"
                                    />
                                </div>
                                <input
                                    type="email"
                                    className={inputCls}
                                    placeholder="Email"
                                    value={supplierRequest.email}
                                    onChange={e => setSupplierRequestField('email', e.target.value)}
                                />
                                <textarea
                                    className={inputCls}
                                    rows={2}
                                    placeholder="Address"
                                    value={supplierRequest.address}
                                    onChange={e => setSupplierRequestField('address', e.target.value)}
                                />
                                <textarea
                                    className={inputCls}
                                    rows={2}
                                    placeholder="Why this supplier is needed (optional)"
                                    value={supplierRequest.justification}
                                    onChange={e => setSupplierRequestField('justification', e.target.value)}
                                />
                                {requestError && (
                                    <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1 border border-red-200">{requestError}</p>
                                )}
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={submitSupplierRequest}
                                        disabled={requestSaving}
                                        className="px-3 py-1.5 text-xs bg-[#2E75B6] text-white rounded-md hover:bg-[#1F3864] disabled:opacity-50"
                                    >
                                        {requestSaving ? 'Submitting...' : 'Submit Supplier Request'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Lines */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">Items *</label>
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
                                    {lines.map((ln, i) => (
                                        <tr key={i}>
                                            <td className="px-3 py-2">
                                                <select
                                                    className="w-full text-sm border-0 focus:ring-0 focus:outline-none"
                                                    value={ln.item}
                                                    onChange={e => {
                                                        setLine(i, 'item', e.target.value)
                                                        const selectedItem = items.find(it => it.id == e.target.value)
                                                        if (selectedItem) {
                                                            setLine(i, 'unit_price', selectedItem.standard_cost || 0)
                                                        }
                                                    }}
                                                    required
                                                >
                                                    <option value="">— Select —</option>
                                                    {items.map(it => (
                                                        <option key={it.id} value={it.id}>
                                                            {it.name} ({it.uom_abbreviation || '—'})
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min="0.0001"
                                                    step="any"
                                                    className="w-full text-sm border-0 focus:ring-0 focus:outline-none"
                                                    value={ln.quantity_ordered}
                                                    onChange={e => setLine(i, 'quantity_ordered', e.target.value)}
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
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="text-right text-sm text-gray-600 mt-2">
                            Estimated total:{' '}
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
                            placeholder="Instructions for the supplier..."
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
                            {saving ? 'Saving...' : 'Create PO'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ── Receive / inspect modal ────────────────────────────────────────────────────

function ReceiveModal({ po, onClose, onReceived }) {
    const [generalNote, setGeneralNote] = useState('')
    const [lineData, setLineData] = useState(
        po.lines.map(l => ({
            po_line: l.id,
            item_name: l.item_name,
            quantity_ordered: Number(l.quantity_ordered),
            quantity_received: Number(l.quantity_ordered) - Number(l.quantity_received),
            quantity_damaged: 0,
            quantity_missing: 0,
            damage_note: '',
        }))
    )
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [expandedRow, setExpandedRow] = useState(null)

    const setLD = (i, k, v) =>
        setLineData(d => d.map((r, idx) => idx === i ? { ...r, [k]: v } : r))

    const handleSubmit = async e => {
        e.preventDefault()
        setSaving(true)
        setError('')
        try {
            const res = await receivePO(po.id, {
                note: generalNote,
                lines: lineData.map(r => ({
                    po_line: r.po_line,
                    quantity_received: Number(r.quantity_received),
                    quantity_damaged: Number(r.quantity_damaged),
                    quantity_missing: Number(r.quantity_missing),
                    damage_note: r.damage_note,
                })),
            })
            onReceived(res.data)
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to record receipt.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 pt-12 pb-8 px-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <h3 className="text-base font-semibold text-[#1F3864]">
                            Receive Delivery — {po.po_number}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Enter what actually arrived. Good items go straight to inventory.
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {lineData.map((row, i) => {
                        const open = expandedRow === i
                        const hasIssue = Number(row.quantity_damaged) > 0 || Number(row.quantity_missing) > 0
                        const good = Math.max(0, Number(row.quantity_received) - Number(row.quantity_damaged))
                        return (
                            <div key={i} className={`border rounded-md overflow-hidden ${hasIssue ? 'border-amber-300' : 'border-gray-200'}`}>
                                {/* Row header */}
                                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{row.item_name}</p>
                                        <p className="text-xs text-gray-500">
                                            Expected: {row.quantity_ordered} — Still pending:{' '}
                                            {row.quantity_ordered}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-0.5">Received</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                className="w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#2E75B6]"
                                                value={row.quantity_received}
                                                onChange={e => setLD(i, 'quantity_received', e.target.value)}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedRow(open ? null : i)}
                                            className="text-gray-400 hover:text-gray-600 mt-4"
                                            title="Report damage / missing"
                                        >
                                            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded issue section */}
                                {open && (
                                    <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 space-y-3">
                                        <p className="text-xs font-medium text-amber-800">
                                            Report issues — this note will be sent to the supplier
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Damaged qty</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    className={inputCls}
                                                    value={row.quantity_damaged}
                                                    onChange={e => setLD(i, 'quantity_damaged', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Missing qty</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    className={inputCls}
                                                    value={row.quantity_missing}
                                                    onChange={e => setLD(i, 'quantity_missing', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">
                                                Issue description (included in supplier note)
                                            </label>
                                            <textarea
                                                className={inputCls}
                                                rows={2}
                                                value={row.damage_note}
                                                onChange={e => setLD(i, 'damage_note', e.target.value)}
                                                placeholder="e.g. 3 bags of cement arrived torn, 2 steel bars visibly bent..."
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Good quantity that will enter inventory:{' '}
                                            <span className="font-semibold text-green-700">{good}</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    {/* General note */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            General note to supplier (optional)
                        </label>
                        <textarea
                            className={inputCls}
                            rows={2}
                            value={generalNote}
                            onChange={e => setGeneralNote(e.target.value)}
                            placeholder="Overall delivery note or reference..."
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
                            {saving ? 'Recording...' : 'Confirm Receipt'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ── Supplier response modal (accept/reject) ────────────────────────────────────

function SupplierResponseModal({ po, onClose, onUpdated }) {
    const [note, setNote] = useState('')
    const [action, setAction] = useState('accept')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async e => {
        e.preventDefault()
        setSaving(true)
        setError('')
        try {
            const fn = action === 'accept' ? supplierAcceptPO : supplierRejectPO
            const res = await fn(po.id, { note })
            onUpdated(res.data)
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to update PO.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h3 className="text-base font-semibold text-[#1F3864]">
                        Supplier Response — {po.po_number}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">
                        Record whether the supplier accepted or rejected this purchase order.
                    </p>
                    <div className="flex gap-3">
                        {['accept', 'reject'].map(v => (
                            <label
                                key={v}
                                className={`flex-1 flex items-center justify-center gap-2 border rounded-md py-2.5 text-sm font-medium cursor-pointer transition ${action === v
                                    ? v === 'accept'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-red-400 bg-red-50 text-red-700'
                                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    className="sr-only"
                                    value={v}
                                    checked={action === v}
                                    onChange={() => setAction(v)}
                                />
                                {v === 'accept' ? '✓ Accepted' : '✕ Rejected'}
                            </label>
                        ))}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Supplier note (optional)
                        </label>
                        <textarea
                            className={inputCls}
                            rows={3}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder={
                                action === 'reject'
                                    ? 'Reason for rejection...'
                                    : 'Confirmation reference, expected delivery date...'
                            }
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
                            className={`px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 ${action === 'accept'
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-red-600 hover:bg-red-700'
                                }`}
                        >
                            {saving ? 'Saving...' : action === 'accept' ? 'Mark Accepted' : 'Mark Rejected'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ── PO detail drawer ───────────────────────────────────────────────────────────

function PODetailDrawer({ po, onClose, onAction }) {
    if (!po) return null

    const canSubmit = po.status === 'DRAFT'
    const canRespond = po.status === 'SUBMITTED'
    const canReceive = po.status === 'ACCEPTED' || po.status === 'PARTIALLY'
    const canCancel = !['RECEIVED', 'CANCELLED'].includes(po.status)

    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative bg-white w-full max-w-lg shadow-2xl flex flex-col overflow-y-auto">
                {/* Header */}
                <div className="px-6 py-5 border-b flex items-start justify-between">
                    <div>
                        <p className="text-xs text-gray-500 font-mono mb-1">{po.po_number}</p>
                        <h2 className="text-lg font-bold text-[#1F3864]">{po.supplier_name}</h2>
                        <div className="mt-2">
                            <StatusBadge status={po.status} />
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-1">
                        <X size={18} />
                    </button>
                </div>

                {/* Actions */}
                <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap gap-2">
                    {canSubmit && (
                        <button
                            onClick={() => onAction('submit', po)}
                            className="px-3 py-1.5 text-xs bg-[#2E75B6] text-white rounded-md hover:bg-[#1F3864]"
                        >
                            Submit to Supplier
                        </button>
                    )}
                    {canRespond && (
                        <button
                            onClick={() => onAction('respond', po)}
                            className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                        >
                            Record Response
                        </button>
                    )}
                    {canReceive && (
                        <button
                            onClick={() => onAction('receive', po)}
                            className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-md hover:bg-amber-600"
                        >
                            Receive Delivery
                        </button>
                    )}
                    {canCancel && (
                        <button
                            onClick={() => onAction('cancel', po)}
                            className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-md hover:bg-red-50"
                        >
                            Cancel PO
                        </button>
                    )}
                </div>

                {/* Info */}
                <div className="px-6 py-4 space-y-4 flex-1">
                    {po.notes && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                            <p className="text-sm text-gray-700">{po.notes}</p>
                        </div>
                    )}
                    {po.supplier_response_note && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                                Supplier response
                            </p>
                            <p className="text-sm text-gray-700">{po.supplier_response_note}</p>
                        </div>
                    )}

                    {/* Lines */}
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Items</p>
                        <div className="border border-gray-200 rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500">
                                    <tr>
                                        <th className="text-left px-3 py-2">Item</th>
                                        <th className="text-right px-3 py-2">Ordered</th>
                                        <th className="text-right px-3 py-2">Received</th>
                                        <th className="text-right px-3 py-2">Price</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(po.lines || []).map(l => (
                                        <tr key={l.id}>
                                            <td className="px-3 py-2">
                                                <p className="font-medium text-gray-900">{l.item_name}</p>
                                                <p className="text-xs text-gray-400">{l.item_sku}</p>
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-700">
                                                {Number(l.quantity_ordered).toFixed(2)} {l.item_uom}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <span
                                                    className={
                                                        Number(l.quantity_received) >= Number(l.quantity_ordered)
                                                            ? 'text-green-600 font-medium'
                                                            : 'text-amber-600'
                                                    }
                                                >
                                                    {Number(l.quantity_received).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-700">
                                                ₱{Number(l.unit_price).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="text-right text-sm text-gray-600 mt-2">
                            Total:{' '}
                            <span className="font-semibold text-[#1F3864]">
                                ₱{(po.total_value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Receipts */}
                    {(po.receipts || []).length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                                Delivery receipts
                            </p>
                            <div className="space-y-2">
                                {po.receipts.map(r => (
                                    <div key={r.id} className="border border-gray-200 rounded-md p-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="text-xs font-medium text-gray-700">
                                                Received by {r.received_by_name}
                                            </p>
                                            <p className="text-xs text-gray-400 font-mono">
                                                {new Date(r.created).toLocaleDateString('en-PH')}
                                            </p>
                                        </div>
                                        {r.note && <p className="text-xs text-gray-500 mb-2">{r.note}</p>}
                                        {(r.lines || []).map(rl => (
                                            <div key={rl.id} className="text-xs text-gray-600 flex justify-between py-0.5">
                                                <span>{rl.item_name}</span>
                                                <span>
                                                    rcvd {rl.quantity_received}
                                                    {Number(rl.quantity_damaged) > 0 && (
                                                        <span className="text-red-500 ml-1">/ {rl.quantity_damaged} dmg</span>
                                                    )}
                                                    {Number(rl.quantity_missing) > 0 && (
                                                        <span className="text-amber-600 ml-1">/ {rl.quantity_missing} missing</span>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
    const queryClient = useQueryClient()
    const [modal, setModal] = useState(null) // 'create' | 'receive' | 'respond'
    const [selectedPO, setSelectedPO] = useState(null)
    const [drawerPO, setDrawerPO] = useState(null)
    const [statusFilter, setStatusFilter] = useState('')
    const [search, setSearch] = useState('')

    const { data, isLoading } = useQuery({
        queryKey: ['purchase-orders', statusFilter, search],
        queryFn: () => getPurchaseOrders({ status: statusFilter || undefined, search: search || undefined }),
    })

    const { data: supplierData } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => getSuppliers(),
    })

    const { data: itemData } = useQuery({
        queryKey: ['items'],
        queryFn: () => getItems({ page_size: 200 }),
    })

    const suppliers = supplierData?.data?.results ?? supplierData?.data ?? []
    const items = itemData?.data?.results ?? []
    const orders = data?.data?.results ?? []

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })

    const submitMut = useMutation({
        mutationFn: id => submitPO(id),
        onSuccess: res => {
            invalidate()
            setDrawerPO(res.data)
            toast.success('PO submitted to supplier.')
        },
        onError: () => toast.error('Failed to submit.'),
    })

    const cancelMut = useMutation({
        mutationFn: id => cancelPO(id),
        onSuccess: res => {
            invalidate()
            setDrawerPO(res.data)
            toast.success('PO cancelled.')
        },
        onError: () => toast.error('Failed to cancel.'),
    })

    const handleAction = (action, po) => {
        if (action === 'submit') { submitMut.mutate(po.id) }
        if (action === 'cancel') { cancelMut.mutate(po.id) }
        if (action === 'respond') { setSelectedPO(po); setModal('respond') }
        if (action === 'receive') { setSelectedPO(po); setModal('receive') }
    }

    const handleCreated = po => {
        invalidate()
        toast.success(`PO ${po.po_number} created.`)
        setModal(null)
        setDrawerPO(po)
    }

    const handleUpdated = po => {
        invalidate()
        setModal(null)
        setDrawerPO(po)
        toast.success('PO updated.')
    }

    return (
        <div>
            {/* Modals */}
            {modal === 'create' && (
                <CreatePOModal
                    onClose={() => setModal(null)}
                    onCreated={handleCreated}
                    suppliers={suppliers}
                    items={items}
                    onSupplierRequested={() => queryClient.invalidateQueries({ queryKey: ['suppliers'] })}
                />
            )}
            {modal === 'respond' && selectedPO && (
                <SupplierResponseModal
                    po={selectedPO}
                    onClose={() => setModal(null)}
                    onUpdated={handleUpdated}
                />
            )}
            {modal === 'receive' && selectedPO && (
                <ReceiveModal
                    po={selectedPO}
                    onClose={() => setModal(null)}
                    onReceived={handleUpdated}
                />
            )}

            {/* Drawer */}
            {drawerPO && (
                <PODetailDrawer
                    po={drawerPO}
                    onClose={() => setDrawerPO(null)}
                    onAction={handleAction}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[#1F3864]">Purchase Orders</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Inbound supply from suppliers</p>
                </div>
                <button
                    onClick={() => setModal('create')}
                    className="bg-[#2E75B6] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#1F3864] transition"
                >
                    + New PO
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
                <input
                    type="text"
                    placeholder="Search PO number or supplier..."
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                    {['', 'DRAFT', 'SUBMITTED', 'ACCEPTED', 'PARTIALLY', 'RECEIVED', 'REJECTED', 'CANCELLED'].map(s => (
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
                        <ClipboardList size={32} className="text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400">No purchase orders found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1F3864] text-white">
                                    <th className="text-left px-4 py-3">PO Number</th>
                                    <th className="text-left px-4 py-3">Supplier</th>
                                    <th className="text-left px-4 py-3">Items</th>
                                    <th className="text-right px-4 py-3">Total</th>
                                    <th className="text-left px-4 py-3">Status</th>
                                    <th className="text-left px-4 py-3">Date</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((po, i) => (
                                    <tr
                                        key={po.id}
                                        className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition cursor-pointer`}
                                        onClick={() => setDrawerPO(po)}
                                    >
                                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{po.po_number}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{po.supplier_name}</td>
                                        <td className="px-4 py-3 text-gray-500">{(po.lines || []).length} line(s)</td>
                                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                                            ₱{(po.total_value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={po.status} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                                            {new Date(po.created).toLocaleDateString('en-PH')}
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