"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package,
  Clock,
  CheckCircle2,
  ChefHat,
  Timer,
  MoreVertical,
  Utensils,
  Play,
  Check,
  Flag,
  RotateCcw,
  XCircle,
  Printer,
  History
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface OrderBoardProps {
  selectedDate?: string; // YYYY-MM-DD
}

export function OrderBoard({ selectedDate }: OrderBoardProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const formatIST = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(dateStr));
  };

  const fetchOrders = useCallback(async (bId: string, date?: string) => {
    try {
      let query = supabase
        .from("orders")
        .select(`
          id, 
          order_number, 
          status, 
          table_id, 
          created_at,
          table:tables(name),
          order_items(
            id,
            quantity,
            status,
            notes,
            menu_item:menu_items(name, is_veg)
          )
        `)
        .eq("branch_id", bId);

      if (date) {
        const dateObj = new Date(date);
        const start = new Date(dateObj);
        start.setUTCHours(0 - 5, 0 - 30, 0, 0);
        const end = new Date(dateObj);
        end.setUTCHours(23 - 5, 59 - 30, 59, 999);
        query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setOrders(data ?? []);
    } catch (err) {
      console.error("Fetch orders error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_branch_id) {
        setLoading(false);
        return;
      }
      await fetchOrders(profile.active_branch_id, selectedDate);

      const today = new Date().toLocaleDateString('en-CA');
      if (selectedDate === today || !selectedDate) {
        channel = supabase
          .channel(`branch-orders-${profile.active_branch_id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "orders",
              filter: `branch_id=eq.${profile.active_branch_id}`
            },
            () => fetchOrders(profile.active_branch_id!, selectedDate)
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "order_items",
            },
            () => fetchOrders(profile.active_branch_id!, selectedDate)
          )
          .subscribe();
      }
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchOrders, selectedDate]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      await supabase
        .from("order_items")
        .update({ status: newStatus })
        .eq("order_id", orderId);

      setActiveMenu(null);
      toast.success(`Order marked as ${newStatus}`);
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this entire order?")) return;
    updateStatus(orderId, "cancelled");
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return { color: "text-amber-600", bg: "bg-amber-50", icon: Clock, label: "Pending" };
      case "preparing":
        return { color: "text-blue-600", bg: "bg-blue-50", icon: ChefHat, label: "Preparing" };
      case "ready":
        return { color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle2, label: "Ready" };
      case "served":
        return { color: "text-slate-500", bg: "bg-slate-100", icon: Utensils, label: "Served" };
      case "cancelled":
        return { color: "text-rose-600", bg: "bg-rose-50", icon: XCircle, label: "Cancelled" };
      default:
        return { color: "text-slate-400", bg: "bg-slate-50", icon: Package, label: status };
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
          <p className="text-sm font-medium text-slate-500">Loading live orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster richColors position="bottom-right" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {orders.length === 0 ? (
          <div className="col-span-full flex h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50">
            <Package className="mb-4 text-slate-300" size={48} />
            <p className="text-lg font-bold text-slate-400">No orders found</p>
            <p className="text-sm text-slate-400">Try selecting a different date or wait for new orders.</p>
          </div>
        ) : (
          orders.map((order) => {
            const config = getStatusConfig(order.status);
            const StatusIcon = config.icon;
            const isMenuOpen = activeMenu === order.id;

            return (
              <Card key={order.id} className="group relative flex flex-col overflow-hidden border-slate-100 p-0 transition-all hover:border-brand-200 hover:shadow-xl hover:shadow-brand-500/5">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-50 bg-slate-50/30 p-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {order.order_number || `#${order.id.slice(0, 6)}`}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">
                      {order.table?.name || "Takeaway"}
                    </h3>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${config.bg} ${config.color} shadow-inner`}>
                    <StatusIcon size={20} />
                  </div>
                </div>

                {/* Status Bar */}
                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-50">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1 text-[11px] font-black text-slate-900">
                      <Clock size={12} className="text-brand-600" />
                      {formatIST(order.created_at)}
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="flex-1 space-y-1.5 p-4 bg-white">
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50/50 p-2 text-sm border border-transparent hover:border-slate-100">
                      <div className="flex gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-50 text-[10px] font-bold text-brand-600">
                          {item.quantity}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 leading-tight">{item.menu_item?.name}</span>
                          {item.notes && <span className="text-[10px] text-orange-600 italic">"{item.notes}"</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!order.order_items || order.order_items.length === 0) && (
                    <p className="text-xs text-slate-400 italic py-4 text-center">No items listed</p>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="relative mt-auto">
                  {/* Options Menu Dropdown */}
                  {isMenuOpen && (
                    <div className="absolute bottom-full left-0 right-0 z-10 border-t border-slate-100 bg-white p-2 shadow-2xl animate-slide-up">
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="ghost" className="h-10 text-[10px] uppercase font-bold text-slate-600 justify-start gap-2" onClick={() => updateStatus(order.id, "pending")}>
                          <RotateCcw size={14} /> Move to Pending
                        </Button>
                        <Button variant="ghost" className="h-10 text-[10px] uppercase font-bold text-slate-600 justify-start gap-2" onClick={() => toast.info("Printing KOT...")}>
                          <Printer size={14} /> Reprint KOT
                        </Button>
                        <Button variant="ghost" className="h-10 text-[10px] uppercase font-bold text-rose-600 justify-start gap-2" onClick={() => cancelOrder(order.id)}>
                          <XCircle size={14} /> Cancel Order
                        </Button>
                        <Button variant="ghost" className="h-10 text-[10px] uppercase font-bold text-slate-600 justify-start gap-2" onClick={() => setActiveMenu(null)}>
                          <History size={14} /> View History
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex bg-slate-100 divide-x divide-slate-200 border-t border-slate-200">
                    {/* Primary Action Button */}
                    {order.status !== "served" && order.status !== "cancelled" && (
                      <button
                        onClick={() => {
                          if (order.status === "pending") updateStatus(order.id, "preparing");
                          else if (order.status === "preparing") updateStatus(order.id, "ready");
                          else if (order.status === "ready") updateStatus(order.id, "served");
                        }}
                        className={`flex flex-1 items-center justify-center gap-2 bg-white py-4 text-xs font-black uppercase tracking-widest transition-colors ${order.status === "pending" ? "text-blue-600 hover:bg-blue-50" :
                            order.status === "preparing" ? "text-emerald-600 hover:bg-emerald-50" :
                              "text-slate-900 hover:bg-slate-50"
                          }`}
                      >
                        {order.status === "pending" && <><ChefHat size={14} /> Start Prep</>}
                        {order.status === "preparing" && <><CheckCircle2 size={14} /> Ready</>}
                        {order.status === "ready" && <><Utensils size={14} /> Served</>}
                      </button>
                    )}

                    {/* Full width options for final states */}
                    {(order.status === "served" || order.status === "cancelled") && (
                      <div className="flex-1 py-4 bg-slate-50/50 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {order.status} Order
                      </div>
                    )}

                    {/* Options Toggle Button */}
                    <button
                      onClick={() => setActiveMenu(isMenuOpen ? null : order.id)}
                      className={`flex w-20 items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-widest transition-colors ${isMenuOpen ? 'bg-slate-200 text-slate-900' : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
