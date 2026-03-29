import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
    getStockLevels, getLowStock, getStockMovement, getProjectAllocation,
    getSupplierPOHistory, getSupplierSpend, getSupplierLeadTimes, getSupplierPerformance,
    getClientSOHistory, getClientRevenue, getClientMaterialUsage, getClientOutstandingOrders,
    getUserPOActivity, getUserRoleChanges, getUserAccountActivity, getAuditLogReport,
} from '../../api/reports'
import { useAuthStore } from '../../store/authstore'
import {
    BarChart2, Package, AlertTriangle, TrendingUp, Truck,
    Users, FileText, Clock, Star, ShoppingCart,
    DollarSign, Layers, Shield, Activity, ChevronDown,
} from 'lucide-react'

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const BLUE_PALETTE = ['#1F3864', '#2E75B6', '#4A90C4', '#7EB8D8', '#B8D8ED']
const STATUS_COLORS = {
    DRAFT: '#9CA3AF',
    CONFIRMED: '#3B82F6',
    APPROVED: '#8B5CF6',
    DISPATCHED: '#F59E0B',
    DELIVERED: '#10B981',
    CANCELLED: '#EF4444',
    RECEIVED: '#10B981',
    PARTIALLY: '#F59E0B',
    REJECTED: '#EF4444',
    SUBMITTED: '#3B82F6',
    ACCEPTED: '#10B981',
    PENDING: '#F59E0B',
}

const TABS = [
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'clients', label: 'Clients', icon: ShoppingCart },
    { id: 'users', label: 'User Activity', icon: Shield, adminOnly: true },
]

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------

