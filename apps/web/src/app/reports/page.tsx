"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Receipt,
  CreditCard,
  Smartphone,
  Banknote,
  RefreshCw,
  BarChart3,
  Calendar
} from "lucide-react";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { Card } from "../../components/ui/Card";
import { Section } from "../../components/ui/Section";
import { StatCard } from "../../components/ui/StatCard";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";
import { Button } from "../../components/ui/Button";
import { DatePicker } from "../../components/ui/DatePicker";
import { FileText, Download, Printer } from "lucide-react";

type TimeFrame = "today" | "month" | "year" | "custom";

type ReportData = {
  sales: number;
  orders: number;
  tax: number;
  paymentModes: Record<string, number>;
  rawBills: any[];
};

export default function ReportsPage() {
  const [timeframe, setTimeframe] = useState<TimeFrame>("today");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async (frame: TimeFrame) => {
    setLoading(true);
    const profile = await getCurrentUserProfile();
    if (!profile?.active_restaurant_id || !profile.active_branch_id) return;

    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (frame === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (frame === "month") {
      start = new Date(start.getFullYear(), start.getMonth(), 1, 0, 0, 0);
    } else if (frame === "year") {
      start = new Date(start.getFullYear(), 0, 1, 0, 0, 0);
    } else if (frame === "custom" && customRange.start && customRange.end) {
      start = new Date(customRange.start);
      start.setHours(0, 0, 0, 0);
      end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
    } else if (frame === "custom") {
      setLoading(false);
      return;
    }

    // 1. Fetch Summary via RPC
    const { data: summary, error: rpcError } = await supabase.rpc('get_sales_report', {
      p_branch_id: profile.active_branch_id,
      p_start_date: start.toISOString(),
      p_end_date: end.toISOString(),
    });

    if (rpcError) {
      console.error('RPC Error:', rpcError);
      // Fallback or handle error
    }

    // 2. Fetch raw bills for export
    // Fetch bills with payment info
    const { data: bills } = await supabase
      .from("bills")
      .select("*, payments(mode, amount), order:orders(order_number)")
      .eq("branch_id", profile.active_branch_id)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });

    // Parse data from RPC
    const totalSales = summary?.gross_sales || 0;
    const totalTax = summary?.total_tax || 0;
    const orderCount = summary?.order_count || 0;
    const modes = summary?.payment_modes || {};

    setData({
      sales: totalSales,
      orders: orderCount,
      tax: totalTax,
      paymentModes: modes,
      rawBills: bills ?? []
    });
    setLoading(false);
  };

  useEffect(() => {
    if (timeframe !== "custom") {
      loadData(timeframe);
    }
  }, [timeframe]);

  useEffect(() => {
    if (timeframe === "custom" && customRange.start && customRange.end) {
      loadData("custom");
    }
  }, [customRange]);

  const getModeIcon = (mode: string) => {
    switch (mode.toLowerCase()) {
      case 'cash': return <Banknote size={16} className="text-emerald-500" />;
      case 'upi': return <Smartphone size={16} className="text-brand-500" />;
      case 'card': return <CreditCard size={16} className="text-indigo-500" />;
      default: return <RefreshCw size={16} className="text-slate-400" />;
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode.toLowerCase()) {
      case 'cash': return 'bg-emerald-500';
      case 'upi': return 'bg-brand-500';
      case 'card': return 'bg-indigo-500';
      default: return 'bg-slate-400';
    }
  };

  const handleExportExcel = () => {
    if (!data || data.rawBills.length === 0) return;

    const headers = ["Bill ID", "Order #", "Date", "Subtotal", "Tax", "Discount", "Total", "Payment Modes"];
    const rows = data.rawBills.map(b => [
      b.id,
      b.order?.order_number || "N/A",
      new Date(b.created_at).toLocaleString(),
      b.subtotal,
      b.tax,
      b.discount,
      b.total,
      b.payments?.map((p: any) => `${p.mode}: ${p.amount}`).join(" | ") || "N/A"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Sales_Report_${timeframe}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const sortedModes = data ? Object.entries(data.paymentModes).sort((a, b) => b[1] - a[1]) : [];

  return (
    <AuthGate>
      <AppShell title="Live Analytics" subtitle="Real-time financial performance and channel audits">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex rounded-2xl bg-slate-100 p-1">
              {(["today", "month", "year", "custom"] as TimeFrame[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setTimeframe(f)}
                  className={`rounded-xl px-6 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${timeframe === f
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {timeframe === "custom" && (
              <div className="flex items-end gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="w-56">
                  <DatePicker
                    label="From Date"
                    value={customRange.start}
                    onChange={(date) => setCustomRange(prev => ({ ...prev, start: date }))}
                  />
                </div>
                <div className="mb-3 text-[10px] font-black text-slate-400">TO</div>
                <div className="w-56">
                  <DatePicker
                    label="To Date"
                    value={customRange.end}
                    onChange={(date) => setCustomRange(prev => ({ ...prev, end: date }))}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Download size={14} className="mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              className="rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <Printer size={14} className="mr-2" />
              PDF
            </Button>
            <button
              onClick={() => loadData(timeframe)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-brand-600"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-44 animate-pulse rounded-[2.5rem] bg-slate-100" />
            ))}
          </div>
        ) : data && (
          <div className="space-y-8">
            <Section title="Key Metrics" description="Consolidated revenue and volume data">
              <div className="grid gap-6 md:grid-cols-3">
                <StatCard
                  label="Gross Revenue"
                  value={`₹${data.sales.toLocaleString()}`}
                  icon={TrendingUp}
                  color="brand"
                  description="Total billing volume"
                />
                <StatCard
                  label="Order Volume"
                  value={data.orders}
                  icon={ShoppingBag}
                  color="indigo"
                  description="Total tickets created"
                />
                <StatCard
                  label="Tax Liability"
                  value={`₹${data.tax.toLocaleString()}`}
                  icon={Receipt}
                  color="rose"
                  description="GST collection audit"
                />
              </div>
            </Section>

            <div className="grid gap-8 lg:grid-cols-2">
              <Section title="Payment Audit" description="Revenue distribution by collection channel">
                <Card>
                  {sortedModes.length > 0 ? (
                    <div className="space-y-6">
                      {sortedModes.map(([mode, amount]) => {
                        const percentage = (amount / data.sales) * 100;
                        return (
                          <div key={mode} className="group flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 transition-colors group-hover:bg-slate-100">
                                  {getModeIcon(mode)}
                                </div>
                                <span className="text-sm font-black uppercase tracking-widest text-slate-900">{mode}</span>
                              </div>
                              <span className="text-sm font-black text-slate-900">₹{amount.toLocaleString()}</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full transition-all duration-1000 ${getModeColor(mode)}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <BarChart3 size={48} className="mb-4 text-slate-200" />
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">No payment data available</p>
                    </div>
                  )}
                </Card>
              </Section>

              <Section title="Growth Insights" description="Deep dive into temporal patterns">
                <Card>
                  <div className="flex h-[280px] flex-col items-center justify-center text-center">
                    <div className="mb-6 rounded-3xl bg-amber-50 p-6 text-amber-500">
                      <Calendar size={32} />
                    </div>
                    <h4 className="mb-2 text-sm font-black uppercase tracking-widest text-slate-900">Temporal Patterns</h4>
                    <p className="max-w-[280px] text-[10px] font-bold uppercase leading-relaxed tracking-tight text-slate-400">
                      Advanced hourly distribution and period-over-period growth charts will appear here as more data is collected.
                    </p>
                  </div>
                </Card>
              </Section>
            </div>
          </div>
        )}
        {/* Hidden Print Styling */}
        <style jsx global>{`
          @media print {
            .no-print { display: none !important; }
            body { padding: 0 !important; }
            .print-only { display: block !important; }
            @page { margin: 2cm; }
          }
          .print-only { display: none; }
        `}</style>
      </AppShell>
    </AuthGate>
  );
}
