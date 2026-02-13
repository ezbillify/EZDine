"use client";

import { useState } from "react";
import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { KdsBoard } from "../../components/kds/KdsBoard";
import { KotHistory } from "../../components/kds/KotHistory";

export default function KdsPage() {
  return (
    <AuthGate>
      <AppShell title="Kitchen Display" subtitle="Live order preparation" fullWidth>
        <KdsTabs />
      </AppShell>
    </AuthGate>
  );
}

function KdsTabs() {
  const [activeTab, setActiveTab] = useState<"board" | "history">("board");

  return (
    <div className="flex h-full w-full flex-col gap-4 p-4">
      <div className="flex-none border-b border-slate-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("board")}
            className={`border-b-2 pb-2 text-sm font-medium transition-colors ${activeTab === "board"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            Live Board
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`border-b-2 pb-2 text-sm font-medium transition-colors ${activeTab === "history"
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
          >
            History
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "board" ? <KdsBoard /> : <KotHistory />}
      </div>
    </div>
  );
}
