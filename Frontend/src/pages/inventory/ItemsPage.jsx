import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    getItems, createItem, updateItem, deleteItem,
    previewSku, getCategories, getUOMs
} from '../../api/inventory'
import { toast } from 'sonner'
import { Pencil, Trash2, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

const EMPTY_FORM = {
    name: '', sku: '', description: '',
    reorder_point: 0, standard_cost: 0,
    category: '', uom: '',
    material_spec_data: {
        grade: '', standard: '', certification: '',
        compressive_strength: '', yield_strength: '', mix_ratio: '',
        diameter: '', length: '', width: '', thickness: '', weight_per_unit: '',
        material_type: '', finish: '', color: '', notes: '',
    }
}

const inputCls = 'w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

function Field({ label, children, hint }) {
    return (
        <div>
            <label className={labelCls}>{label}</label>
            {children}
            {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
        </div>
    )
}

function SectionToggle({ label, open, onToggle }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-sm font-semibold text-[#1F3864] col-span-2 py-2 border-t mt-2"
        >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {label}
        </button>
    )
}

function ItemForm({ initial, onSubmit, onCancel, isPending, mode, categories, uoms }) {
    const [form, setForm] = useState(initial)
    const [skuManual, setSkuManual] = useState(!!initial.sku)
    const [skuLoading, setSkuLoading] = useState(false)
    const [showSpec, setShowSpec] = useState(false)

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }))
    const setSpec = (key, val) =>
        setForm(f => ({ ...f, material_spec_data: { ...f.material_spec_data, [key]: val } }))

    const handleCategoryChange = async (val) => {
        set('category', val)
        if (!skuManual) {
            setSkuLoading(true)
            try {
                const res = await previewSku(val || null)
                set('sku', res.data.sku)
            } catch { /* ignore */ }
            finally { setSkuLoading(false) }
        }
    }

    const handleSkuChange = (val) => {
        set('sku', val)
        setSkuManual(!!val)
    }

    const handleAutoGenerate = async () => {
        setSkuManual(false)
        setSkuLoading(true)
        try {
            const res = await previewSku(form.category || null)
            set('sku', res.data.sku)
        } catch { /* ignore */ }
        finally { setSkuLoading(false) }
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        // Strip empty spec fields so we don't save blank objects
        const spec = form.material_spec_data
        const hasSpec = Object.values(spec).some(v => v !== '' && v !== null && v !== undefined)
        onSubmit({
            ...form,
            sku: skuManual ? form.sku : '',
            material_spec_data: hasSpec ? spec : undefined,
        })
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#1F3864]">
                    {mode === 'edit' ? 'Edit Item' : 'New Item'}
                </h2>
                <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                    <X size={18} />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">

                {/* ── Core fields ── */}
                <Field label="Name *">
                    <input className={inputCls} value={form.name}
                        onChange={e => set('name', e.target.value)} required />
                </Field>

                <Field label="SKU">
                    <div className="flex gap-2">
                        <input className={inputCls} value={form.sku}
                            onChange={e => handleSkuChange(e.target.value)}
                            placeholder="Leave blank to auto-generate" />
                        <button type="button" onClick={handleAutoGenerate}
                            title="Re-generate SKU"
                            className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-500">
                            <RefreshCw size={14} className={skuLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                        {skuManual ? 'Custom SKU' : 'Auto-generated on save'}
                    </p>
                </Field>

                <Field label="Category">
                    <select className={inputCls} value={form.category}
                        onChange={e => handleCategoryChange(e.target.value)}>
                        <option value="">— None —</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </Field>

                <Field label="Unit of Measure">
                    <select className={inputCls} value={form.uom}
                        onChange={e => set('uom', e.target.value)}>
                        <option value="">— None —</option>
                        {uoms.map(u => (
                            <option key={u.id} value={u.id}>
                                {u.abbreviation} — {u.name} ({u.unit_type})
                            </option>
                        ))}
                    </select>
                </Field>

                <Field label="Reorder Point">
                    <input type="number" min="0" className={inputCls}
                        value={form.reorder_point}
                        onChange={e => set('reorder_point', e.target.value)} />
                </Field>

                <Field label="Standard Cost (₱)">
                    <input type="number" min="0" step="0.01" className={inputCls}
                        value={form.standard_cost}
                        onChange={e => set('standard_cost', e.target.value)} />
                </Field>

                <div className="col-span-2">
                    <Field label="Description">
                        <textarea className={inputCls} rows={2} value={form.description}
                            onChange={e => set('description', e.target.value)} />
                    </Field>
                </div>

                {/* ── Material Specs toggle ── */}
                <SectionToggle
                    label="Material Specifications (optional)"
                    open={showSpec}
                    onToggle={() => setShowSpec(s => !s)}
                />

                {showSpec && (
                    <>
                        {/* Classification */}
                        <p className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Classification
                        </p>

                        <Field label="Material Type"
                            hint="e.g. deformed bar, OPC cement, structural steel, softwood">
                            <input className={inputCls}
                                value={form.material_spec_data.material_type}
                                onChange={e => setSpec('material_type', e.target.value)} />
                        </Field>

                        <Field label="Grade"
                            hint="e.g. Grade 60, S275, C25/30, F17">
                            <input className={inputCls}
                                value={form.material_spec_data.grade}
                                onChange={e => setSpec('grade', e.target.value)} />
                        </Field>

                        <Field label="Standard / Code"
                            hint="e.g. ASTM A615, BS 4449, NSCP 2015">
                            <input className={inputCls}
                                value={form.material_spec_data.standard}
                                onChange={e => setSpec('standard', e.target.value)} />
                        </Field>

                        <Field label="Certification"
                            hint="e.g. ISO 9001, PNS certified, mill cert required">
                            <input className={inputCls}
                                value={form.material_spec_data.certification}
                                onChange={e => setSpec('certification', e.target.value)} />
                        </Field>

                        {/* Strength */}
                        <p className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">
                            Strength / Mix
                        </p>

                        <Field label="Compressive Strength" hint="e.g. 3000 psi, 20 MPa">
                            <input className={inputCls}
                                value={form.material_spec_data.compressive_strength}
                                onChange={e => setSpec('compressive_strength', e.target.value)} />
                        </Field>

                        <Field label="Yield Strength" hint="e.g. 60,000 psi, 415 MPa">
                            <input className={inputCls}
                                value={form.material_spec_data.yield_strength}
                                onChange={e => setSpec('yield_strength', e.target.value)} />
                        </Field>

                        <div className="col-span-2">
                            <Field label="Mix Ratio" hint="e.g. 1:2:4 (cement:sand:gravel)">
                                <input className={inputCls}
                                    value={form.material_spec_data.mix_ratio}
                                    onChange={e => setSpec('mix_ratio', e.target.value)} />
                            </Field>
                        </div>

                        {/* Dimensions */}
                        <p className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">
                            Dimensions
                        </p>

                        {[
                            ['diameter', 'Diameter (mm)'],
                            ['length', 'Length (mm / m)'],
                            ['width', 'Width (mm)'],
                            ['thickness', 'Thickness (mm)'],
                            ['weight_per_unit', 'Weight per Unit (kg)'],
                        ].map(([key, label]) => (
                            <Field key={key} label={label}>
                                <input type="number" step="any" className={inputCls}
                                    value={form.material_spec_data[key]}
                                    onChange={e => setSpec(key, e.target.value)} />
                            </Field>
                        ))}

                        {/* Appearance */}
                        <p className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">
                            Appearance
                        </p>

                        <Field label="Finish" hint="e.g. galvanized, painted, rough-sawn">
                            <input className={inputCls}
                                value={form.material_spec_data.finish}
                                onChange={e => setSpec('finish', e.target.value)} />
                        </Field>

                        <Field label="Color">
                            <input className={inputCls}
                                value={form.material_spec_data.color}
                                onChange={e => setSpec('color', e.target.value)} />
                        </Field>

                        <div className="col-span-2">
                            <Field label="Technical Notes">
                                <textarea className={inputCls} rows={2}
                                    value={form.material_spec_data.notes}
                                    onChange={e => setSpec('notes', e.target.value)} />
                            </Field>
                        </div>
                    </>
                )}

                {/* Actions */}
                <div className="col-span-2 flex gap-2 justify-end pt-2 border-t">
                    <button type="button" onClick={onCancel}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={isPending}
                        className="px-4 py-2 text-sm bg-[#2E75B6] text-white rounded-md hover:bg-[#1F3864] disabled:opacity-50">
                        {isPending ? 'Saving...' : mode === 'edit' ? 'Update Item' : 'Save Item'}
                    </button>
                </div>
            </form>
        </div>
    )
}

