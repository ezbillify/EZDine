"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Menu as MenuIcon, Search, Bell, X } from "lucide-react";

import { Button } from "../ui/Button";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";

type AppShellProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  showNav?: boolean;
  showUserMenu?: boolean;
  fullWidth?: boolean;
};

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  showNav = true,
  showUserMenu = true,
  fullWidth = false
}: AppShellProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 selection:bg-brand-100 selection:text-brand-900">

      {/* Desktop Navigation */}
      {showNav && <Sidebar className="hidden lg:flex" />}

      {/* Mobile Navigation Drawer */}
      {showNav && isMobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsMobileNavOpen(false)}
          />
          {/* Sidebar */}
          <div className="relative flex w-72 flex-col bg-white">
            <button
              className="absolute right-4 top-6 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
              onClick={() => setIsMobileNavOpen(false)}
            >
              <X size={16} />
            </button>
            <Sidebar className="w-full flex" onNavigate={() => setIsMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        {/* Modern Header */}
        <header className="relative z-30 flex h-20 items-center justify-between px-8 border-b border-white/60 bg-white/40 backdrop-blur-2xl">
          <div className="flex items-center gap-6">
            {showNav && (
              <button
                onClick={() => setIsMobileNavOpen(true)}
                className="lg:hidden h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-all"
              >
                <MenuIcon size={20} />
              </button>
            )}
            <div className="space-y-0.5">
              <h1 className="text-xl font-black text-slate-900 leading-none tracking-tight">{title}</h1>
              {subtitle && <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Toolbelt Search */}
            <div className="hidden md:flex items-center gap-4 border-r border-slate-100 pr-6">
              <button className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white transition-all text-slate-400 hover:text-brand-600">
                <Search size={20} />
              </button>
              <button className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-white transition-all text-slate-400 hover:text-amber-600 relative">
                <Bell size={20} />
                <span className="absolute top-2.5 right-3 h-1.5 w-1.5 rounded-full bg-amber-500 border border-white" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {actions}
              {showUserMenu && (
                <div className="pl-4 border-l border-slate-100">
                  <UserMenu />
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Workspace Canvas */}
        <main className={`flex-1 overflow-y-auto ${fullWidth ? "p-0" : "p-6 lg:p-10"} custom-scrollbar`}>
          <div className={`${fullWidth ? "h-full w-full" : "mx-auto max-w-[1400px]"} animate-in fade-in slide-in-from-bottom-2 duration-700`}>
            {children}
          </div>
        </main>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
}
