"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Settings2,
  Printer,
  Hash,
  ChevronRight,
  Info,
  LayoutDashboard,
  Building2,
  Store,
  CreditCard,
  UserCog,
  QrCode,
  Link2
} from "lucide-react";

import { AuthGate } from "../../components/auth/AuthGate";
import { OwnerGate } from "../../components/auth/OwnerGate";
import { AppShell } from "../../components/layout/AppShell";
import { BranchManager } from "../../components/owner/BranchManager";
import { OwnershipTransfer } from "../../components/owner/OwnershipTransfer";
import { RestaurantManager } from "../../components/owner/RestaurantManager";
import { GeneralSettings } from "../../components/printing/GeneralSettings";
import { PrintTestCard } from "../../components/printing/PrintTestCard";
import { PrintingSettings } from "../../components/printing/PrintingSettings";
import { NumberingSettings } from "../../components/settings/NumberingSettings";
import { QrSettings } from "../../components/settings/QrSettings";
import { RazorpaySettings } from "../../components/settings/RazorpaySettings";
import { Card } from "../../components/ui/Card";

const sections = [
  {
    id: "owner",
    label: "Owner Console",
    icon: ShieldCheck,
    description: "Manage restaurants, branches, and staff accounts",
    ownerOnly: true
  },
  {
    id: "system",
    label: "System Config",
    icon: Settings2,
    description: "Tax Slabs, Payment Modes, and Preferences"
  },
  {
    id: "printing",
    label: "Printing Setup",
    icon: Printer,
    description: "Thermal printers, KOT and network settings"
  },
  {
    id: "numbering",
    label: "Document Logic",
    icon: Hash,
    description: "Customize order/bill numbering sequences"
  },
  {
    id: "qr",
    label: "QR Ordering",
    icon: QrCode,
    description: "Generate QR codes for table and direct ordering"
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Link2,
    description: "Connect Razorpay and other third-party services"
  }
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("owner");

  return (
    <AuthGate>
      <AppShell title="Settings" subtitle="Configure your restaurant operating system">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Navigation Sidebar */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-100 bg-white p-3 shadow-sm">
              <p className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Operating Config
              </p>
              <nav className="mt-2 flex flex-col gap-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition-all ${activeSection === section.id
                      ? "bg-brand-600 text-white shadow-lg shadow-brand-500/20"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <section.icon size={18} className={activeSection === section.id ? "text-white" : "text-slate-400 group-hover:text-brand-500"} />
                      {section.label}
                    </div>
                    <ChevronRight size={14} className={activeSection === section.id ? "text-white" : "text-slate-300"} />
                  </button>
                ))}
              </nav>
            </div>

            <Card className="bg-slate-900 border-none text-white p-5 overflow-hidden relative">
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <Info size={100} />
              </div>
              <div className="relative z-10">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Info</h4>
                <p className="mt-4 text-xs leading-relaxed text-slate-300">
                  Changes to printing and numbering take effect immediately across all POS terminals.
                </p>
                <div className="mt-6 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black uppercase text-slate-400">All Modules Healthy</span>
                </div>
              </div>
            </Card>
          </aside>

          {/* Content Area */}
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {activeSection === 'owner' && (
              <section className="space-y-6">
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-slate-900">Owner Console</h2>
                  <p className="text-sm font-medium text-slate-500">Global restaurant and administrative controls</p>
                </div>
                <OwnerGate>
                  <div className="grid gap-6">
                    <RestaurantManager />
                    <BranchManager />
                    <OwnershipTransfer />
                  </div>
                </OwnerGate>
              </section>
            )}

            {activeSection === 'system' && (
              <section className="space-y-6">
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-slate-900">System Configuration</h2>
                  <p className="text-sm font-medium text-slate-500">Taxes, payments and operational defaults</p>
                </div>
                <GeneralSettings />
              </section>
            )}

            {activeSection === 'numbering' && (
              <section className="space-y-6">
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-slate-900">Document Numbering</h2>
                  <p className="text-sm font-medium text-slate-500">Sequential logic for orders and tax invoices</p>
                </div>
                <NumberingSettings />
              </section>
            )}

            {activeSection === 'printing' && (
              <section className="space-y-6">
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-slate-900">Printing Setup</h2>
                  <p className="text-sm font-medium text-slate-500">Peripheral management and KOT routing</p>
                </div>
                <div className="grid gap-6">
                  <PrintingSettings />
                  <PrintTestCard />
                </div>
              </section>
            )}

            {activeSection === 'qr' && (
              <section className="space-y-6">
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-slate-900">QR Ordering</h2>
                  <p className="text-sm font-medium text-slate-500">Scan-to-order system for tables and counters</p>
                </div>
                <QrSettings />
              </section>
            )}

            {activeSection === 'integrations' && (
              <section className="space-y-6">
                <div className="mb-8">
                  <h2 className="text-2xl font-black text-slate-900">Integrations</h2>
                  <p className="text-sm font-medium text-slate-500">Connect and manage third-party service credentials</p>
                </div>
                <RazorpaySettings />
              </section>
            )}
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
