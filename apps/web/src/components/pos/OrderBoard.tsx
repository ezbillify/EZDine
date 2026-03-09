"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Package,
  Clock,
  CheckCircle2,
  ChefHat,
  MoreVertical,
  Utensils,
  RotateCcw
} from "lucide-react";
import { toast, Toaster } from "sonner";

import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface OrderBoardProps {
  selectedDate?: string; // YYYY-MM-DD
}

interface OrderItem {
  id: string;
  quantity: number;
  status: string;
  notes?: string;
  menu_item?: {
    name: string;
    is_veg: boolean;
  };
}

interface Order {
  id: string;
  order_number: string;
  token_number?: number;
  status: string;
  table_id?: string;
  created_at: string;
  table?: {
    name: string;
  };
  order_items: OrderItem[];
}

export function OrderBoard({ selectedDate }: OrderBoardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
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
          token_number,
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
      setOrders((data as unknown as Order[]) ?? []);
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
    } catch (err: unknown) {
      console.error("Update status error:", err);
      toast.error("Failed to update order");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "text-amber-500 bg-amber-50 border-amber-100";
      case "preparing": return "text-blue-500 bg-blue-50 border-blue-100";
      case "ready": return "text-emerald-500 bg-emerald-50 border-emerald-100";
      case "served": return "text-slate-500 bg-slate-50 border-slate-100";
      default: return "text-slate-500 bg-slate-50 border-slate-100";
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Toaster position="top-center" />
      {orders.length === 0 ? (
        <div className="col-span-full py-20 text-center text-slate-400">
          <Package className="mx-auto mb-4 h-12 w-12 opacity-20" />
          <p className="font-bold">No orders found for this date</p>
        </div>
      ) : (
        orders.map((order) => (
          <Card key={order.id} className="relative overflow-hidden border-slate-100 bg-white p-6 shadow-sm shadow-slate-200/50">
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">#{order.order_number}</span>
                  {order.token_number && (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">TOKEN {order.token_number}</span>
                  )}
                </div>
                <h4 className="text-lg font-black text-slate-900">
                  {order.table?.name || "Takeaway"}
                </h4>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <Clock size={12} />
                  {formatIST(order.created_at)}
                </div>
              </div>

              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setActiveMenu(activeMenu === order.id ? null : order.id)}
                >
                  <MoreVertical size={18} />
                </Button>

                {activeMenu === order.id && (
                  <div className="absolute right-0 top-10 z-10 w-48 rounded-2xl border border-slate-100 bg-white p-2 shadow-xl shadow-slate-200/50">
                    <button
                      onClick={() => updateStatus(order.id, "pending")}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      <RotateCcw size={14} /> Mark Pending
                    </button>
                    <button
                      onClick={() => updateStatus(order.id, "preparing")}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold text-blue-600 hover:bg-blue-50"
                    >
                      <ChefHat size={14} /> Start Preparing
                    </button>
                    <button
                      onClick={() => updateStatus(order.id, "ready")}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold text-emerald-600 hover:bg-emerald-50"
                    >
                      <CheckCircle2 size={14} /> Mark Ready
                    </button>
                    <button
                      onClick={() => updateStatus(order.id, "served")}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-bold text-slate-900 hover:bg-slate-50"
                    >
                      <Utensils size={14} /> Mark Served
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="mb-6 space-y-3">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-2">
                    <div className={`mt-1 h-3 w-3 rounded-sm border ${item.menu_item?.is_veg ? 'border-emerald-500' : 'border-red-500'} flex items-center justify-center p-0.5`}>
                      <div className={`h-full w-full rounded-full ${item.menu_item?.is_veg ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">
                        {item.quantity}x {item.menu_item?.name}
                      </p>
                      {item.notes && <p className="text-[10px] italic text-slate-400 font-medium">&quot;{item.notes}&quot;</p>}
                    </div>
                  </div>
                  <span className={`rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${getStatusColor(item.status)}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 border-t border-slate-50 pt-4">
              {order.status === "pending" && (
                <Button
                  className="flex-1 rounded-xl bg-blue-600 text-[10px] font-black uppercase tracking-widest h-10 hover:bg-blue-700"
                  onClick={() => updateStatus(order.id, "preparing")}
                >
                  Start Preparing
                </Button>
              )}
              {order.status === "preparing" && (
                <Button
                  className="flex-1 rounded-xl bg-emerald-600 text-[10px] font-black uppercase tracking-widest h-10 hover:bg-emerald-700"
                  onClick={() => updateStatus(order.id, "ready")}
                >
                  Mark Ready
                </Button>
              )}
              {order.status === "ready" && (
                <Button
                  className="flex-1 rounded-xl bg-slate-900 text-[10px] font-black uppercase tracking-widest h-10 hover:bg-slate-800"
                  onClick={() => updateStatus(order.id, "served")}
                >
                  Mark Served
                </Button>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
