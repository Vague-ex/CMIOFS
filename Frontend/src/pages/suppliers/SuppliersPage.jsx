import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../api/suppliers'
import { toast } from 'sonner'
import { Pencil, Trash2, X, Building2, Phone, Mail, MapPin } from 'lucide-react'

const EMPTY = { name: '', contact_name: '', email: '', phone: '', address: '' }

const inputCls =
    'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

function Field({ label, children }) {
    return (
        <div>
            <label className={labelCls}>{label}</label>
            {children}
        </div>
    )
}

function SupplierForm({ initial, onSubmit, onCancel, isPending, mode }) {
    const [form, setForm] = useState(initial)
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const handleSubmit = e => {
        e.preventDefault()
        onSubmit(form)
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#1F3864]">
                    {mode === 'edit' ? 'Edit Supplier' : 'New Supplier'}
                </h2>
                <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={18} />
                </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <Field label="Company Name *">
                        <input
                            className={inputCls}
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            required
                        />
                    </Field>
                </div>
                <Field label="Contact Person">
                    <input
                        className={inputCls}
                        value={form.contact_name}
                        onChange={e => set('contact_name', e.target.value)}
                    />
                </Field>
                <Field label="Email">
                    <input
                        type="email"
                        className={inputCls}
                        value={form.email}
                        onChange={e => set('email', e.target.value)}
                    />
                </Field>
                <Field label="Phone">
                    <input
                        className={inputCls}
                        value={form.phone}
                        onChange={e => set('phone', e.target.value)}
                        placeholder="+63 9xx xxx xxxx"
                    />
                </Field>
                <div className="col-span-2">
                    <Field label="Address">
                        <textarea
                            className={inputCls}
                            rows={2}
                            value={form.address}
                            onChange={e => set('address', e.target.value)}
                        />
                    </Field>
                </div>
                <div className="col-span-2 flex gap-2 justify-end pt-2 border-t">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="px-4 py-2 text-sm bg-[#2E75B6] text-white rounded-md hover:bg-[#1F3864] disabled:opacity-50"
                    >
                        {isPending ? 'Saving...' : mode === 'edit' ? 'Update' : 'Save Supplier'}
                    </button>
                </div>
            </form>
        </div>
    )
}

function DeleteDialog({ supplier, onConfirm, onCancel, isPending }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove Supplier</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Are you sure you want to deactivate{' '}
                    <span className="font-medium">{supplier.name}</span>?
                </p>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isPending}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                        {isPending ? 'Removing...' : 'Yes, Remove'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function SuppliersPage() {
    const queryClient = useQueryClient()
    const [mode, setMode] = useState(null)
    const [editing, setEditing] = useState(null)
    const [deleting, setDeleting] = useState(null)
    const [search, setSearch] = useState('')

    const { data, isLoading } = useQuery({
        queryKey: ['suppliers', search],
        queryFn: () => getSuppliers({ search }),
    })

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['suppliers'] })

    const createMut = useMutation({
        mutationFn: createSupplier,
        onSuccess: () => { invalidate(); toast.success('Supplier added.'); setMode(null) },
        onError: () => toast.error('Failed to add supplier.'),
    })

    const updateMut = useMutation({
        mutationFn: ({ id, data }) => updateSupplier(id, data),
        onSuccess: () => { invalidate(); toast.success('Supplier updated.'); setMode(null); setEditing(null) },
        onError: () => toast.error('Failed to update supplier.'),
    })

    const deleteMut = useMutation({
        mutationFn: deleteSupplier,
        onSuccess: () => { invalidate(); toast.success('Supplier removed.'); setDeleting(null) },
        onError: () => toast.error('Failed to remove supplier.'),
    })

    const suppliers = data?.data?.results ?? data?.data ?? []

    return (
        <div>
            {deleting && (
                <DeleteDialog
                    supplier={deleting}
                    onConfirm={() => deleteMut.mutate(deleting.id)}
                    onCancel={() => setDeleting(null)}
                    isPending={deleteMut.isPending}
                />
            )}

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-[#1F3864]">Suppliers</h1>
                {mode === null && (
                    <button
                        onClick={() => setMode('create')}
                        className="bg-[#2E75B6] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#1F3864] transition"
                    >
                        + Add Supplier
                    </button>
                )}
            </div>

            {mode === 'create' && (
                <SupplierForm
                    initial={EMPTY}
                    onSubmit={d => createMut.mutate(d)}
                    onCancel={() => setMode(null)}
                    isPending={createMut.isPending}
                    mode="create"
                />
            )}

            {mode === 'edit' && editing && (
                <SupplierForm
                    initial={editing}
                    onSubmit={d => updateMut.mutate({ id: editing.id, data: d })}
                    onCancel={() => { setMode(null); setEditing(null) }}
                    isPending={updateMut.isPending}
                    mode="edit"
                />
            )}

            <div className="bg-white rounded-lg shadow-sm">
                <div className="p-4 border-b">
                    <input
                        type="text"
                        placeholder="Search suppliers..."
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-gray-400">Loading...</div>
                ) : suppliers.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        {search ? `No results for "${search}"` : 'No suppliers yet.'}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {suppliers.map(s => (
                            <div key={s.id} className="p-5 hover:bg-gray-50 transition flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#1F3864] flex items-center justify-center shrink-0">
                                        <Building2 size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900">{s.name}</p>
                                        {s.contact_name && (
                                            <p className="text-sm text-gray-500 mt-0.5">{s.contact_name}</p>
                                        )}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                            {s.email && (
                                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                                    <Mail size={11} /> {s.email}
                                                </span>
                                            )}
                                            {s.phone && (
                                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                                    <Phone size={11} /> {s.phone}
                                                </span>
                                            )}
                                            {s.address && (
                                                <span className="flex items-center gap-1 text-xs text-gray-500">
                                                    <MapPin size={11} /> {s.address}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 ml-4">
                                    <button
                                        onClick={() => { setEditing(s); setMode('edit') }}
                                        className="text-[#2E75B6] hover:text-[#1F3864]"
                                        title="Edit"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        onClick={() => setDeleting(s)}
                                        className="text-red-400 hover:text-red-600"
                                        title="Remove"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}