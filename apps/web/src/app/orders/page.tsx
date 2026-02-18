"use client";

import { useState } from "react";
import { DatePicker } from "../../components/ui/DatePicker";
import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { OrderBoard } from "../../components/pos/OrderBoard";

export default function OrdersPage() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  return (
    <AuthGate>
      <AppShell
        title="Live Orders"
        subtitle="Real-time kitchen & dining feed"
        actions={
          <div className="flex items-center gap-3">
            <div className="w-48">
              <DatePicker value={selectedDate} onChange={setSelectedDate} />
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 ring-1 ring-inset ring-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              Live System Online
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <OrderBoard selectedDate={selectedDate} />
        </div>
      </AppShell>
    </AuthGate>
  );
}
