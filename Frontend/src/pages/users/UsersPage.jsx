import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/v1";

function getToken() {
    return localStorage.getItem("access_token") || "";
}

function getCurrentUser() {
    try {
        const payload = getToken().split(".")[1];
        return JSON.parse(atob(payload));
    } catch {
        return {};
    }
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
        throw new Error(err.detail || Object.values(err).flat().join(" ") || "Request failed");
    }
    if (res.status === 204) return null;
    return res.json();
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

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

function ConfirmModal({ title = "Confirm", message, onConfirm, onCancel, danger = true }) {
    return (
        <Modal title={title} onClose={onCancel}>
            <p className="text-sm text-gray-600 mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
                <button onClick={onCancel}
                    className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button onClick={onConfirm}
                    className={`px-4 py-2 rounded-lg text-sm text-white font-medium transition-colors ${danger ? "bg-red-600 hover:bg-red-500" : "bg-violet-600 hover:bg-violet-500"
                        }`}>
                    Confirm
                </button>
            </div>
        </Modal>
    );
}

function Input({ label, required, ...props }) {
    return (
        <div className="space-y-1.5">
            {label && (
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {label}{required && <span className="text-red-400 ml-1">*</span>}
                </label>
            )}
            <input {...props}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#2E75B6] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/20 transition-colors" />
        </div>
    );
}

function Select({ label, required, children, ...props }) {
    return (
        <div className="space-y-1.5">
            {label && (
                <label className="block text-xs font-medium text-gray-600 uppercase tracking-wider">
                    {label}{required && <span className="text-red-400 ml-1">*</span>}
                </label>
            )}
            <select {...props}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#2E75B6] focus:outline-none focus:ring-2 focus:ring-[#2E75B6]/20 transition-colors">
                {children}
            </select>
        </div>
    );
}

function FormError({ error }) {
    if (!error) return null;
    return <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 border border-red-200">{error}</p>;
}

function Spinner() {
    return (
        <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#2E75B6] border-t-transparent" />
        </div>
    );
}

function Avatar({ name, size = "md" }) {
    const initials = name
        ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
        : "?";
    const colors = [
        "bg-[#2E75B6]", "bg-[#1F3864]", "bg-[#3E7CB1]",
        "bg-[#5B8FB9]", "bg-[#4A6FA5]", "bg-[#2C5282]",
    ];
    const color = colors[name?.charCodeAt(0) % colors.length || 0];
    const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base" };
    return (
        <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center font-semibold text-white shrink-0`}>
            {initials}
        </div>
    );
}

// ─── Role Badge ───────────────────────────────────────────────────────────────

const ROLE_META = {
    SYSTEM_ADMIN: { label: "System Admin", color: "text-[#1F3864] bg-blue-50 border-blue-200" },
    PURCHASING_MANAGER: { label: "Purchasing Manager", color: "text-[#2E75B6] bg-sky-50 border-sky-200" },
    WAREHOUSE_STAFF: { label: "Warehouse Staff", color: "text-green-700 bg-green-50 border-green-200" },
};

function RoleBadge({ role }) {
    const meta = ROLE_META[role] || { label: role, color: "text-gray-700 bg-gray-100 border-gray-200" };
    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.color}`}>
            {meta.label}
        </span>
    );
}

// ─── Create / Edit User Modal ─────────────────────────────────────────────────