function fmt(n, decimals = 0) {
    return Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPeso(n) {
    return '₱' + fmt(n, 2)
}

function getDefaultDateFrom() {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
}

function getDefaultDateTo() {
    return new Date().toISOString().split('T')[0]
}

// ------------------------------------------------------------------
// Reusable UI atoms
// ------------------------------------------------------------------

function Card({ children, className = '' }) {
    return (
        <div className={`bg-white rounded-lg shadow-sm p-5 ${className}`}>
            {children}
        </div>
    )
}

function SectionTitle({ icon: Icon, title, subtitle }) {
    return (
        <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-[#1F3864] flex items-center justify-center shrink-0">
                <Icon size={16} className="text-white" />
            </div>
            <div>
                <h2 className="text-base font-bold text-[#1F3864]">{title}</h2>
                {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    )
}

function StatTile({ label, value, sub, color = 'blue' }) {
    const colors = {
        blue: 'border-t-[#2E75B6]',
        green: 'border-t-green-500',
        red: 'border-t-red-500',
        amber: 'border-t-amber-500',
    }
    return (
        <div className={`bg-white rounded-lg shadow-sm p-4 border-t-4 ${colors[color]}`}>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-[#1F3864] mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    )
}

function LoadingBlock() {
    return (
        <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Loading...
        </div>
    )
}

function EmptyBlock({ message = 'No data available.' }) {
    return (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            {message}
        </div>
    )
}

function DateRangeFilter({ dateFrom, dateTo, onChangeDateFrom, onChangeDateTo }) {
    return (
        <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg shadow-sm px-4 py-3 mb-5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date range</span>
            <div className="flex items-center gap-2">
                <input
                    type="date"
                    value={dateFrom}
                    onChange={e => onChangeDateFrom(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                    type="date"
                    value={dateTo}
                    onChange={e => onChangeDateTo(e.target.value)}
                    className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E75B6]"
                />
            </div>
        </div>
    )
}

function StatusPill({ status }) {
    const color = STATUS_COLORS[status] || '#9CA3AF'
    return (
        <span
            className="text-xs font-semibold px-2 py-0.5 rounded"
            style={{ backgroundColor: color + '22', color }}
        >
            {status}
        </span>
    )
}

function SimpleTable({ columns, rows, emptyMessage }) {
    if (!rows || rows.length === 0) return <EmptyBlock message={emptyMessage} />
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-[#1F3864] text-white">
                        {columns.map(col => (
                            <th
                                key={col.key}
                                className={`px-3 py-2 text-xs font-medium uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {columns.map(col => (
                                <td
                                    key={col.key}
                                    className={`px-3 py-2.5 ${col.align === 'right' ? 'text-right' : ''} ${col.className || ''}`}
                                >
                                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// ------------------------------------------------------------------
// INVENTORY TAB
// ------------------------------------------------------------------

function InventoryTab({ dateFrom, dateTo }) {
    const { data: stockData, isLoading: stockLoading } = useQuery({
        queryKey: ['report-stock-levels'],
        queryFn: getStockLevels,
    })

    const { data: lowData, isLoading: lowLoading } = useQuery({
        queryKey: ['report-low-stock'],
        queryFn: () => getLowStock(true),
    })

    const { data: movData, isLoading: movLoading } = useQuery({
        queryKey: ['report-stock-movement', dateFrom, dateTo],
        queryFn: () => getStockMovement({ date_from: dateFrom, date_to: dateTo }),
    })

    const { data: projData, isLoading: projLoading } = useQuery({
        queryKey: ['report-project-allocation'],
        queryFn: () => getProjectAllocation(),
    })

    const stock = stockData?.data
    const low = lowData?.data
    const mov = movData?.data
    const proj = projData?.data

    const stats = [
        {
            label: 'Total Active Items',
            value: fmt(stock?.summary?.total_items),
            icon: Package,
            bgColor: 'bg-blue-100',
            iconColor: 'text-blue-500',
            changes: [
                { text: '+3 added this week', color: 'text-green-600' },
                { text: '-2 deactivated this week', color: 'text-red-600' }
            ]
        },
        {
            label: 'Total Stock Value',
            value: fmtPeso(stock?.summary?.total_stock_value),
            icon: DollarSign,
            bgColor: 'bg-green-100',
            iconColor: 'text-green-500',
            changes: [
                { text: 'Current value', color: 'text-green-600' }
            ]
        },
        {
            label: 'Low-Stock Items',
            value: fmt(stock?.summary?.low_stock),
            icon: AlertTriangle,
            bgColor: 'bg-orange-100',
            iconColor: 'text-orange-500',
            changes: [
                { text: '+1 today', color: 'text-red-600' }
            ]
        },
        {
            label: 'Out of Stock',
            value: fmt(stock?.summary?.out_of_stock),
            icon: Truck,
            bgColor: 'bg-red-100',
            iconColor: 'text-red-500',
            changes: [
                { text: '0 today', color: 'text-gray-500' }
            ]
        },
    ]

    return (
        <div className="space-y-6">
            {/* Summary stat cards */}
            {stockLoading ? <LoadingBlock /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            )}

            {/* Previous summary tiles - commented out as replaced by flat cards above */}
            {/* Summary tiles removed - using new flat card design */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* By Category */}
                <Card>
                    <SectionTitle icon={Layers} title="Stock by Category" subtitle="Current quantity totals per category" />
                    {stockLoading ? <LoadingBlock /> : (
                        stock?.by_category?.length ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={stock.by_category} margin={{ top: 4, right: 16, left: 0, bottom: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                    <XAxis
                                        dataKey="category_name"
                                        tick={{ fontSize: 11 }}
                                        angle={-30}
                                        textAnchor="end"
                                        interval={0}
                                    />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={v => fmt(v, 2)} />
                                    <Bar dataKey="total_quantity" fill="#2E75B6" name="Total Qty" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyBlock />
                    )}
                </Card>

                {/* By UOM */}
                <Card>
                    <SectionTitle icon={Package} title="Stock by Unit of Measure" subtitle="Item count per measurement type" />
                    {stockLoading ? <LoadingBlock /> : (
                        stock?.by_uom?.length ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={stock.by_uom}
                                        dataKey="item_count"
                                        nameKey="uom_name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={90}
                                        label={({ uom_abbreviation, percent }) =>
                                            `${uom_abbreviation} ${(percent * 100).toFixed(0)}%`
                                        }
                                        labelLine={false}
                                    >
                                        {stock.by_uom.map((_, i) => (
                                            <Cell key={i} fill={BLUE_PALETTE[i % BLUE_PALETTE.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <EmptyBlock />
                    )}
                </Card>
            </div>

            {/* Low stock table */}
            <Card>
                <SectionTitle
                    icon={AlertTriangle}
                    title="Low Stock Alerts"
                    subtitle="Items at or below their reorder point"
                />
                {lowLoading ? <LoadingBlock /> : (
                    <SimpleTable
                        columns={[
                            { key: 'sku', label: 'SKU', className: 'font-mono text-xs text-gray-500' },
                            { key: 'name', label: 'Item Name', className: 'font-medium text-gray-900' },
                            { key: 'category_name', label: 'Category' },
                            { key: 'uom_abbreviation', label: 'UOM' },
                            {
                                key: 'current_quantity', label: 'Current Qty', align: 'right',
                                render: v => <span className="text-red-600 font-semibold">{fmt(v, 2)}</span>
                            },
                            { key: 'reorder_point', label: 'Reorder Point', align: 'right', render: v => fmt(v) },
                            {
                                key: 'shortage', label: 'Shortage', align: 'right',
                                render: v => <span className="text-amber-600">{fmt(v, 2)}</span>
                            },
                            {
                                key: 'estimated_reorder_cost', label: 'Est. Reorder Cost', align: 'right',
                                render: v => fmtPeso(v)
                            },
                        ]}
                        rows={low?.items || []}
                        emptyMessage="No low-stock items."
                    />
                )}
            </Card>

            {/* Stock movement */}
            <Card>
                <SectionTitle
                    icon={TrendingUp}
                    title="Stock Movement"
                    subtitle="Inbound vs outbound over the selected period"
                />
                {movLoading ? <LoadingBlock /> : (
                    <div className="space-y-5">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-green-50 rounded-lg p-3 text-center">
                                <p className="text-xs text-green-600 font-medium uppercase">Total Inbound</p>
                                <p className="text-xl font-bold text-green-700 mt-1">
                                    +{fmt(mov?.summary?.inbound, 2)}
                                </p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-3 text-center">
                                <p className="text-xs text-red-600 font-medium uppercase">Total Outbound</p>
                                <p className="text-xl font-bold text-red-700 mt-1">
                                    {fmt(mov?.summary?.outbound, 2)}
                                </p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-3 text-center">
                                <p className="text-xs text-[#2E75B6] font-medium uppercase">Net Change</p>
                                <p className="text-xl font-bold text-[#1F3864] mt-1">
                                    {fmt(mov?.summary?.net, 2)}
                                </p>
                            </div>
                        </div>

                        {mov?.monthly_trend?.length ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={mov.monthly_trend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="inbound" stroke="#10B981" strokeWidth={2} dot={false} name="Inbound" />
                                    <Line type="monotone" dataKey="outbound" stroke="#EF4444" strokeWidth={2} dot={false} name="Outbound" />
                                    <Line type="monotone" dataKey="net" stroke="#2E75B6" strokeWidth={2} dot={false} name="Net" strokeDasharray="4 4" />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : null}

                        <SimpleTable
                            columns={[
                                { key: 'transaction_type', label: 'Type', render: v => <span className="font-mono text-xs">{v}</span> },
                                { key: 'total', label: 'Net Qty', align: 'right', render: v => <span className={Number(v) >= 0 ? 'text-green-600' : 'text-red-500'}>{fmt(v, 2)}</span> },
                                { key: 'txn_count', label: 'Transactions', align: 'right', render: v => fmt(v) },
                            ]}
                            rows={mov?.by_type || []}
                        />
                    </div>
                )}
            </Card>

            {/* Project allocation */}
            <Card>
                <SectionTitle
                    icon={FileText}
                    title="Project Allocation"
                    subtitle="Materials allocated and delivered per project"
                />
                {projLoading ? <LoadingBlock /> : (
                    proj?.projects?.length ? (
                        <div className="space-y-4">
                            {proj.projects.map(p => (
                                <div key={p.project_id} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="font-semibold text-gray-900 text-sm">{p.project_name}</p>
                                            <p className="text-xs text-gray-500 font-mono">{p.project_code}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <StatusPill status={p.status} />
                                            <span className="text-sm font-bold text-[#1F3864]">{p.completion_pct}%</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                                        <div
                                            className="bg-[#2E75B6] h-2 rounded-full"
                                            style={{ width: `${Math.min(p.completion_pct, 100)}%` }}
                                        />
                                    </div>
                                    <SimpleTable
                                        columns={[
                                            { key: 'item_name', label: 'Item', className: 'font-medium' },
                                            { key: 'uom', label: 'UOM' },
                                            { key: 'allocated', label: 'Allocated', align: 'right', render: v => fmt(v, 2) },
                                            { key: 'delivered', label: 'Delivered', align: 'right', render: v => <span className="text-green-600">{fmt(v, 2)}</span> },
                                            { key: 'remaining', label: 'Remaining', align: 'right', render: v => <span className="text-amber-600">{fmt(v, 2)}</span> },
                                            { key: 'status', label: 'Status', render: v => <StatusPill status={v} /> },
                                        ]}
                                        rows={p.materials}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : <EmptyBlock message="No project allocations found." />
                )}
            </Card>
        </div>
    )
}

// ------------------------------------------------------------------
// SUPPLIERS TAB
// ------------------------------------------------------------------

function SuppliersTab({ dateFrom, dateTo }) {
    const params = { date_from: dateFrom, date_to: dateTo }

    const { data: histData, isLoading: histLoading } = useQuery({
        queryKey: ['report-supplier-po-history', dateFrom, dateTo],
        queryFn: () => getSupplierPOHistory(params),
    })

    const { data: spendData, isLoading: spendLoading } = useQuery({
        queryKey: ['report-supplier-spend', dateFrom, dateTo],
        queryFn: () => getSupplierSpend(params),
    })

    const { data: leadData, isLoading: leadLoading } = useQuery({
        queryKey: ['report-supplier-lead-times', dateFrom, dateTo],
        queryFn: () => getSupplierLeadTimes(params),
    })

    const { data: perfData, isLoading: perfLoading } = useQuery({
        queryKey: ['report-supplier-performance', dateFrom, dateTo],
        queryFn: () => getSupplierPerformance(params),
    })

    const hist = histData?.data
    const spend = spendData?.data
    const lead = leadData?.data
    const perf = perfData?.data

    return (
        <div className="space-y-6">
            {/* PO History summary */}
            <Card>
                <SectionTitle
                    icon={FileText}
                    title="Purchase Order History"
                    subtitle="Accepted, rejected, and cancelled POs per supplier"
                />
                {histLoading ? <LoadingBlock /> : (
                    <div className="space-y-4">
                        {hist?.status_summary?.length ? (
                            <div className="flex flex-wrap gap-3">
                                {hist.status_summary.map(s => (
                                    <div key={s.status} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-center">
                                        <StatusPill status={s.status} />
                                        <p className="text-lg font-bold text-[#1F3864] mt-1">{s.count}</p>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <SimpleTable
                            columns={[
                                { key: 'supplier_name', label: 'Supplier', className: 'font-medium text-gray-900' },
                                { key: 'total_pos', label: 'Total POs', align: 'right', render: v => fmt(v) },
                                { key: 'accepted', label: 'Accepted', align: 'right', render: v => <span className="text-green-600 font-semibold">{v}</span> },
                                { key: 'rejected', label: 'Rejected', align: 'right', render: v => <span className="text-red-500">{v}</span> },
                                { key: 'received', label: 'Fully Received', align: 'right', render: v => <span className="text-[#2E75B6] font-semibold">{v}</span> },
                                { key: 'cancelled', label: 'Cancelled', align: 'right', render: v => <span className="text-gray-400">{v}</span> },
                            ]}
                            rows={hist?.by_supplier || []}
                            emptyMessage="No purchase orders in this period."
                        />
                    </div>
                )}
            </Card>

            {/* Spend per supplier */}
            <Card>
                <SectionTitle
                    icon={DollarSign}
                    title="Spend per Supplier"
                    subtitle="Calculated from received goods only (good quantity x unit price)"
                />
                {spendLoading ? <LoadingBlock /> : (
                    <div className="space-y-4">
                        {spend?.by_supplier?.length ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart
                                    data={spend.by_supplier.slice(0, 10)}
                                    layout="vertical"
                                    margin={{ top: 4, right: 32, left: 80, bottom: 4 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => fmtPeso(v)} />
                                    <YAxis type="category" dataKey="supplier_name" tick={{ fontSize: 11 }} width={76} />
                                    <Tooltip formatter={v => fmtPeso(v)} />
                                    <Bar dataKey="total_spend" fill="#2E75B6" name="Total Spend" radius={[0, 3, 3, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyBlock />}
                        <SimpleTable
                            columns={[
                                { key: 'supplier_name', label: 'Supplier', className: 'font-medium text-gray-900' },
                                { key: 'total_spend', label: 'Total Spend', align: 'right', render: v => <span className="font-semibold">{fmtPeso(v)}</span> },
                            ]}
                            rows={spend?.by_supplier || []}
                            emptyMessage="No spend data in this period."
                        />
                    </div>
                )}
            </Card>

            {/* Lead times */}
            <Card>
                <SectionTitle
                    icon={Clock}
                    title="Lead Times"
                    subtitle="Average days from PO creation to first delivery receipt"
                />
                {leadLoading ? <LoadingBlock /> : (
                    <SimpleTable
                        columns={[
                            { key: 'supplier_name', label: 'Supplier', className: 'font-medium text-gray-900' },
                            {
                                key: 'average_lead_days', label: 'Avg Lead (days)', align: 'right',
                                render: v => <span className="font-semibold text-[#2E75B6]">{v}</span>
                            },
                            { key: 'min_lead_days', label: 'Min', align: 'right', render: v => <span className="text-green-600">{v}</span> },
                            { key: 'max_lead_days', label: 'Max', align: 'right', render: v => <span className="text-red-500">{v}</span> },
                            { key: 'sample_count', label: 'Receipts', align: 'right' },
                        ]}
                        rows={lead?.suppliers || []}
                        emptyMessage="No delivery receipts in this period."
                    />
                )}
            </Card>

            {/* Performance */}
            <Card>
                <SectionTitle
                    icon={Star}
                    title="Supplier Performance"
                    subtitle="Fulfillment rate and rejection rate per supplier"
                />
                {perfLoading ? <LoadingBlock /> : (
                    <SimpleTable
                        columns={[
                            { key: 'supplier_name', label: 'Supplier', className: 'font-medium text-gray-900' },
                            { key: 'total_pos', label: 'Total POs', align: 'right' },
                            {
                                key: 'fulfillment_rate_pct', label: 'Fulfillment Rate', align: 'right',
                                render: v => (
                                    <div className="flex items-center justify-end gap-2">
                                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                                            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${v}%` }} />
                                        </div>
                                        <span className="text-green-700 font-semibold">{v}%</span>
                                    </div>
                                )
                            },
                            {
                                key: 'rejection_rate_pct', label: 'Rejection Rate', align: 'right',
                                render: v => <span className={v > 10 ? 'text-red-600 font-semibold' : 'text-gray-600'}>{v}%</span>
                            },
                            { key: 'received', label: 'Fully Rcvd', align: 'right' },
                            { key: 'rejected', label: 'Rejected', align: 'right', render: v => <span className="text-red-400">{v}</span> },
                        ]}
                        rows={perf?.suppliers || []}
                        emptyMessage="No performance data in this period."
                    />
                )}
            </Card>
        </div>
    )
}

// ------------------------------------------------------------------
// CLIENTS TAB
// ------------------------------------------------------------------

function ClientsTab({ dateFrom, dateTo }) {
    const params = { date_from: dateFrom, date_to: dateTo }

    const { data: histData, isLoading: histLoading } = useQuery({
        queryKey: ['report-client-so-history', dateFrom, dateTo],
        queryFn: () => getClientSOHistory(params),
    })

    const { data: revData, isLoading: revLoading } = useQuery({
        queryKey: ['report-client-revenue', dateFrom, dateTo],
        queryFn: () => getClientRevenue(params),
    })

    const { data: usageData, isLoading: usageLoading } = useQuery({
        queryKey: ['report-client-material-usage', dateFrom, dateTo],
        queryFn: () => getClientMaterialUsage(params),
    })

    const { data: outData, isLoading: outLoading } = useQuery({
        queryKey: ['report-client-outstanding'],
        queryFn: getClientOutstandingOrders,
    })

    const hist = histData?.data
    const rev = revData?.data
    const usage = usageData?.data
    const out = outData?.data

    return (
        <div className="space-y-6">
            {/* Revenue summary */}
            {revLoading ? null : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatTile
                        label="Total Revenue (Delivered SOs)"
                        value={fmtPeso(rev?.total_revenue)}
                        color="green"
                    />
                    <StatTile
                        label="Distinct Clients"
                        value={fmt(rev?.by_client?.length)}
                        color="blue"
                    />
                    <StatTile
                        label="Outstanding Orders"
                        value={fmt(out?.count)}
                        color="amber"
                    />
                </div>
            )}

            {/* Revenue per client */}
            <Card>
                <SectionTitle
                    icon={DollarSign}
                    title="Revenue per Client"
                    subtitle="From delivered sales orders only"
                />
                {revLoading ? <LoadingBlock /> : (
                    <div className="space-y-4">
                        {rev?.by_client?.length ? (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart
                                    data={rev.by_client.slice(0, 10)}
                                    layout="vertical"
                                    margin={{ top: 4, right: 32, left: 96, bottom: 4 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => fmtPeso(v)} />
                                    <YAxis type="category" dataKey="client_name" tick={{ fontSize: 11 }} width={92} />
                                    <Tooltip formatter={v => fmtPeso(v)} />
                                    <Bar dataKey="total_revenue" fill="#1F3864" name="Revenue" radius={[0, 3, 3, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyBlock />}
                        <SimpleTable
                            columns={[
                                { key: 'client_name', label: 'Client', className: 'font-medium text-gray-900' },
                                { key: 'total_revenue', label: 'Total Revenue', align: 'right', render: v => <span className="font-semibold text-green-700">{fmtPeso(v)}</span> },
                            ]}
                            rows={rev?.by_client || []}
                            emptyMessage="No revenue data in this period."
                        />
                    </div>
                )}
            </Card>

            {/* SO History per client */}
            <Card>
                <SectionTitle
                    icon={ShoppingCart}
                    title="Sales Order History"
                    subtitle="Order count and delivery rate per client"
                />
                {histLoading ? <LoadingBlock /> : (
                    <SimpleTable
                        columns={[
                            { key: 'client_name', label: 'Client', className: 'font-medium text-gray-900' },
                            { key: 'total_orders', label: 'Total Orders', align: 'right', render: v => fmt(v) },
                            { key: 'delivered', label: 'Delivered', align: 'right', render: v => <span className="text-green-600 font-semibold">{v}</span> },
                            { key: 'pending', label: 'In Progress', align: 'right', render: v => <span className="text-amber-600">{v}</span> },
                            { key: 'cancelled', label: 'Cancelled', align: 'right', render: v => <span className="text-gray-400">{v}</span> },
                        ]}
                        rows={hist?.by_client || []}
                        emptyMessage="No sales orders in this period."
                    />
                )}
            </Card>

            {/* Material usage */}
            <Card>
                <SectionTitle
                    icon={Package}
                    title="Material Usage"
                    subtitle="Items dispatched in delivered sales orders"
                />
                {usageLoading ? <LoadingBlock /> : (
                    <SimpleTable
                        columns={[
                            { key: 'item_sku', label: 'SKU', className: 'font-mono text-xs text-gray-500' },
                            { key: 'item_name', label: 'Item', className: 'font-medium text-gray-900' },
                            { key: 'uom', label: 'UOM' },
                            { key: 'total_quantity', label: 'Total Qty', align: 'right', render: v => fmt(v, 2) },
                            { key: 'total_value', label: 'Total Value', align: 'right', render: v => fmtPeso(v) },
                        ]}
                        rows={usage?.items || []}
                        emptyMessage="No material usage data in this period."
                    />
                )}
            </Card>

            {/* Outstanding orders */}
            <Card>
                <SectionTitle
                    icon={AlertTriangle}
                    title="Outstanding Orders"
                    subtitle="Sales orders not yet delivered or cancelled"
                />
                {outLoading ? <LoadingBlock /> : (
                    <SimpleTable
                        columns={[
                            { key: 'so_number', label: 'SO Number', className: 'font-mono text-xs text-gray-500' },
                            { key: 'client_name', label: 'Client', className: 'font-medium text-gray-900' },
                            { key: 'status', label: 'Status', render: v => <StatusPill status={v} /> },
                            { key: 'total_value', label: 'Value', align: 'right', render: v => fmtPeso(v) },
                            {
                                key: 'age_days', label: 'Age (days)', align: 'right',
                                render: v => (
                                    <span className={v > 14 ? 'text-red-600 font-semibold' : v > 7 ? 'text-amber-600' : 'text-gray-600'}>
                                        {v}d
                                    </span>
                                )
                            },
                            { key: 'created_by', label: 'Created By', className: 'text-gray-500 text-xs' },
                        ]}
                        rows={out?.orders || []}
                        emptyMessage="No outstanding orders."
                    />
                )}
            </Card>
        </div>
    )
}

// ------------------------------------------------------------------
// USER ACTIVITY TAB (Admin only)
// ------------------------------------------------------------------

function UsersTab({ dateFrom, dateTo }) {
    const params = { date_from: dateFrom, date_to: dateTo }

    const { data: poData, isLoading: poLoading } = useQuery({
        queryKey: ['report-user-po-activity', dateFrom, dateTo],
        queryFn: () => getUserPOActivity(params),
    })

    const { data: roleData, isLoading: roleLoading } = useQuery({
        queryKey: ['report-user-role-changes', dateFrom, dateTo],
        queryFn: () => getUserRoleChanges(params),
    })

    const { data: acctData, isLoading: acctLoading } = useQuery({
        queryKey: ['report-user-account-activity', dateFrom, dateTo],
        queryFn: () => getUserAccountActivity(params),
    })

    const { data: auditData, isLoading: auditLoading } = useQuery({
        queryKey: ['report-audit-log', dateFrom, dateTo],
        queryFn: () => getAuditLogReport(params),
    })

    const po = poData?.data
    const role = roleData?.data
    const acct = acctData?.data
    const audit = auditData?.data

    return (
        <div className="space-y-6">
            {/* PO creation by user */}
            <Card>
                <SectionTitle
                    icon={Users}
                    title="Purchase Order Creation"
                    subtitle="Who created purchase orders in this period"
                />
                {poLoading ? <LoadingBlock /> : (
                    <SimpleTable
                        columns={[
                            {
                                key: 'user_name', label: 'Username', className: 'font-mono text-sm',
                            },
                            {
                                key: 'first_name', label: 'Name',
                                render: (v, row) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || '-',
                            },
                            { key: 'total_created', label: 'POs Created', align: 'right', render: v => <span className="font-semibold">{fmt(v)}</span> },
                        ]}
                        rows={po?.by_creator || []}
                        emptyMessage="No PO activity in this period."
                    />
                )}
            </Card>

            {/* Role changes */}
            <Card>
                <SectionTitle
                    icon={Shield}
                    title="Role Changes"
                    subtitle="All user role changes recorded in this period"
                />
                {roleLoading ? <LoadingBlock /> : (
                    <SimpleTable
                        columns={[
                            {
                                key: 'timestamp', label: 'When',
                                render: v => new Date(v).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }),
                                className: 'text-xs text-gray-500 font-mono',
                            },
                            { key: 'performed_by', label: 'Changed By', className: 'font-medium' },
                            { key: 'resource_name', label: 'User Affected' },
                            {
                                key: 'role_before', label: 'From',
                                render: v => v ? <StatusPill status={v} /> : '-',
                            },
                            {
                                key: 'role_after', label: 'To',
                                render: v => v ? <StatusPill status={v} /> : '-',
                            },
                            { key: 'ip_address', label: 'IP Address', className: 'text-xs text-gray-400 font-mono' },
                        ]}
                        rows={role?.role_changes || []}
                        emptyMessage="No role changes in this period."
                    />
                )}
            </Card>

            {/* Account activity summary */}
            <Card>
                <SectionTitle
                    icon={Activity}
                    title="Account Activity"
                    subtitle="User account creates, updates, and deletions"
                />
                {acctLoading ? <LoadingBlock /> : (
                    <div className="space-y-4">
                        {acct?.by_action?.length ? (
                            <div className="flex flex-wrap gap-3">
                                {acct.by_action.map(a => (
                                    <div key={a.action} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-center">
                                        <p className="text-xs text-gray-500 font-medium">{a.action}</p>
                                        <p className="text-lg font-bold text-[#1F3864]">{a.count}</p>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <SimpleTable
                            columns={[
                                {
                                    key: 'timestamp', label: 'When',
                                    render: v => new Date(v).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }),
                                    className: 'text-xs text-gray-500 font-mono',
                                },
                                { key: 'performed_by_name', label: 'By', className: 'font-mono text-sm' },
                                {
                                    key: 'action', label: 'Action',
                                    render: v => {
                                        const colors = { CREATE: 'text-green-600', UPDATE: 'text-amber-600', DELETE: 'text-red-600' }
                                        return <span className={`font-semibold text-xs ${colors[v] || ''}`}>{v}</span>
                                    }
                                },
                                { key: 'resource_name', label: 'User', className: 'font-medium' },
                                { key: 'ip_address', label: 'IP', className: 'text-xs text-gray-400 font-mono' },
                            ]}
                            rows={(acct?.logs || []).slice(0, 50)}
                            emptyMessage="No account activity in this period."
                        />
                    </div>
                )}
            </Card>

            {/* Audit log */}
            <Card>
                <SectionTitle
                    icon={FileText}
                    title="Full Audit Log"
                    subtitle="All configuration changes (showing most recent 200 entries)"
                />
                {auditLoading ? <LoadingBlock /> : (
                    <div className="space-y-4">
                        {audit?.summary?.length ? (
                            <div className="flex flex-wrap gap-2">
                                {audit.summary.map(s => (
                                    <span key={`${s.resource_type}-${s.action}`} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                        {s.resource_type} {s.action}: <strong>{s.count}</strong>
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        <SimpleTable
                            columns={[
                                {
                                    key: 'timestamp', label: 'When',
                                    render: v => new Date(v).toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' }),
                                    className: 'text-xs text-gray-500 font-mono',
                                },
                                { key: 'performed_by_name', label: 'By', className: 'font-mono text-xs' },
                                {
                                    key: 'action', label: 'Action',
                                    render: v => {
                                        const colors = { CREATE: 'text-green-600', UPDATE: 'text-amber-600', DELETE: 'text-red-600' }
                                        return <span className={`font-semibold text-xs ${colors[v] || ''}`}>{v}</span>
                                    }
                                },
                                { key: 'resource_type', label: 'Resource', className: 'text-xs' },
                                { key: 'resource_name', label: 'Name', className: 'font-medium text-sm' },
                                { key: 'ip_address', label: 'IP', className: 'text-xs text-gray-400 font-mono' },
                            ]}
                            rows={audit?.logs || []}
                            emptyMessage="No audit records in this period."
                        />
                    </div>
                )}
            </Card>
        </div>
    )
}

// ------------------------------------------------------------------
// Main page
// ------------------------------------------------------------------

export default function ReportsPage() {
    const role = useAuthStore(s => s.user?.role || '')
    const isAdmin = role === 'SYSTEM_ADMIN'

    const [activeTab, setActiveTab] = useState('inventory')
    const [dateFrom, setDateFrom] = useState(getDefaultDateFrom())
    const [dateTo, setDateTo] = useState(getDefaultDateTo())

    const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin)

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[#1F3864]">Reports</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Analytics and summaries across all modules</p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex flex-wrap gap-1 bg-white rounded-lg shadow-sm p-1 mb-5">
                {visibleTabs.map(tab => {
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === tab.id
                                ? 'bg-[#1F3864] text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Date range filter (all tabs except user activity which has its own context) */}
            <DateRangeFilter
                dateFrom={dateFrom}
                dateTo={dateTo}
                onChangeDateFrom={setDateFrom}
                onChangeDateTo={setDateTo}
            />

            {/* Tab content */}
            {activeTab === 'inventory' && (
                <InventoryTab dateFrom={dateFrom} dateTo={dateTo} />
            )}
            {activeTab === 'suppliers' && (
                <SuppliersTab dateFrom={dateFrom} dateTo={dateTo} />
            )}
            {activeTab === 'clients' && (
                <ClientsTab dateFrom={dateFrom} dateTo={dateTo} />
            )}
            {activeTab === 'users' && isAdmin && (
                <UsersTab dateFrom={dateFrom} dateTo={dateTo} />
            )}
        </div>
    )
}