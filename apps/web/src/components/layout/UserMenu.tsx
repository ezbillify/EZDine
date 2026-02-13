"use client";

import { LogOut, User, Store, Building2, ChevronDown, ShieldCheck, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { supabase } from "../../lib/supabaseClient";
import { getActiveBranchRole, getActiveRestaurantRole, getCurrentUserProfile } from "../../lib/tenant";
import { RoleBadge } from "./RoleBadge";

export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [branchRole, setBranchRole] = useState<string | null>(null);
  const [restaurantRole, setRestaurantRole] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      const profile = await getCurrentUserProfile();
      const [rr, br] = await Promise.all([getActiveRestaurantRole(), getActiveBranchRole()]);
      setRestaurantRole(rr);
      setBranchRole(br);
      if (profile?.active_restaurant_id) {
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name")
          .eq("id", profile.active_restaurant_id)
          .maybeSingle();
        setRestaurantName(restaurant?.name ?? null);
      }
      if (profile?.active_branch_id) {
        const { data: branch } = await supabase
          .from("branches")
          .select("name")
          .eq("id", profile.active_branch_id)
          .maybeSingle();
        setBranchName(branch?.name ?? null);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-3 rounded-2xl bg-white border border-slate-100 p-1.5 pl-3 shadow-sm hover:shadow-md transition-all active:scale-95 group"
        aria-label="Profile menu"
      >
        <div className="flex flex-col items-end hidden sm:flex">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">Session</p>
          <p className="text-xs font-black text-slate-900 leading-none">{email?.split('@')[0] || "User"}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white font-black shadow-lg group-hover:bg-brand-600 transition-colors">
          <User size={18} />
        </div>
        <ChevronDown size={14} className={`text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-4 w-80 origin-top-right rounded-[2rem] border border-slate-100 bg-white p-3 shadow-2xl shadow-slate-900/10 animate-in zoom-in-95 slide-in-from-top-2 duration-200 z-[100]">
          <div className="flex items-center gap-4 p-4 mb-2 bg-slate-50 rounded-3xl">
            <div className="h-14 w-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-900 shadow-sm">
              <User size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-black text-slate-900 leading-none mb-1">{email}</p>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-emerald-500" />
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Identity Verified</p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="px-4 py-2">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3">Organization</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Restaurant</p>
                    <p className="text-xs font-bold text-slate-900">{restaurantName ?? "Global Admin"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <Store size={16} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Active Branch</p>
                    <p className="text-xs font-bold text-slate-900">{branchName ?? "HQ / Not Set"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 border-t border-slate-50">
              <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-brand-600 transition-all">
                <Settings size={18} />
                Account Config
              </Link>
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest text-rose-500 hover:bg-rose-50 transition-all"
              >
                <LogOut size={18} />
                Terminal Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
