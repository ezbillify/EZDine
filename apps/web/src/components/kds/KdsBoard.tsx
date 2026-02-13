"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, ChefHat, Flame } from "lucide-react";
import { toast, Toaster } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { updateOrderItemsStatus } from "../../lib/pos";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";
import { Button } from "../ui/Button";

type OrderItem = {
  id: string;
  item_id: string;
  quantity: number;
  notes?: string;
  menu_item?: {
    name: string;
  };
};

type Order = {
  id: string;
  order_number: string;
  token_number?: number;
  status: "pending" | "preparing" | "ready" | "served";
  created_at: string;
  source: string;
  table?: {
    name: string;
  };
  order_items: OrderItem[];
};

export function KdsBoard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_branch_id) return;

      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          token_number,
          status,
          source,
          created_at,
          table:tables(name),
          payment_status,
          payment_method,
          order_items(
            id,
            quantity,
            notes,
            item_id,
            menu_item:menu_items(name)
          )
        `)
        .eq("branch_id", profile.active_branch_id)
        .in("status", ["pending", "preparing", "ready"])
        .order("created_at", { ascending: true }); // Oldest first for kitchen

      if (error) throw error;
      setOrders(data as any);
    } catch (err) {
      console.error("KDS Load Error", err);
    } finally {
      setLoading(false);
    }
  };

  const playBuzzer = () => {
    try {
      console.log("🔊 Playing Loud KDS Buzzer...");
      const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtxClass) return;

      const audioCtx = new AudioCtxClass();

      const playPulse = (delay: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth'; // Harsher waveform
        osc.frequency.setValueAtTime(220, audioCtx.currentTime + delay); // Low G

        gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + delay + 0.05); // Rapid attack
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + delay + 0.3); // Decay

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + delay);
        osc.stop(audioCtx.currentTime + delay + 0.3);
      };

      if (audioCtx.state === 'suspended') audioCtx.resume();

      // Triple Pulse
      playPulse(0);
      playPulse(0.4);
      playPulse(0.8);

      console.log("🔊 KDS Buzzer sequence finished");
    } catch (e) {
      console.error("Audio buzzer failed", e);
    }
  };

  useEffect(() => {
    load();

    // Realtime Subscription
    const channel = supabase
      .channel('kds-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log("🔔 KDS Realtime Event:", payload.eventType, payload.new);
          const newOrder = payload.new as any;
          const eventType = payload.eventType;

          // Sound Trigger: Play if it's a new or updated order that kitchen needs to see
          const isVisibleInKds = newOrder.status === 'pending' && (newOrder.source === 'pos' || newOrder.payment_status === 'paid');

          if (isVisibleInKds && (eventType === 'INSERT' || eventType === 'UPDATE')) {
            console.log("🔥 Triggering Buzzer for Order:", newOrder.order_number);
            playBuzzer();
            toast.info(`New Kitchen Order: #${newOrder.order_number}`, {
              description: `Table: ${newOrder.table_id || 'Quick Bill'}`,
              duration: 5000
            });
          }

          load();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const advance = async (id: string, currentStatus: string, nextStatus: string) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: nextStatus as any } : o));

    try {
      if (nextStatus === "served") {
        await updateOrderItemsStatus(id, "served");
        await supabase.from("orders").update({ status: "served" }).eq("id", id);
      } else {
        await supabase.from("orders").update({ status: nextStatus }).eq("id", id);
      }
      toast.success(`Order marked ${nextStatus}`);
      load();
    } catch (err) {
      toast.error("Failed to update status");
      load(); // Revert
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"></div>
          <p className="text-sm font-medium text-slate-500">Loading KDS...</p>
        </div>
      </div>
    );
  }

  const validOrders = orders.filter(o => {
    // Strict Filter: Hide ALL non-POS orders until they are PAID.
    // This covers 'online' (Razorpay) and 'cash' (Pay at Counter) from QR flow.
    // Ideally, for 'cash', the cashier marks it as Paid in POS, then it appears in KDS.
    if ((o as any).source !== 'pos' && (o as any).payment_status !== 'paid') {
      return false;
    }
    return true;
  });

  const pendingOrders = validOrders.filter(o => o.status === "pending");
  const preparingOrders = validOrders.filter(o => o.status === "preparing");
  const readyOrders = validOrders.filter(o => o.status === "ready");

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="grid h-full grid-cols-1 gap-6 overflow-hidden md:grid-cols-3">
        {/* 1. TO DO / PENDING */}
        <section className="flex flex-col gap-4 overflow-hidden rounded-2xl bg-slate-50/50 p-4 border border-slate-200 shadow-sm">
          <header className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 shadow-sm">
                <Clock size={20} className="animate-pulse" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800">Pending</h2>
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">New Items</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={playBuzzer}
                className="flex h-6 items-center gap-1 rounded-full bg-slate-100 px-2 text-[10px] font-bold text-slate-500 hover:bg-slate-200 transition-colors"
              >
                Test Sound
              </button>
              <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-orange-100 px-2 text-xs font-bold text-orange-700">
                {pendingOrders.length}
              </span>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {pendingOrders.map(order => (
              <KdsCard key={order.id} order={order} onAdvance={() => advance(order.id, "pending", "preparing")} actionLabel="Start Cooking" actionIcon={<Flame size={16} />} />
            ))}
            {pendingOrders.length === 0 && <EmptyState label="No pending orders" />}
          </div>
        </section>

        {/* 2. IN PROGRESS / PREPARING */}
        <section className="flex flex-col gap-4 overflow-hidden rounded-2xl bg-blue-50/30 p-4 border border-blue-100 shadow-sm">
          <header className="flex items-center justify-between border-b border-blue-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-sm">
                <ChefHat size={20} />
              </div>
              <div>
                <h2 className="font-bold text-blue-900">Preparing</h2>
                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Live Kitchen</p>
              </div>
            </div>
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-blue-100 px-2 text-xs font-bold text-blue-700">
              {preparingOrders.length}
            </span>
          </header>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {preparingOrders.map(order => (
              <KdsCard key={order.id} order={order} onAdvance={() => advance(order.id, "preparing", "ready")} actionLabel="Mark Ready" actionIcon={<CheckCircle2 size={16} />} variant="blue" />
            ))}
            {preparingOrders.length === 0 && <EmptyState label="No active cooking" />}
          </div>
        </section>

        {/* 3. READY / SERVE */}
        <section className="flex flex-col gap-4 overflow-hidden rounded-2xl bg-emerald-50/30 p-4 border border-emerald-100 shadow-sm">
          <header className="flex items-center justify-between border-b border-emerald-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shadow-sm">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h2 className="font-bold text-emerald-900">Ready</h2>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">To Be Served</p>
              </div>
            </div>
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-100 px-2 text-xs font-bold text-emerald-700">
              {readyOrders.length}
            </span>
          </header>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {readyOrders.map(order => (
              <KdsCard key={order.id} order={order} onAdvance={() => advance(order.id, "ready", "served")} actionLabel="Serve Items" actionIcon={<CheckCircle2 size={16} />} variant="emerald" />
            ))}
            {readyOrders.length === 0 && <EmptyState label="No ready orders" />}
          </div>
        </section>
      </div>
    </>
  );
}

