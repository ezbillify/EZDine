"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  MonitorCheck,
  ChefHat,
  Warehouse,
  Calendar,
  IndianRupee,
  ArrowRightCircle,
  Zap,
  Activity,
  History,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Filter
} from "lucide-react";

import { AuthGate } from "../../components/auth/AuthGate";
import { BranchSwitcher } from "../../components/branch/BranchSwitcher";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";

interface Order {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  total_amount?: number;
  table?: { name: string };
}

interface Bill {
  id: string;
  total: number;
  created_at: string;
  order_number?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  current_stock: number;
  reorder_level: number | null;
  unit: string;
}

type TimeRange = "today" | "yesterday" | "week" | "month";

interface ActivityFeedItem {
  id: string;
  type: string;
  status: string;
  icon: React.ElementType;
  color: string;
  date: string;
  name?: string;
  order_number?: string;
  table?: { name: string };
}

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [reservations, setReservations] = useState<Record<string, unknown>[]>([]);
  const [waitlist, setWaitlist] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtering & Sorting State for Activity Feed
  const [feedFilter, setFeedFilter] = useState<"All" | "Order" | "Res" | "Wait">("All");
  const [feedSort, setFeedSort] = useState<"Time" | "Status">("Time");

  const getDateRange = (range: TimeRange) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (range === "yesterday") {
      start.setDate(start.getDate() - 1);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    if (range === "week") start.setDate(start.getDate() - 7);
    else if (range === "month") start.setMonth(start.getMonth() - 1);
    return { start: start.toISOString(), end: new Date().toISOString() };
  };

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    const profile = await getCurrentUserProfile();
    if (!profile?.active_branch_id) {
      setLoading(false);
      return;
    }

    const { start, end } = getDateRange(timeRange);

    const [ordersRes, billsRes, inventoryRes, resRes, waitRes] = await Promise.all([
      supabase.from("orders").select("id, order_number, status, created_at, table:tables(name)").eq("branch_id", profile.active_branch_id).gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
      supabase.from("bills").select("id, total, created_at").eq("branch_id", profile.active_branch_id).gte("created_at", start).lte("created_at", end).order("created_at", { ascending: false }),
      supabase.from("inventory_items").select("id, name, current_stock, reorder_level, unit").eq("branch_id", profile.active_branch_id).eq("is_active", true),
      supabase.from("reservations").select("*").eq("branch_id", profile.active_branch_id).gte("reservation_time", start).lte("reservation_time", end),
      supabase.from("waitlist").select("*").eq("branch_id", profile.active_branch_id).neq("status", "seated").neq("status", "cancelled")
    ]);

    setPendingOrders((ordersRes.data as unknown as Order[]) || []);
    setRecentBills((billsRes.data as unknown as Bill[]) || []);
    setInventoryItems((inventoryRes.data as unknown as InventoryItem[]) || []);
    setReservations(resRes.data || []);
    setWaitlist(waitRes.data || []);
    setLoading(false);
  }, [timeRange]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounceTimer: NodeJS.Timeout;

    const handleUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        load(true); // Silent reload on updates
      }, 2000); // 2-second debounce
    };

    const setupRealtime = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_branch_id) return;
      channel = supabase
        .channel(`dash-full-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `branch_id=eq.${profile.active_branch_id}` }, handleUpdate)
        .on("postgres_changes", { event: "*", schema: "public", table: "bills", filter: `branch_id=eq.${profile.active_branch_id}` }, handleUpdate)
        .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items", filter: `branch_id=eq.${profile.active_branch_id}` }, handleUpdate)
        .on("postgres_changes", { event: "*", schema: "public", table: "reservations", filter: `branch_id=eq.${profile.active_branch_id}` }, handleUpdate)
        .on("postgres_changes", { event: "*", schema: "public", table: "waitlist", filter: `branch_id=eq.${profile.active_branch_id}` }, handleUpdate)
        .subscribe();
    };

    load();
    setupRealtime();
    return () => {
      if (channel) supabase.removeChannel(channel);
      clearTimeout(debounceTimer);
    };
  }, [load]);

  const salesTotal = useMemo(() => recentBills.reduce((sum, b) => sum + Number(b.total || 0), 0), [recentBills]);
  const lowStockItems = useMemo(() => inventoryItems.filter((i) => i.current_stock <= (i.reorder_level || 0)), [inventoryItems]);

  const stats = [
    { label: "Gross Revenue", value: `₹${salesTotal.toLocaleString("en-IN")}`, icon: IndianRupee, color: "emerald", description: `${timeRange} earnings`, trend: { value: 12, type: "up" as const } },
    { label: "Active Orders", value: pendingOrders.filter(o => ['pending', 'preparing'].includes(o.status)).length, icon: ChefHat, color: "orange", description: "In kitchen prep", trend: { value: 5, type: "up" as const } },
    { label: "Reservations", value: reservations.filter(r => r.status === 'confirmed').length, icon: Calendar, color: "blue", description: "Upcoming guests", trend: { value: 2, type: "up" as const } },
    { label: "Waitlist", value: waitlist.length, icon: Activity, color: "amber", description: "Active waiting", trend: { value: 0, type: "neutral" as const } }
  ];

  const activityFeed = useMemo(() => {
    const combined: ActivityFeedItem[] = [
      ...pendingOrders.map(o => ({ ...o, type: 'Order', icon: ChefHat as React.ElementType, color: 'brand', date: o.created_at, name: o.table?.name || 'Quick Bill' } as ActivityFeedItem)),
      ...reservations.map(r => ({ ...r, status: r.status as string, id: r.id as string, type: 'Res', icon: Calendar as React.ElementType, color: 'blue', date: r.reservation_time as string, name: r.customer_name as string, order_number: '' } as ActivityFeedItem)),
      ...waitlist.map(w => ({ ...w, status: w.status as string, id: w.id as string, type: 'Wait', icon: Activity as React.ElementType, color: 'amber', date: w.created_at as string, name: w.customer_name as string, order_number: '' } as ActivityFeedItem))
    ];

    let filtered = combined;
    if (feedFilter !== "All") filtered = combined.filter(i => i.type === feedFilter);

    return filtered.sort((a, b) => {
      const aDate = a.date as string;
      const bDate = b.date as string;
      const aStatus = a.status as string;
      const bStatus = b.status as string;
      if (feedSort === "Time") return new Date(bDate).getTime() - new Date(aDate).getTime();
      return (aStatus || '').localeCompare(bStatus || '');
    }).slice(0, 15);
  }, [pendingOrders, reservations, waitlist, feedFilter, feedSort]);

  const modules = [
    { label: "Terminal (POS)", icon: MonitorCheck, href: "/pos", description: "Ordering & Billing", color: "indigo" },
    { label: "Kitchen (KDS)", icon: Activity, href: "/kds", description: "Order Production", color: "emerald" },
    { label: "Reserve (Guests)", icon: Calendar, href: "/reservations", description: "Tables & Waitlist", color: "amber" },
    { label: "Storage (INV)", icon: Warehouse, href: "/inventory", description: "Stock Control", color: "slate", comingSoon: true },
  ];

  if (loading && pendingOrders.length === 0 && recentBills.length === 0) {
    return (
      <AuthGate>
        <AppShell title="Loading Pulse..." subtitle="Syncing with operations engine">
          <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600 shadow-xl" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 animate-pulse">Initializing Dashboard Engine</p>
          </div>
        </AppShell>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <AppShell
        title="Operation Control"
        subtitle="Operational intelligence for your restaurant"
        actions={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
              <Filter size={14} className="text-slate-400" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none bg-transparent cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Past 7 Days</option>
                <option value="month">Past 30 Days</option>
              </select>
            </div>
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Branch Live</span>
            </div>
          </div>
        }
      >
        <div className="grid h-full gap-8 lg:grid-cols-[300px_1fr]">
          {/* Analytics Sidebar */}
          <aside className="space-y-6">
            <BranchSwitcher />

            <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
              <div className="bg-slate-900 p-5 text-white relative">
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <Zap size={80} fill="currentColor" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Pulse</p>
                <h4 className="mt-4 text-sm font-bold leading-tight">Your POS network and printers are sync&apos;d.</h4>
              </div>
              <div className="p-4 space-y-1">
                {[
                  { label: "Main POS", status: "Connected" },
                  { label: "Kitchen #1", status: "Active" },
                  { label: "Storage Sync", status: "Live" }
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-bold text-slate-500">{s.label}</span>
                    <span className="text-[9px] font-black uppercase text-emerald-500">{s.status}</span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <p className="px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Quick Access</p>
              <div className="grid gap-2">
                {[
                  { label: "Order History", icon: History, href: "/orders" },
                  { label: "Daily Reports", icon: TrendingUp, href: "/reports" },
                  { label: "Staff Roster", icon: History, href: "/staff", comingSoon: true }
                ].map(link => (
                  <Link
                    key={link.label}
                    href={(link as any).comingSoon ? "#" : link.href}
                    className={`group flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 transition-all ${(link as any).comingSoon ? "opacity-60 cursor-not-allowed" : "hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/5"}`}
                    onClick={(e) => (link as any).comingSoon && e.preventDefault()}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ${(link as any).comingSoon ? "" : "group-hover:bg-brand-50 group-hover:text-brand-600"} transition-colors`}>
                        <link.icon size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-xs font-black uppercase tracking-wide text-slate-600 ${(link as any).comingSoon ? "" : "group-hover:text-slate-900"}`}>{link.label}</span>
                        {(link as any).comingSoon && <span className="text-[7px] font-black text-brand-500 uppercase">Coming Soon</span>}
                      </div>
                    </div>
                    {!(link as any).comingSoon && <ArrowRightCircle size={14} className="text-slate-200 group-hover:text-brand-500 transition-colors" />}
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          {/* Main Intelligence Grid */}
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Real Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              {stats.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  trend={stat.trend}
                  icon={stat.icon}
                  color={stat.color}
                  description={stat.description}
                />
              ))}
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
              <div className="space-y-8">
                {/* Visual Workspace */}
                <Card className="border-slate-50 shadow-xl shadow-slate-200/30 p-0 overflow-hidden">
                  <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Activity size={20} className="text-brand-600" />
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Live Transaction Pulse</h3>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">Real-time density for {timeRange}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-8">
                    <div className="relative h-32 w-full">
                      <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <defs>
                          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {recentBills.length > 0 ? (
                          <>
                            <path
                              d={`M 0 100 ${recentBills.slice().reverse().map((b, i) => {
                                const maxVal = Math.max(...recentBills.map(rb => rb.total)) || 1000;
                                const x = (i / (Math.max(1, recentBills.length - 1))) * 100;
                                const y = 100 - (Math.min(90, (b.total / maxVal) * 80 + 10));
                                return `L ${x} ${y}`;
                              }).join(' ')} L 100 100 Z`}
                              fill="url(#chartGradient)"
                            />
                            <path
                              d={`M 0 ${(() => {
                                const last = recentBills[recentBills.length - 1];
                                const maxVal = Math.max(...recentBills.map(rb => rb.total)) || 1000;
                                return 100 - (Math.min(90, ((last?.total || 0) / maxVal) * 80 + 10));
                              })()} ${recentBills.slice().reverse().map((b, i) => {
                                const maxVal = Math.max(...recentBills.map(rb => rb.total)) || 1000;
                                const x = (i / (Math.max(1, recentBills.length - 1))) * 100;
                                const y = 100 - (Math.min(90, (b.total / maxVal) * 80 + 10));
                                return `L ${x} ${y}`;
                              }).join(' ')}`}
                              fill="none"
                              stroke="#4f46e5"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </>
                        ) : (
                          <line x1="0" y1="90" x2="100" y2="90" stroke="#f1f5f9" strokeWidth="2" strokeDasharray="4 4" />
                        )}
                      </svg>
                      {recentBills.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Awaiting Transaction Data</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
                    <div className="flex items-center gap-3">
                      <History size={18} className="text-slate-400" />
                      <h3 className="text-lg font-black text-slate-900">Operational Feed</h3>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                      <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                        {["All", "Order", "Res", "Wait"].map(f => (
                          <button
                            key={f}
                            onClick={() => setFeedFilter(f as "All" | "Order" | "Res" | "Wait")}
                            className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${feedFilter === f ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {f === 'Res' ? 'Book' : f === 'Wait' ? 'Wait' : f}
                          </button>
                        ))}
                      </div>
                      <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                      <select
                        value={feedSort}
                        onChange={(e) => setFeedSort(e.target.value as "Time" | "Status")}
                        className="bg-white border border-slate-200 rounded-xl px-3 py-1 text-[9px] font-black uppercase outline-none text-slate-600 shadow-sm"
                      >
                        <option value="Time">LATEST</option>
                        <option value="Status">STATUS</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {activityFeed.map((item) => (
                      <div key={item.id} className="group relative flex items-center justify-between p-4 rounded-3xl bg-white border border-slate-100 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/5 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-2xl ${item.status === 'pending' || item.status === 'confirmed' || item.status === 'waiting' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                            <item.icon size={16} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.type} {item.order_number ? `#${item.order_number}` : ''}</span>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${item.status === 'ready' || item.status === 'seated' ? 'bg-emerald-100 text-emerald-700' : item.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">{item.table?.name || item.name || "Quick Bill"}</h4>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          <ArrowUpRight size={14} className="ml-auto mt-1 text-slate-200 group-hover:text-brand-500 transition-colors" />
                        </div>
                      </div>
                    ))}
                    {activityFeed.length === 0 && (
                      <div className="py-20 text-center rounded-3xl border-2 border-dashed border-slate-100 bg-white">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-300">No activity in this period</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                {/* Modules Grid */}
                <div className="space-y-4">
                  <h3 className="px-2 text-sm font-black text-slate-900 uppercase tracking-widest">Active Modules</h3>
                  <div className="grid gap-3">
                    {modules.map(mod => (
                      <Link
                        key={mod.label}
                        href={(mod as any).comingSoon ? "#" : mod.href}
                        className={`group flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-4 transition-all ${(mod as any).comingSoon ? "opacity-60 cursor-not-allowed" : "hover:border-brand-500 hover:shadow-xl hover:shadow-brand-500/5"}`}
                        onClick={(e) => (mod as any).comingSoon && e.preventDefault()}
                      >
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ${(mod as any).comingSoon ? "" : "group-hover:bg-brand-600 group-hover:text-white"} transition-all`}>
                          <mod.icon size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{mod.label}</h4>
                            {(mod as any).comingSoon && <span className="text-[7px] font-black bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full uppercase">Soon</span>}
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{mod.description}</p>
                        </div>
                        {!(mod as any).comingSoon && <Sparkles size={16} className="text-slate-100 group-hover:text-brand-100" />}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Low Stock Alerts */}
                {lowStockItems.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Stock Alerts</h3>
                      <span className="bg-rose-100 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-full">{lowStockItems.length}</span>
                    </div>
                    <div className="grid gap-3">
                      {lowStockItems.slice(0, 4).map(item => (
                        <div key={item.id} className="flex items-center justify-between p-4 rounded-3xl bg-rose-50/30 border border-rose-100/50">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                              <AlertCircle size={14} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-slate-800">{item.name}</h4>
                              <p className="text-[9px] font-black text-rose-500 uppercase">Critical ({item.current_stock} {item.unit})</p>
                            </div>
                          </div>
                          <Link href="/inventory" className="p-2 rounded-xl bg-white text-slate-400 hover:text-brand-600 hover:shadow-sm transition-all">
                            <ArrowUpRight size={14} />
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* System Health View */}
                <div className="rounded-[2.5rem] bg-indigo-900 p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/40">
                  <div className="absolute -right-8 -bottom-8 opacity-10">
                    <Sparkles size={160} />
                  </div>
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
                        <CheckCircle2 size={20} className="text-indigo-300" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Operations Status</p>
                        <h4 className="text-lg font-bold">All Systems Live</h4>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-400 rounded-full w-4/5" />
                      </div>
                      <p className="text-[10px] font-bold text-indigo-200">System performing at high efficiency. Real-time engine is currently handling spikes optimally.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
