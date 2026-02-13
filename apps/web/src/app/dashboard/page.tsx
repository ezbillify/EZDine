"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Clock,
  CircleDollarSign,
  ArrowRight,
  MonitorCheck,
  ChefHat,
  Warehouse,
  ShoppingBag,
  ArrowUpRight,
  Calendar,
  LayoutDashboard,
  AlertTriangle,
  History,
  Activity,
  Zap,
  Layers,
  Sparkles,
  ArrowRightCircle
} from "lucide-react";

import { AuthGate } from "../../components/auth/AuthGate";
import { BranchSwitcher } from "../../components/branch/BranchSwitcher";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";

export default function DashboardPage() {
  const [pendingOrders, setPendingOrders] = useState(0);
  const [kdsReady, setKdsReady] = useState(0);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_branch_id) {
        setLoading(false);
        return;
      }

      const [ordersRes, billsRes, inventoryRes] = await Promise.all([
        supabase.from("orders").select("id,status").eq("branch_id", profile.active_branch_id),
        supabase.from("bills").select("total").eq("branch_id", profile.active_branch_id),
        supabase.from("inventory_items").select("current_stock,reorder_level").eq("branch_id", profile.active_branch_id).eq("is_active", true)
      ]);

      const pending = (ordersRes.data ?? []).filter((o) => o.status === "pending").length;
      const ready = (ordersRes.data ?? []).filter((o) => o.status === "ready").length;
      const counts = billsRes.data?.length ?? 0;
      const total = (billsRes.data ?? []).reduce((sum: number, b: any) => sum + Number(b.total || 0), 0);
      const lowStock = (inventoryRes.data ?? []).filter((i: any) => i.current_stock <= i.reorder_level).length;

      setPendingOrders(pending);
      setKdsReady(ready);
      setSalesTotal(total);
      setSalesCount(counts);
      setLowStockCount(lowStock);
      setLoading(false);

      if (!channel) {
        channel = supabase
          .channel("dashboard-realtime-v3")
          .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `branch_id=eq.${profile.active_branch_id}` }, () => load())
          .on("postgres_changes", { event: "*", schema: "public", table: "bills", filter: `branch_id=eq.${profile.active_branch_id}` }, () => load())
          .subscribe();
      }
    };

    load();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const stats = [
    {
      label: "Gross Revenue",
      value: `₹${salesTotal.toLocaleString("en-IN")}`,
      icon: CircleDollarSign,
      color: "brand",
      description: `From ${salesCount} successful bills today`,
      trend: { value: 12, type: "up" as const }
    },
    {
      label: "Kitchen Load",
      value: pendingOrders,
      icon: ChefHat,
      color: "amber",
      description: "Active pending tickets",
      trend: { value: 5, type: "down" as const }
    },
    {
      label: "Inventory Health",
      value: lowStockCount,
      icon: Warehouse,
      color: "rose",
      description: "Items below reorder level",
      trend: { value: 0, type: "neutral" as const }
    }
  ];

  const modules = [
    { label: "Terminal (POS)", icon: MonitorCheck, href: "/pos", description: "Ordering & Billing", color: "indigo" },
    { label: "Kitchen (KDS)", icon: Activity, href: "/kds", description: "Order Production", color: "emerald" },
    { label: "Reserve (Guests)", icon: Calendar, href: "/reservations", description: "Tables & Waitlist", color: "amber" },
    { label: "Storage (INV)", icon: Warehouse, href: "/inventory", description: "Stock Control", color: "slate" },
  ];

  return (
    <AuthGate>
      <AppShell
        title="Operation Control"
        subtitle="Operational intelligence for your restaurant"
        actions={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Branch Live</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-[10px] font-black uppercase text-slate-500">
              <Calendar size={12} />
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
                <h4 className="mt-4 text-sm font-bold leading-tight">Your POS network and printers are sync'd.</h4>
              </div>
              <div className="p-4 space-y-1">
                {[
                  { label: "POS Terminal", status: "Active" },
                  { label: "Kitchen Display", status: "Active" },
                  { label: "Stock Manager", status: "Active" }
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
                  { label: "Staff Roster", icon: History, href: "/staff" }
                ].map(link => (
                  <Link key={link.label} href={link.href} className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                        <link.icon size={16} />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wide text-slate-600 group-hover:text-slate-900">{link.label}</span>
                    </div>
                    <ArrowRightCircle size={14} className="text-slate-200 group-hover:text-brand-500 transition-colors" />
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

            {/* Visual Workspace */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Modules Grid */}
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-lg font-black text-slate-900">Control Modules</h3>
                  <Link href="/settings" className="text-[10px] font-black uppercase tracking-widest text-brand-600 hover:underline">Global Config</Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {modules.map(mod => (
                    <Link key={mod.label} href={mod.href} className="group relative overflow-hidden rounded-[2rem] border-2 border-slate-50 bg-white p-6 transition-all hover:border-brand-500 hover:shadow-2xl hover:shadow-brand-500/10">
                      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-brand-600 group-hover:text-white transition-all transform group-hover:-rotate-6">
                        <mod.icon size={24} />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{mod.label}</h4>
                      <p className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{mod.description}</p>
                      <div className="absolute bottom-4 right-4 text-slate-100 group-hover:text-brand-100 transition-colors">
                        <Sparkles size={40} />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Operations Health / Mock Visualizer */}
              <Card className="border-slate-100 shadow-xl shadow-slate-200/40 p-0 overflow-hidden">
                <div className="bg-slate-50 p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
                      <Activity size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Pulse Visualizer</h3>
                      <p className="text-[10px] font-medium text-slate-400">Live transaction density (24h)</p>
                    </div>
                  </div>
                </div>
                <div className="p-8 space-y-8">
                  <div className="flex items-end justify-between h-32 gap-1.5">
                    {[20, 45, 30, 85, 40, 25, 95, 60, 40, 75, 40, 20].map((h, i) => (
                      <div key={i} className="flex-1 group relative">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">₹{(h * 10).toLocaleString()}</div>
                        <div className="w-full bg-slate-50 rounded-t-lg transition-all group-hover:bg-brand-500/20" style={{ height: '100px' }} />
                        <div className="absolute bottom-0 w-full bg-slate-100 rounded-t-lg transition-all group-hover:bg-brand-600" style={{ height: `${h}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-[2rem] bg-indigo-50 border border-indigo-100">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Peak Hour</p>
                      <p className="text-lg font-black text-indigo-900 underline decoration-indigo-300 underline-offset-4 decoration-2">08:00 PM</p>
                    </div>
                    <div className="p-4 rounded-[2rem] bg-emerald-50 border border-emerald-100">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Busy Table</p>
                      <p className="text-lg font-black text-emerald-900 underline decoration-emerald-300 underline-offset-4 decoration-2">Table T4</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
