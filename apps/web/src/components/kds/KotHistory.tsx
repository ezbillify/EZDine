"use client";

import { useEffect, useState } from "react";

import { buildKotLines, getPrintingSettings, sendPrintJob } from "../../lib/printing";
import { getCurrentUserProfile } from "../../lib/tenant";
import { supabase } from "../../lib/supabaseClient";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { DatePicker } from "../ui/DatePicker";

export function KotHistory() {
  const [orders, setOrders] = useState<any[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);

  const load = async () => {
    const profile = await getCurrentUserProfile();
    if (!profile?.active_branch_id) return;

    const { data } = await supabase
      .from("orders")
      .select("id,order_number,table_id,created_at")
      .eq("branch_id", profile.active_branch_id)
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(50);

    setOrders(data ?? []);
  };

  useEffect(() => {
    load();
  }, [from, to]);

  const reprint = async (orderId: string, orderNumber: string) => {
    const settings = await getPrintingSettings();
    if (!settings) return;

    const { data: items } = await supabase
      .from("order_items")
      .select("item_id,quantity,notes")
      .eq("order_id", orderId);

    const { data: menu } = await supabase.from("menu_items").select("id,name");

    const lines = buildKotLines({
      restaurantName: "EZDine",
      branchName: "Branch",
      tableName: "--",
      orderId: orderNumber,
      items:
        (items ?? []).map((i: any) => ({
          name: menu?.find((m: any) => m.id === i.item_id)?.name ?? "Item",
          qty: i.quantity,
          note: i.notes
        })) ?? []
    });

    await sendPrintJob({
      printerId: settings.printerIdKot ?? "kitchen-1",
      width: settings.widthKot ?? 58,
      type: "kot",
      lines
    });
  };

  return (
    <Card title="KOT History">
      <div className="mb-3 grid gap-2 md:grid-cols-2">
        <DatePicker value={from} onChange={setFrom} />
        <DatePicker value={to} onChange={setTo} />
      </div>
      {orders.length === 0 ? (
        <p className="text-sm text-slate-600">No orders yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {orders.map((order) => (
            <li key={order.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{order.order_number ?? order.id}</p>
                <p className="text-xs text-slate-500">{order.created_at}</p>
              </div>
              <Button variant="ghost" onClick={() => reprint(order.id, order.order_number)}>
                Reprint
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