function KdsCard({ order, onAdvance, actionLabel, actionIcon, variant = "default" }: { order: Order; onAdvance: () => void; actionLabel: string; actionIcon: any; variant?: "default" | "blue" | "emerald" }) {
  const elapsed = formatDistanceToNow(new Date(order.created_at), { addSuffix: true }).replace("about ", "");

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-brand-200">
      {/* Status Bar */}
      <div className={`absolute top-0 left-0 h-1 w-full rounded-t-xl ${variant === "blue" ? "bg-blue-500" : variant === "emerald" ? "bg-emerald-500" : "bg-orange-400"
        }`} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase text-slate-400">#{order.order_number}</span>
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{elapsed}</span>
            {order.source !== 'pos' && (
              <span className="text-[10px] font-black text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded uppercase tracking-tighter">QR</span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-0.5">{order.table?.name || (order.source === 'pos' ? "POS Direct" : "Online Ordering")}</h3>
        </div>

        {order.token_number && (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg ring-4 ring-white">
            <span className="text-xl font-black">{order.token_number}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="my-1 space-y-2 border-y border-dashed border-slate-100 py-3">
        {order.order_items.map((item) => (
          <div key={item.id} className="flex items-start justify-between text-sm">
            <div className="flex gap-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-700">
                {item.quantity}
              </div>
              <span className={`font-medium ${variant === "emerald" ? "text-slate-400 line-through" : "text-slate-700"}`}>
                {item.menu_item?.name || "Unknown Item"}
              </span>
            </div>
            {item.notes && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded ml-2">
                {item.notes}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Action */}
      <Button
        onClick={onAdvance}
        className={`w-full justify-center gap-2 shadow-sm ${variant === "blue" ? "bg-blue-600 hover:bg-blue-700 text-white" :
          variant === "emerald" ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
            "bg-slate-900 hover:bg-slate-800 text-white"
          }`}
      >
        {actionIcon}
        <span className="font-bold">{actionLabel}</span>
      </Button>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-300">
      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
        <ChefHat className="opacity-20" size={24} />
      </div>
      <p className="text-xs font-bold uppercase tracking-widest">{label}</p>
    </div>
  );
}