function DeleteDialog({ item, onConfirm, onCancel, isPending }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Item</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Are you sure you want to deactivate{' '}
                    <span className="font-medium">{item.name}</span>?
                </p>
                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel}
                        className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                        Cancel
                    </button>
                    <button onClick={onConfirm} disabled={isPending}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                        {isPending ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Spec summary badge shown in the table row
function SpecBadge({ spec }) {
    if (!spec) return <span className="text-gray-300 text-xs">—</span>
    const parts = [spec.grade, spec.material_type, spec.standard].filter(Boolean)
    if (!parts.length) return <span className="text-gray-300 text-xs">—</span>
    return (
        <span className="text-xs text-[#2E75B6] bg-blue-50 px-2 py-0.5 rounded">
            {parts.join(' · ')}
        </span>
    )
}

export default function ItemsPage() {
    const queryClient = useQueryClient()
    const [mode, setMode] = useState(null)
    const [editingItem, setEditingItem] = useState(null)
    const [deletingItem, setDeletingItem] = useState(null)
    const [search, setSearch] = useState('')

    const { data, isLoading } = useQuery({
        queryKey: ['items', search],
        queryFn: () => getItems({ search }),
    })
    const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: getCategories })
    const { data: uomData } = useQuery({ queryKey: ['uoms'], queryFn: getUOMs })

    const categories = catData?.data?.results ?? catData?.data ?? []
    const uoms = uomData?.data?.results ?? uomData?.data ?? []

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['items'] })

    const createMutation = useMutation({
        mutationFn: createItem,
        onSuccess: () => { invalidate(); toast.success('Item created.'); setMode(null) },
        onError: (e) => toast.error(e?.response?.data?.sku?.[0] || 'Failed to create item.'),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => updateItem(id, data),
        onSuccess: () => {
            invalidate()
            toast.success('Item updated.')
            setMode(null); setEditingItem(null)
        },
        onError: (e) => toast.error(e?.response?.data?.sku?.[0] || 'Failed to update item.'),
    })

    const deleteMutation = useMutation({
        mutationFn: deleteItem,
        onSuccess: () => { invalidate(); toast.success('Item deactivated.'); setDeletingItem(null) },
        onError: () => toast.error('Failed to delete item.'),
    })

    const openEdit = (item) => {
        setEditingItem(item)
        setMode('edit')
    }
    const closeForm = () => { setMode(null); setEditingItem(null) }

    const items = data?.data?.results ?? []

    return (
        <div>
            {deletingItem && (
                <DeleteDialog item={deletingItem}
                    onConfirm={() => deleteMutation.mutate(deletingItem.id)}
                    onCancel={() => setDeletingItem(null)}
                    isPending={deleteMutation.isPending} />
            )}

            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-[#1F3864]">Inventory Items</h1>
                {mode === null && (
                    <button onClick={() => setMode('create')}
                        className="bg-[#2E75B6] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#1F3864] transition">
                        + Add Item
                    </button>
                )}
            </div>

            {mode === 'create' && (
                <ItemForm initial={EMPTY_FORM} onSubmit={d => createMutation.mutate(d)}
                    onCancel={closeForm} isPending={createMutation.isPending}
                    mode="create" categories={categories} uoms={uoms} />
            )}

            {mode === 'edit' && editingItem && (
                <ItemForm
                    initial={{
                        name: editingItem.name,
                        sku: editingItem.sku,
                        description: editingItem.description,
                        reorder_point: editingItem.reorder_point,
                        standard_cost: editingItem.standard_cost,
                        category: editingItem.category ?? '',
                        uom: editingItem.uom ?? '',
                        material_spec_data: editingItem.material_spec ?? EMPTY_FORM.material_spec_data,
                    }}
                    onSubmit={d => updateMutation.mutate({ id: editingItem.id, data: d })}
                    onCancel={closeForm} isPending={updateMutation.isPending}
                    mode="edit" categories={categories} uoms={uoms} />
            )}

            <div className="bg-white rounded-lg shadow-sm">
                <div className="p-4 border-b">
                    <input type="text" placeholder="Search items..."
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                        value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                {isLoading ? (
                    <div className="p-8 text-center text-gray-400">Loading...</div>
                ) : items.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        {search ? `No results for "${search}"` : 'No items yet.'}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1F3864] text-white">
                                    <th className="text-left px-4 py-3">SKU</th>
                                    <th className="text-left px-4 py-3">Name</th>
                                    <th className="text-left px-4 py-3">Spec</th>
                                    <th className="text-left px-4 py-3">UOM</th>
                                    <th className="text-left px-4 py-3">Current Qty</th>
                                    <th className="text-left px-4 py-3">Reorder</th>
                                    <th className="text-left px-4 py-3">Cost</th>
                                    <th className="text-left px-4 py-3">Status</th>
                                    <th className="text-left px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, i) => (
                                    <tr key={item.id}
                                        className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition`}>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                                        <td className="px-4 py-3 font-medium">{item.name}</td>
                                        <td className="px-4 py-3"><SpecBadge spec={item.material_spec} /></td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {item.uom_abbreviation || '—'}
                                        </td>
                                        <td className="px-4 py-3">{Number(item.current_quantity).toFixed(2)}</td>
                                        <td className="px-4 py-3">{item.reorder_point}</td>
                                        <td className="px-4 py-3">₱{Number(item.standard_cost).toFixed(2)}</td>
                                        <td className="px-4 py-3">
                                            {Number(item.current_quantity) <= 0 ? (
                                                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-1 rounded">OUT OF STOCK</span>
                                            ) : Number(item.current_quantity) <= item.reorder_point ? (
                                                <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded">LOW STOCK</span>
                                            ) : (
                                                <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">IN STOCK</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => openEdit(item)}
                                                    className="text-[#2E75B6] hover:text-[#1F3864]" title="Edit">
                                                    <Pencil size={14} />
                                                </button>
                                                <button onClick={() => setDeletingItem(item)}
                                                    className="text-red-400 hover:text-red-600" title="Delete">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
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