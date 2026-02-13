"use client";

import { useEffect, useState } from "react";
import {
    ShoppingBag,
    Users,
    Plus,
    Search,
    ArrowRight,
    Building2,
    BadgeIndianRupee,
    Calendar,
    FileText,
    Truck,
    MoreVertical,
    CheckCircle2,
    Clock,
    XCircle
} from "lucide-react";
import { toast, Toaster } from "sonner";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Dropdown } from "../../components/ui/Dropdown";
import { supabase } from "../../lib/supabaseClient";
import { getAccessibleBranches, getActiveRestaurantRole, getCurrentUserProfile } from "../../lib/tenant";

type Tab = "orders" | "vendors" | "new-order";

export default function PurchasePage() {
    const [activeTab, setActiveTab] = useState<Tab>("orders");
    const [loading, setLoading] = useState(true);

    // Data states
    const [orders, setOrders] = useState<any[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
    const [role, setRole] = useState<string | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const profile = await getCurrentUserProfile();
            if (!profile?.active_restaurant_id) return;

            if (activeTab === "orders") {
                let query = supabase
                    .from("purchase_orders")
                    .select(`
                        id,
                        order_number,
                        status,
                        total_amount,
                        order_date,
                        branch:branches(name),
                        vendor:vendors(name)
                    `);

                if (selectedBranchId === "all") {
                    query = query.eq("restaurant_id", profile.active_restaurant_id);
                } else {
                    query = query.eq("branch_id", selectedBranchId);
                }

                const { data } = await query.order("created_at", { ascending: false });
                setOrders(data ?? []);
            } else if (activeTab === "vendors") {
                const { data } = await supabase
                    .from("vendors")
                    .select("*")
                    .eq("restaurant_id", profile.active_restaurant_id)
                    .order("name");
                setVendors(data ?? []);
            }
        } catch (err) {
            console.error("Load error:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadBranches = async () => {
        const profile = await getCurrentUserProfile();
        if (!profile?.active_restaurant_id) return;
        const data = await getAccessibleBranches(profile.active_restaurant_id);
        setBranches(data ?? []);
        const currentRole = await getActiveRestaurantRole();
        setRole(currentRole);

        // If not owner/manager, force to active branch
        if (currentRole !== 'owner' && currentRole !== 'manager') {
            setSelectedBranchId(profile.active_branch_id || 'all');
        }
    };

    useEffect(() => {
        loadBranches();
    }, []);

    useEffect(() => {
        loadData();
    }, [activeTab, selectedBranchId]);

    return (
        <AuthGate>
            <AppShell title="Purchase Management" subtitle="Manage vendors and raw material orders">
                <Toaster richColors />

                <div className="space-y-6">
                    {/* Custom Tabs */}
                    <div className="flex border-b border-slate-200">
                        <div className="flex-1 flex overflow-x-auto">
                            {[
                                { id: "orders", label: "Purchase Orders", icon: ShoppingBag },
                                { id: "vendors", label: "Vendors List", icon: Users },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as Tab)}
                                    className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? "border-brand-600 text-brand-600"
                                        : "border-transparent text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {(role === 'owner' || role === 'manager') && activeTab !== "new-order" && (
                            <div className="flex items-center px-4 self-center border-l bg-slate-50/50">
                                <span className="text-[10px] font-bold text-slate-400 uppercase mr-3">Scope:</span>
                                <div className="w-48 py-1">
                                    <Dropdown
                                        value={selectedBranchId}
                                        options={[
                                            { value: "all", label: "All Branches" },
                                            ...branches.map(b => ({ value: b.id, label: b.name }))
                                        ]}
                                        placeholder="Filter branch"
                                        onChange={(val) => setSelectedBranchId(val)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="relative max-w-sm flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                placeholder={`Search ${activeTab === 'orders' ? 'orders...' : 'vendors...'}`}
                                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
                            />
                        </div>
                        <Button className="gap-2" onClick={() => setActiveTab("new-order")}>
                            <Plus size={16} />
                            {activeTab === 'vendors' ? 'Register Vendor' : 'New Purchase Order'}
                        </Button>
                    </div>

                    {activeTab === "orders" && (
                        <div className="grid gap-4">
                            {loading ? (
                                <p className="text-center py-12 text-slate-400">Loading orders...</p>
                            ) : orders.length === 0 ? (
                                <Card className="text-center py-16">
                                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                                        <ShoppingBag size={32} />
                                    </div>
                                    <h3 className="mt-4 text-lg font-bold text-slate-900">No purchase orders found</h3>
                                    <p className="mt-1 text-sm text-slate-500">Create your first PO to track incoming stock.</p>
                                    <Button className="mt-6" onClick={() => setActiveTab("new-order")}>Create New Order</Button>
                                </Card>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {orders.map((order) => (
                                        <Card key={order.id} className="group cursor-pointer hover:border-brand-300 transition-all">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`p-2 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors`}>
                                                    <FileText size={20} />
                                                </div>
                                                <StatusBadge status={order.status} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    {order.order_number}
                                                    {selectedBranchId === "all" && (
                                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-auto truncate max-w-[80px]">
                                                            {order.branch?.name}
                                                        </span>
                                                    )}
                                                </p>
                                                <h4 className="text-lg font-black text-slate-900 mt-1">{order.vendor?.name}</h4>
                                                <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-4">
                                                    <div className="flex items-center gap-1.5 text-brand-600">
                                                        <BadgeIndianRupee size={16} />
                                                        <span className="text-sm font-black">{Number(order.total_amount).toLocaleString('en-IN')}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <Calendar size={14} />
                                                        <span className="text-[10px] font-bold uppercase">{new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "vendors" && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {loading ? (
                                <p className="text-center py-12 text-slate-400">Loading vendors...</p>
                            ) : vendors.length === 0 ? (
                                <div className="col-span-full py-16 text-center">
                                    <p className="text-slate-400">No vendors registered.</p>
                                </div>
                            ) : (
                                vendors.map((vendor) => (
                                    <Card key={vendor.id} className="relative overflow-hidden">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 border border-brand-100 shadow-inner">
                                                <Building2 size={24} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-base font-bold text-slate-900 truncate">{vendor.name}</h4>
                                                <p className="text-xs text-slate-500 mt-0.5">{vendor.phone || "No contact"}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-medium mt-1 truncate">{vendor.address || "No address"}</p>
                                            </div>
                                            <button className="text-slate-300 hover:text-slate-600">
                                                <MoreVertical size={18} />
                                            </button>
                                        </div>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "new-order" && (
                        <NewPurchaseOrder onCancel={() => setActiveTab("orders")} onSuccess={() => setActiveTab("orders")} />
                    )}
                </div>
            </AppShell>
        </AuthGate>
    );
}

function StatusBadge({ status }: { status: string }) {
    const configs: Record<string, { icon: any, class: string, label: string }> = {
        received: { icon: CheckCircle2, class: "bg-emerald-50 text-emerald-600 ring-emerald-200", label: "Received" },
        ordered: { icon: Truck, class: "bg-blue-50 text-blue-600 ring-blue-200", label: "Ordered" },
        draft: { icon: Clock, class: "bg-slate-50 text-slate-600 ring-slate-200", label: "Draft" },
        cancelled: { icon: XCircle, class: "bg-rose-50 text-rose-600 ring-rose-200", label: "Cancelled" },
    };

    const config = configs[status] || configs.draft;
    if (!config) return null;
    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${config.class}`}>
            <Icon size={12} /> {config.label}
        </span>
    );
}

function NewPurchaseOrder({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: () => void }) {
    const [vendors, setVendors] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);

    const [vendorId, setVendorId] = useState("");
    const [orderItems, setOrderItems] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const load = async () => {
            const profile = await getCurrentUserProfile();
            if (!profile) return;

            const [vData, iData] = await Promise.all([
                supabase.from("vendors").select("id,name").eq("restaurant_id", profile.active_restaurant_id),
                supabase.from("inventory_items").select("id,name,unit").eq("branch_id", profile.active_branch_id)
            ]);

            setVendors(vData.data ?? []);
            setItems(iData.data ?? []);
        };
        load();
    }, []);

    const addItemRow = () => {
        setOrderItems([...orderItems, { inventory_item_id: "", quantity: 1, unit_price: 0 }]);
    };

    const removeItemRow = (index: number) => {
        setOrderItems(orderItems.filter((_, i) => i !== index));
    };

    const updateItemRow = (index: number, field: string, value: any) => {
        const newItems = [...orderItems];
        newItems[index][field] = value;
        setOrderItems(newItems);
    };

    const total = orderItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!vendorId || orderItems.length === 0) return;

        setSubmitting(true);
        try {
            const profile = await getCurrentUserProfile();
            if (!profile) return;

            const orderNumber = `PO-${Date.now().toString().slice(-6)}`;

            const { data: po, error: poError } = await supabase
                .from("purchase_orders")
                .insert({
                    restaurant_id: profile.active_restaurant_id,
                    branch_id: profile.active_branch_id,
                    vendor_id: vendorId,
                    order_number: orderNumber,
                    total_amount: total,
                    status: 'ordered'
                })
                .select()
                .single();

            if (poError) throw poError;

            const { error: itemsError } = await supabase
                .from("purchase_items")
                .insert(
                    orderItems.map(item => ({
                        purchase_order_id: po.id,
                        inventory_item_id: item.inventory_item_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        total_price: Number(item.quantity) * Number(item.unit_price)
                    }))
                );

            if (itemsError) throw itemsError;

            toast.success("Purchase order created successfully");
            onSuccess();
        } catch (err) {
            console.error(err);
            toast.error("Failed to create purchase order");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="animate-slide-up space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">Create Purchase Order</h3>
                <Button variant="ghost" onClick={onCancel}>Discard</Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-4">
                    <Card title="Order Items">
                        <div className="space-y-3">
                            {orderItems.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-end border-b border-slate-50 pb-3">
                                    <div className="col-span-5">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Inventory Item</label>
                                        <select
                                            value={row.inventory_item_id}
                                            onChange={(e) => updateItemRow(idx, "inventory_item_id", e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                                        >
                                            <option value="">Select Item</option>
                                            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Qty</label>
                                        <Input type="number" value={row.quantity} onChange={(e) => updateItemRow(idx, "quantity", e.target.value)} />
                                    </div>
                                    <div className="col-span-3">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Price</label>
                                        <Input type="number" value={row.unit_price} onChange={(e) => updateItemRow(idx, "unit_price", e.target.value)} />
                                    </div>
                                    <div className="col-span-1 border-l border-slate-100 pl-2">
                                        <Button variant="ghost" className="h-9 w-full p-0 text-slate-300 hover:text-red-500" onClick={() => removeItemRow(idx)}>
                                            <Plus className="rotate-45" size={16} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                            <Button variant="outline" className="w-full gap-2 border-dashed border-slate-300 py-4 hover:border-brand-300 hover:bg-brand-50/50" onClick={addItemRow}>
                                <Plus size={16} /> Add Item to List
                            </Button>
                        </div>
                    </Card>
                </div>

                <div className="space-y-4">
                    <Card title="Vendor & Details">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">Select Vendor</label>
                                <select
                                    value={vendorId}
                                    onChange={(e) => setVendorId(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:border-brand-500 focus:outline-none"
                                >
                                    <option value="">Choose a Supplier...</option>
                                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                                </select>
                            </div>

                            <div className="rounded-xl bg-slate-900 p-5 text-white shadow-xl">
                                <p className="text-xs font-medium text-slate-400">Total Purchase Value</p>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-lg font-medium text-slate-400">₹</span>
                                    <span className="text-3xl font-black">{total.toLocaleString('en-IN')}</span>
                                </div>
                                <Button
                                    className="mt-6 w-full bg-brand-600 hover:bg-brand-500 py-6 text-sm font-black uppercase tracking-widest shadow-lg shadow-brand-600/30"
                                    onClick={handleSubmit}
                                    disabled={submitting || !vendorId || orderItems.length === 0}
                                >
                                    {submitting ? "Sending..." : "Place Order"}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
