import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/v1";

function getToken() {
    return localStorage.getItem("access_token") || "";
}

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Request failed");
    }
    if (res.status === 204) return null;
    return res.json();
}

// ─── Reusable components ──────────────────────────────────────────────────────

function Badge({ children, color = "gray" }) {
    const colors = {
        gray: "bg-gray-100 text-gray-700",
        violet: "bg-blue-50 text-[#1F3864]",
        amber: "bg-amber-50 text-amber-700",
        green: "bg-green-50 text-green-700",
        blue: "bg-sky-50 text-[#2E75B6]",
        red: "bg-red-50 text-red-700",
    };
    return (
        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono font-medium ${colors[color]}`}>
            {children}
        </span>
    );
}

function Spinner() {
    return (
        <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2E75B6] border-t-transparent" />
        </div>
    );
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                    <h3 className="text-base font-semibold text-[#1F3864]">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none">×</button>
                </div>
                <div className="px-6 py-5">{children}</div>
            </div>
        </div>
    );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
    return (
        <Modal title="Confirm Delete" onClose={onCancel}>
            <p className="text-sm text-gray-600 mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
                <button onClick={onCancel}
                    className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button onClick={onConfirm}
                    className="px-4 py-2 rounded-lg bg-red-600 text-sm text-white font-medium hover:bg-red-500 transition-colors">
                    Delete
                </button>
            </div>
        </Modal>
    );
}

function Input({ label, ...props }) {
    return (
        <div className="space-y-1.5">
            {label && <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider">{label}</label>}
            <input
                {...props}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#2E75B6] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/20 transition-colors"
            />
        </div>
    );
}

function Select({ label, children, ...props }) {
    return (
        <div className="space-y-1.5">
            {label && <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider">{label}</label>}
            <select
                {...props}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2E75B6] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/20 transition-colors"
            >
                {children}
            </select>
        </div>
    );
}

function Textarea({ label, ...props }) {
    return (
        <div className="space-y-1.5">
            {label && <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider">{label}</label>}
            <textarea
                {...props}
                rows={3}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#2E75B6] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/20 transition-colors resize-none"
            />
        </div>
    );
}

function FormError({ error }) {
    if (!error) return null;
    return <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 border border-red-200">{error}</p>;
}

// ─── Categories Panel ─────────────────────────────────────────────────────────

function CategoryForm({ initial, onSave, onCancel }) {
    const [form, setForm] = useState(initial || { name: "", description: "" });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) { setError("Name is required."); return; }
        setSaving(true);
        try {
            const method = initial?.id ? "PATCH" : "POST";
            const url = initial?.id ? `/categories/${initial.id}/` : "/categories/";
            const data = await apiFetch(url, { method, body: JSON.stringify(form) });
            onSave(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Category Name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Cement, Steel, Lumber" />
            <Textarea label="Description (optional)" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of this category" />
            <FormError error={error} />
            <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={onCancel}
                    className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
                    Cancel
                </button>
                <button type="submit" disabled={saving}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-sm text-white font-medium hover:bg-violet-500 disabled:opacity-50 transition-colors">
                    {saving ? "Saving…" : initial?.id ? "Update Category" : "Add Category"}
                </button>
            </div>
        </form>
    );
}

function CategoriesPanel() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | 'add' | {edit: item} | {delete: item}

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch("/categories/");
            setCategories(data.results || data);
        } catch { /* empty */ }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    function handleSaved(item) {
        setModal(null);
        load();
    }

    async function handleDelete(item) {
        try {
            await apiFetch(`/categories/${item.id}/`, { method: "DELETE" });
            setModal(null);
            load();
        } catch (err) {
            alert(err.message);
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-lg font-semibold text-[#1F3864]">Material Categories</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Organise inventory items into logical groups.</p>
                </div>
                <button onClick={() => setModal("add")}
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#2E75B6] text-sm text-white font-medium hover:bg-[#1F3864] transition-colors">
                    <span className="text-lg leading-none">+</span> Add Category
                </button>
            </div>

            {loading ? <Spinner /> : (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {categories.length === 0 ? (
                        <div className="py-12 text-center text-gray-500 text-sm">No categories yet. Add your first one.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1F3864] text-white">
                                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Name</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Description</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((cat, i) => (
                                    <tr key={cat.id}
                                        className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <td className="px-5 py-3.5 font-medium text-gray-900">{cat.name}</td>
                                        <td className="px-5 py-3.5 text-gray-600">{cat.description || <span className="text-gray-400 italic">—</span>}</td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2 justify-end">
                                                <button onClick={() => setModal({ edit: cat })}
                                                    className="px-3 py-1 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 transition-colors">
                                                    Edit
                                                </button>
                                                <button onClick={() => setModal({ delete: cat })}
                                                    className="px-3 py-1 rounded-md border border-red-900/60 text-xs text-red-400 hover:bg-red-900/20 transition-colors">
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {modal === "add" && (
                <Modal title="Add Category" onClose={() => setModal(null)}>
                    <CategoryForm onSave={handleSaved} onCancel={() => setModal(null)} />
                </Modal>
            )}
            {modal?.edit && (
                <Modal title="Edit Category" onClose={() => setModal(null)}>
                    <CategoryForm initial={modal.edit} onSave={handleSaved} onCancel={() => setModal(null)} />
                </Modal>
            )}
            {modal?.delete && (
                <ConfirmModal
                    message={`Delete category "${modal.delete.name}"? This cannot be undone.`}
                    onConfirm={() => handleDelete(modal.delete)}
                    onCancel={() => setModal(null)}
                />
            )}
        </div>
    );
}

// ─── Units of Measurement Panel ───────────────────────────────────────────────

const UOM_TYPES = [
    { value: "WEIGHT", label: "Weight" },
    { value: "VOLUME", label: "Volume" },
    { value: "LENGTH", label: "Length" },
    { value: "AREA", label: "Area" },
    { value: "COUNT", label: "Count" },
    { value: "OTHER", label: "Other" },
];

const UOM_COLORS = {
    WEIGHT: "amber", VOLUME: "blue", LENGTH: "green",
    AREA: "violet", COUNT: "gray", OTHER: "gray",
};

function UOMForm({ initial, onSave, onCancel }) {
    const [form, setForm] = useState(initial || { name: "", abbreviation: "", unit_type: "COUNT" });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim() || !form.abbreviation.trim()) {
            setError("Name and abbreviation are required."); return;
        }
        setSaving(true);
        try {
            const method = initial?.id ? "PATCH" : "POST";
            const url = initial?.id ? `/uom/${initial.id}/` : "/uom/";
            const data = await apiFetch(url, { method, body: JSON.stringify(form) });
            onSave(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Unit Name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kilogram, Cubic Meter, Piece" />
            <Input label="Abbreviation" value={form.abbreviation}
                onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))}
                placeholder="e.g. kg, m³, pc" />
            <Select label="Unit Type" value={form.unit_type}
                onChange={e => setForm(f => ({ ...f, unit_type: e.target.value }))}>
                {UOM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <FormError error={error} />
            <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={onCancel}
                    className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors">
                    Cancel
                </button>
                <button type="submit" disabled={saving}
                    className="px-4 py-2 rounded-lg bg-violet-600 text-sm text-white font-medium hover:bg-violet-500 disabled:opacity-50 transition-colors">
                    {saving ? "Saving…" : initial?.id ? "Update Unit" : "Add Unit"}
                </button>
            </div>
        </form>
    );
}

function UOMPanel() {
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [filter, setFilter] = useState("ALL");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = filter !== "ALL" ? `?unit_type=${filter}` : "";
            const data = await apiFetch(`/uom/${params}`);
            setUnits(data.results || data);
        } catch { /* empty */ }
        setLoading(false);
    }, [filter]);

    useEffect(() => { load(); }, [load]);

    async function handleDelete(item) {
        try {
            await apiFetch(`/uom/${item.id}/`, { method: "DELETE" });
            setModal(null);
            load();
        } catch (err) {
            alert(err.message);
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-lg font-semibold text-[#1F3864]">Units of Measurement</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Define units used across inventory items.</p>
                </div>
                <button onClick={() => setModal("add")}
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#2E75B6] text-sm text-white font-medium hover:bg-[#1F3864] transition-colors">
                    <span className="text-lg leading-none">+</span> Add Unit
                </button>
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-2 mb-4">
                {["ALL", ...UOM_TYPES.map(t => t.value)].map(v => (
                    <button key={v} onClick={() => setFilter(v)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === v
                            ? "bg-[#2E75B6] text-white"
                            : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-300"
                            }`}>
                        {v === "ALL" ? "All Types" : v.charAt(0) + v.slice(1).toLowerCase()}
                    </button>
                ))}
            </div>

            {loading ? <Spinner /> : (
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {units.length === 0 ? (
                        <div className="py-12 text-center text-gray-500 text-sm">No units found.</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#1F3864] text-white">
                                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Name</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Abbreviation</th>
                                    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Type</th>
                                    <th className="px-5 py-3" />
                                </tr>
                            </thead>
                            <tbody>
                                {units.map((unit, i) => (
                                    <tr key={unit.id}
                                        className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                        <td className="px-5 py-3.5 font-medium text-gray-900">{unit.name}</td>
                                        <td className="px-5 py-3.5">
                                            <span className="font-mono text-[#2E75B6] text-sm">{unit.abbreviation}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <Badge color={UOM_COLORS[unit.unit_type] || "gray"}>
                                                {unit.unit_type}
                                            </Badge>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2 justify-end">
                                                <button onClick={() => setModal({ edit: unit })}
                                                    className="px-3 py-1 rounded-md border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 transition-colors">
                                                    Edit
                                                </button>
                                                <button onClick={() => setModal({ delete: unit })}
                                                    className="px-3 py-1 rounded-md border border-red-900/60 text-xs text-red-400 hover:bg-red-900/20 transition-colors">
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {modal === "add" && (
                <Modal title="Add Unit of Measurement" onClose={() => setModal(null)}>
                    <UOMForm onSave={() => { setModal(null); load(); }} onCancel={() => setModal(null)} />
                </Modal>
            )}
            {modal?.edit && (
                <Modal title="Edit Unit" onClose={() => setModal(null)}>
                    <UOMForm initial={modal.edit}
                        onSave={() => { setModal(null); load(); }}
                        onCancel={() => setModal(null)} />
                </Modal>
            )}
            {modal?.delete && (
                <ConfirmModal
                    message={`Delete unit "${modal.delete.name} (${modal.delete.abbreviation})"? Items using this unit will lose their UOM reference.`}
                    onConfirm={() => handleDelete(modal.delete)}
                    onCancel={() => setModal(null)}
                />
            )}
        </div>
    );
}

// ─── Audit Log Panel ──────────────────────────────────────────────────────────

const ACTION_COLORS = { CREATE: "green", UPDATE: "amber", DELETE: "red" };

function AuditLogPanel() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({ resource_type: "", action: "" });
    const [page, setPage] = useState(1);
    const [count, setCount] = useState(0);
    const PAGE_SIZE = 25;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page });
            if (filter.resource_type) params.set("resource_type", filter.resource_type);
            if (filter.action) params.set("action", filter.action);
            const data = await apiFetch(`/audit-logs/?${params}`);
            setLogs(data.results || data);
            setCount(data.count || (data.results || data).length);
        } catch { /* empty */ }
        setLoading(false);
    }, [filter, page]);

    useEffect(() => { load(); }, [load]);

    function formatDate(ts) {
        return new Date(ts).toLocaleString("en-PH", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    }

    return (
        <div>
            <div className="mb-5">
                <h2 className="text-lg font-semibold text-[#1F3864]">Audit Trail</h2>
                <p className="text-sm text-gray-500 mt-0.5">Immutable log of all configuration changes.</p>
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
                <select value={filter.resource_type}
                    onChange={e => { setFilter(f => ({ ...f, resource_type: e.target.value })); setPage(1); }}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-[#2E75B6] focus:outline-none">
                    <option value="">All Resources</option>
                    <option value="Category">Category</option>
                    <option value="UnitOfMeasure">Unit of Measure</option>
                    <option value="User">User</option>
                </select>
                <select value={filter.action}
                    onChange={e => { setFilter(f => ({ ...f, action: e.target.value })); setPage(1); }}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-[#2E75B6] focus:outline-none">
                    <option value="">All Actions</option>
                    <option value="CREATE">Created</option>
                    <option value="UPDATE">Updated</option>
                    <option value="DELETE">Deleted</option>
                </select>
            </div>

            {loading ? <Spinner /> : (
                <>
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        {logs.length === 0 ? (
                            <div className="py-12 text-center text-gray-500 text-sm">No audit records found.</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-[#1F3864] text-white">
                                        <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Timestamp</th>
                                        <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">User</th>
                                        <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Action</th>
                                        <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Resource</th>
                                        <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Name</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log, i) => (
                                        <tr key={log.id}
                                            className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            <td className="px-5 py-3 text-gray-600 font-mono text-xs">{formatDate(log.timestamp)}</td>
                                            <td className="px-5 py-3 text-gray-800">{log.performed_by_name}</td>
                                            <td className="px-5 py-3">
                                                <Badge color={ACTION_COLORS[log.action] || "gray"}>{log.action}</Badge>
                                            </td>
                                            <td className="px-5 py-3 text-gray-600">{log.resource_type}</td>
                                            <td className="px-5 py-3 text-gray-800 font-medium">{log.resource_name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {count > PAGE_SIZE && (
                        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
                            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} of {count}</span>
                            <div className="flex gap-2">
                                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                    className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                                    ← Prev
                                </button>
                                <button disabled={page * PAGE_SIZE >= count} onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40 transition-colors">
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// ─── Pending Requests Panel ──────────────────────────────────────────────────

const REQUEST_STATUS_COLORS = {
    PENDING: "amber",
    APPROVED: "green",
    REJECTED: "red",
};

function PendingRequestsPanel() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [supplierRequests, setSupplierRequests] = useState([]);
    const [clientRequests, setClientRequests] = useState([]);
    const [statusFilter, setStatusFilter] = useState("PENDING");
    const [error, setError] = useState("");

    const normalize = (data) => data?.results || data || [];

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const query = statusFilter ? `?status=${statusFilter}` : "";
            const [supplierData, clientData] = await Promise.all([
                apiFetch(`/supplier-requests/${query}`),
                apiFetch(`/client-requests/${query}`),
            ]);
            setSupplierRequests(normalize(supplierData));
            setClientRequests(normalize(clientData));
        } catch (err) {
            setError(err.message || "Failed to load pending requests.");
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { load(); }, [load]);

    async function handleReview(type, req, action) {
        const note = window.prompt(
            `${action === "approve" ? "Approve" : "Reject"} request for ${req.name}.\nOptional review note:`
        );
        if (note === null) return;

        setSubmitting(true);
        setError("");
        try {
            const base = type === "supplier" ? "supplier-requests" : "client-requests";
            await apiFetch(`/${base}/${req.id}/${action}/`, {
                method: "POST",
                body: JSON.stringify({ review_note: note || "" }),
            });
            await load();
        } catch (err) {
            setError(err.message || "Failed to process request.");
        } finally {
            setSubmitting(false);
        }
    }

    const total = supplierRequests.length + clientRequests.length;

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h2 className="text-lg font-semibold text-[#1F3864]">Pending Requests</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Review manager-submitted supplier and client master data requests.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-[#2E75B6] focus:outline-none"
                    >
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="">All</option>
                    </select>
                    <button
                        onClick={load}
                        className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {error && <FormError error={error} />}

            {loading ? <Spinner /> : (
                <>
                    <div className="mb-4 text-sm text-gray-600">
                        Showing <span className="font-semibold text-[#1F3864]">{total}</span> request{total === 1 ? "" : "s"}
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-[#1F3864] mb-2">Supplier Requests</h3>
                            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                {supplierRequests.length === 0 ? (
                                    <div className="py-10 text-center text-sm text-gray-500">No supplier requests found.</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-[#1F3864] text-white">
                                                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider">Name</th>
                                                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider">Contact</th>
                                                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider">Requested By</th>
                                                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {supplierRequests.map((req, i) => (
                                                <tr key={`supplier-${req.id}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900">{req.name}</div>
                                                        <div className="text-xs text-gray-500">{req.email || "No email"}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">{req.contact_name || req.phone || "-"}</td>
                                                    <td className="px-4 py-3 text-gray-600">{req.requested_by_name || "System"}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge color={REQUEST_STATUS_COLORS[req.status] || "gray"}>{req.status}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {req.status === "PENDING" && (
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    disabled={submitting}
                                                                    onClick={() => handleReview("supplier", req, "approve")}
                                                                    className="px-2.5 py-1 rounded border border-green-300 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    disabled={submitting}
                                                                    onClick={() => handleReview("supplier", req, "reject")}
                                                                    className="px-2.5 py-1 rounded border border-red-300 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-[#1F3864] mb-2">Client Requests</h3>
                            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                {clientRequests.length === 0 ? (
                                    <div className="py-10 text-center text-sm text-gray-500">No client requests found.</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-[#1F3864] text-white">
                                                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider">Name</th>
                                                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider">Contact</th>
                                                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider">Requested By</th>
                                                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clientRequests.map((req, i) => (
                                                <tr key={`client-${req.id}`} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-900">{req.name}</div>
                                                        <div className="text-xs text-gray-500">{req.email || "No email"}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-600">{req.contact_name || req.phone || "-"}</td>
                                                    <td className="px-4 py-3 text-gray-600">{req.requested_by_name || "System"}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge color={REQUEST_STATUS_COLORS[req.status] || "gray"}>{req.status}</Badge>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {req.status === "PENDING" && (
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    disabled={submitting}
                                                                    onClick={() => handleReview("client", req, "approve")}
                                                                    className="px-2.5 py-1 rounded border border-green-300 text-xs text-green-700 hover:bg-green-50 disabled:opacity-50"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    disabled={submitting}
                                                                    onClick={() => handleReview("client", req, "reject")}
                                                                    className="px-2.5 py-1 rounded border border-red-300 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

const TABS = [
    { id: "categories", label: "Material Categories", icon: "" },
    { id: "uom", label: "Units of Measurement", icon: "" },
    { id: "requests", label: "Pending Requests", icon: "" },
    { id: "audit", label: "Audit Trail", icon: "" },
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState("categories");

    return (
        <div>
            <div>

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-[#1F3864]">Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        System configuration — Admin access only.
                    </p>
                </div>

                <div className="flex gap-6 flex-col lg:flex-row">
                    {/* Sidebar tabs */}
                    <nav className="w-full lg:w-56 shrink-0">
                        <ul className="space-y-2 bg-white rounded-lg shadow-sm p-3">
                            {TABS.map(tab => (
                                <li key={tab.id}>
                                    <button onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${activeTab === tab.id
                                            ? "bg-blue-50 text-[#1F3864] border border-blue-200"
                                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                            }`}>
                                        <span>{tab.icon}</span>
                                        {tab.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="p-0">
                            {activeTab === "categories" && <CategoriesPanel />}
                            {activeTab === "uom" && <UOMPanel />}
                            {activeTab === "requests" && <PendingRequestsPanel />}
                            {activeTab === "audit" && <AuditLogPanel />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}