function UserForm({ initial, currentUserRole, onSave, onCancel }) {
    const isAdmin = currentUserRole === "SYSTEM_ADMIN";
    const isEditing = !!initial?.id;

    const [form, setForm] = useState({
        username: initial?.username || "",
        email: initial?.email || "",
        first_name: initial?.first_name || "",
        last_name: initial?.last_name || "",
        phone: initial?.phone || "",
        role: initial?.role || "WAREHOUSE_STAFF",
        password: "",
    });
    const [error, setSaving] = useState("");
    const [saving, setSavingState] = useState(false);

    // Managers are locked to creating WAREHOUSE_STAFF
    const availableRoles = isAdmin
        ? Object.entries(ROLE_META).map(([v, m]) => ({ value: v, label: m.label }))
        : [{ value: "WAREHOUSE_STAFF", label: "Warehouse Staff" }];

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.username || !form.email) { setSaving("Username and email are required."); return; }
        if (!isEditing && form.password.length < 10) {
            setSaving("Password must be at least 10 characters."); return;
        }
        setSavingState(true);
        try {
            const body = { ...form };
            if (isEditing) delete body.password; // password has its own endpoint
            const method = isEditing ? "PATCH" : "POST";
            const url = isEditing ? `/users/${initial.id}/` : "/users/";
            const data = await apiFetch(url, { method, body: JSON.stringify(body) });
            onSave(data);
        } catch (err) {
            setSaving(err.message);
        } finally {
            setSavingState(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <Input label="First Name" value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                <Input label="Last Name" value={form.last_name}
                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
            <Input label="Username" required value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            <Input label="Email" required type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Phone" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+63 9xx xxx xxxx" />
            <Select label="Role" required value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                disabled={!isAdmin && isEditing}>
                {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
            {!isEditing && (
                <Input label="Password" required type="password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min. 10 characters" />
            )}
            <FormError error={error} />
            <div className="flex gap-3 justify-end pt-1">
                <button type="button" onClick={onCancel}
                    className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                </button>
                <button type="submit" disabled={saving}
                    className="px-4 py-2 rounded-md bg-[#2E75B6] text-sm text-white font-medium hover:bg-[#1F3864] disabled:opacity-50 transition-colors">
                    {saving ? "Saving…" : isEditing ? "Update User" : "Create User"}
                </button>
            </div>
        </form>
    );
}

// ─── Change Role Modal (Admin only) ──────────────────────────────────────────

function ChangeRoleModal({ user, onSave, onCancel }) {
    const [role, setRole] = useState(user.role);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        try {
            const data = await apiFetch(`/users/${user.id}/change-role/`, {
                method: "PATCH",
                body: JSON.stringify({ role }),
            });
            onSave(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal title={`Change Role — ${user.full_name}`} onClose={onCancel}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-gray-600">Current role: <RoleBadge role={user.role} /></p>
                <Select label="New Role" value={role} onChange={e => setRole(e.target.value)}>
                    {Object.entries(ROLE_META).map(([v, m]) => (
                        <option key={v} value={v}>{m.label}</option>
                    ))}
                </Select>
                <FormError error={error} />
                <div className="flex gap-3 justify-end">
                    <button type="button" onClick={onCancel}
                        className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" disabled={saving}
                        className="px-4 py-2 rounded-md bg-[#2E75B6] text-sm text-white font-medium hover:bg-[#1F3864] disabled:opacity-50 transition-colors">
                        {saving ? "Saving…" : "Change Role"}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

// ─── Reset Password Modal (Admin only) ───────────────────────────────────────

function ResetPasswordModal({ user, onClose }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const [saving, setSaving] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (password.length < 10) { setError("Minimum 10 characters."); return; }
        setSaving(true);
        try {
            await apiFetch(`/users/${user.id}/reset-password/`, {
                method: "POST",
                body: JSON.stringify({ password }),
            });
            setDone(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal title={`Reset Password — ${user.full_name}`} onClose={onClose}>
            {done ? (
                <div className="text-center py-4">
                    <div className="text-4xl mb-3">✓</div>
                    <p className="text-sm text-green-700 font-medium">Password updated successfully.</p>
                    <button onClick={onClose}
                        className="mt-4 px-4 py-2 rounded-md bg-gray-100 text-sm text-gray-700 hover:bg-gray-200 transition-colors">
                        Close
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input label="New Password" required type="password" value={password}
                        onChange={e => setPassword(e.target.value)} placeholder="Min. 10 characters" />
                    <FormError error={error} />
                    <div className="flex gap-3 justify-end">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}
                            className="px-4 py-2 rounded-lg bg-amber-600 text-sm text-white font-medium hover:bg-amber-500 disabled:opacity-50 transition-colors">
                            {saving ? "Saving…" : "Reset Password"}
                        </button>
                    </div>
                </form>
            )}
        </Modal>
    );
}

// ─── Main Users Page ──────────────────────────────────────────────────────────

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [modal, setModal] = useState(null);
    const [page, setPage] = useState(1);
    const [count, setCount] = useState(0);
    const PAGE_SIZE = 25;

    // Derive current user's role from JWT
    const jwtPayload = getCurrentUser();
    // Note: in a real app you'd store this in Zustand; for demo we read from JWT
    // The JWT doesn't include role by default with simplejwt — adjust as needed.
    // For now we read from localStorage where we'd store it after login.
    const currentUserRole = localStorage.getItem("user_role") || "SYSTEM_ADMIN";
    const isAdmin = currentUserRole === "SYSTEM_ADMIN";
    const isManager = currentUserRole === "PURCHASING_MANAGER";

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page });
            if (search) params.set("search", search);
            if (roleFilter) params.set("role", roleFilter);
            const data = await apiFetch(`/users/?${params}`);
            setUsers(data.results || data);
            setCount(data.count || (data.results || data).length);
        } catch { /* empty */ }
        setLoading(false);
    }, [search, roleFilter, page]);

    useEffect(() => { load(); }, [load]);

    // Debounce search
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    function formatDate(ts) {
        if (!ts) return "—";
        return new Date(ts).toLocaleDateString("en-PH", {
            month: "short", day: "numeric", year: "numeric",
        });
    }

    return (
        <div>
            <div>

                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#1F3864]">Users</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {isAdmin ? "Manage all accounts and roles." : "Manage warehouse staff accounts."}
                        </p>
                    </div>
                    <button onClick={() => setModal("create")}
                        className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#2E75B6] text-sm text-white font-medium hover:bg-[#1F3864] transition-colors">
                        <span className="text-base leading-none">+</span> Add User
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-6 bg-white rounded-lg shadow-sm p-4">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                        <input value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            placeholder="Search by name or email…"
                            className="pl-8 pr-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:border-[#2E75B6] focus:outline-none w-64 transition-colors" />
                    </div>

                    {isAdmin && (
                        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[#2E75B6] focus:outline-none">
                            <option value="">All Roles</option>
                            {Object.entries(ROLE_META).map(([v, m]) => (
                                <option key={v} value={v}>{m.label}</option>
                            ))}
                        </select>
                    )}

                    <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
                        <span>{count} user{count !== 1 ? "s" : ""}</span>
                    </div>
                </div>

                {/* Table */}
                {loading ? <Spinner /> : (
                    <>
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            {users.length === 0 ? (
                                <div className="py-16 text-center text-gray-500">
                                    <div className="text-4xl mb-3">👤</div>
                                    <p className="text-sm">No users found.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-[#1F3864] text-white">
                                            <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">User</th>
                                            <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Role</th>
                                            <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Joined</th>
                                            <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Last Login</th>
                                            <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user, i) => (
                                            <tr key={user.id}
                                                className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar name={user.full_name} size="sm" />
                                                        <div>
                                                            <div className="font-medium text-gray-900">{user.full_name}</div>
                                                            <div className="text-xs text-gray-500">{user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5"><RoleBadge role={user.role} /></td>
                                                <td className="px-5 py-3.5 text-gray-600 text-xs font-mono">{formatDate(user.date_joined)}</td>
                                                <td className="px-5 py-3.5 text-gray-600 text-xs font-mono">{formatDate(user.last_login)}</td>
                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${user.is_active ? "text-green-700" : "text-gray-500"
                                                        }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${user.is_active ? "bg-green-600" : "bg-gray-400"}`} />
                                                        {user.is_active ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-1.5 justify-end flex-wrap">
                                                        <button onClick={() => setModal({ edit: user })}
                                                            className="px-2.5 py-1 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-100 transition-colors">
                                                            Edit
                                                        </button>
                                                        {isAdmin && (
                                                            <>
                                                                <button onClick={() => setModal({ changeRole: user })}
                                                                    className="px-2.5 py-1 rounded border border-blue-300 text-xs text-[#1F3864] hover:bg-blue-50 transition-colors">
                                                                    Role
                                                                </button>
                                                                <button onClick={() => setModal({ resetPw: user })}
                                                                    className="px-2.5 py-1 rounded border border-amber-300 text-xs text-amber-700 hover:bg-amber-50 transition-colors">
                                                                    Password
                                                                </button>
                                                                <button onClick={() => setModal({ delete: user })}
                                                                    className="px-2.5 py-1 rounded border border-red-900/60 text-xs text-red-400 hover:bg-red-900/20 transition-colors">
                                                                    Delete
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
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

            {/* Modals */}
            {modal === "create" && (
                <Modal title="Add New User" onClose={() => setModal(null)}>
                    <UserForm currentUserRole={currentUserRole}
                        onSave={() => { setModal(null); load(); }}
                        onCancel={() => setModal(null)} />
                </Modal>
            )}
            {modal?.edit && (
                <Modal title="Edit User" onClose={() => setModal(null)}>
                    <UserForm initial={modal.edit} currentUserRole={currentUserRole}
                        onSave={() => { setModal(null); load(); }}
                        onCancel={() => setModal(null)} />
                </Modal>
            )}
            {modal?.changeRole && (
                <ChangeRoleModal user={modal.changeRole}
                    onSave={() => { setModal(null); load(); }}
                    onCancel={() => setModal(null)} />
            )}
            {modal?.resetPw && (
                <ResetPasswordModal user={modal.resetPw} onClose={() => setModal(null)} />
            )}
            {modal?.delete && (
                <ConfirmModal
                    title="Delete User"
                    message={`Permanently deactivate "${modal.delete.full_name}"? They will no longer be able to log in.`}
                    onConfirm={async () => {
                        try {
                            await apiFetch(`/users/${modal.delete.id}/`, { method: "DELETE" });
                            setModal(null);
                            load();
                        } catch (err) { alert(err.message); }
                    }}
                    onCancel={() => setModal(null)}
                />
            )}
        </div>
    );
}