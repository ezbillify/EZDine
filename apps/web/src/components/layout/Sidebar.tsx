"use client";

import {
    BarChart3,
    ChefHat,
    LayoutDashboard,
    Menu,
    Settings,
    ShoppingBag,
    Users,
    UtensilsCrossed,
    Warehouse,
    MonitorCheck,
    Calendar,
    LogOut,
    Search
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { getActiveBranchRole, getActiveRestaurantRole } from "../../lib/tenant";
import { supabase } from "../../lib/supabaseClient";
import { APP_VERSION } from "../../version";

const baseItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/pos", label: "POS Terminal", icon: MonitorCheck },
    { href: "/orders", label: "Live Orders", icon: ShoppingBag },
    { href: "/reservations", label: "Reservations", icon: Calendar },
    { href: "/kds", label: "Kitchen (KDS)", icon: ChefHat },
    { href: "/menu", label: "Menu Manager", icon: Menu },
    { href: "/inventory", label: "Inventory", icon: Warehouse },
    { href: "/purchase", label: "Purchase", icon: ShoppingBag },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/tables", label: "Tables", icon: UtensilsCrossed },
    { href: "/reports", label: "Analytics", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar({ className = "", onNavigate, isCollapsed = false }: { className?: string, onNavigate?: () => void, isCollapsed?: boolean }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [role, setRole] = useState<string | null>(null);
    const [branchRole, setBranchRole] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            const [currentRole, currentBranchRole] = await Promise.all([
                getActiveRestaurantRole(),
                getActiveBranchRole()
            ]);
            setRole(currentRole);
            setBranchRole(currentBranchRole);
        };
        load();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
    };

    const handleNavigation = (href: string) => {
        startTransition(() => {
            router.push(href);
        });
    };

    const items =
        role === "owner"
            ? [...baseItems, { href: "/staff", label: "Staff Manager", icon: Users }]
            : baseItems;

    const filteredItems = items.filter((item) => {
        if (role === "owner") return true;
        if (branchRole === "kitchen") {
            return ["/kds", "/orders", "/dashboard"].includes(item.href);
        }
        if (branchRole === "cashier") {
            return ["/pos", "/orders", "/reports", "/dashboard"].includes(item.href);
        }
        if (branchRole === "waiter") {
            return ["/pos", "/orders", "/tables", "/dashboard"].includes(item.href);
        }
        return true;
    });

    return (
        <aside className={`flex ${isCollapsed ? 'w-20' : 'w-72'} flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out ${className}`}>
            <div className="flex h-20 items-center px-8 border-b border-slate-50">
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.25rem] bg-white shadow-md transition-all group-hover:scale-110 group-hover:rotate-6 p-1 relative">
                        <Image
                            src="/images/EZDineLOGO.png"
                            alt="EZDine Logo"
                            fill
                            className="object-contain p-1.5"
                        />
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col overflow-hidden whitespace-nowrap animate-in fade-in duration-300">
                            <span className="font-black text-lg text-slate-900 leading-none">EZDine <span className="text-brand-600">Pro</span></span>
                        </div>
                    )}
                </div>
            </div>

            {!isCollapsed && (
                <div className="p-4 mt-4 animate-in fade-in duration-300">
                    <button className="flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-slate-400 hover:bg-slate-100 transition-all">
                        <div className="flex items-center gap-3">
                            <Search size={16} />
                            <span className="text-xs font-bold uppercase tracking-widest opacity-60">Global Search</span>
                        </div>
                        <div className="flex items-center gap-1 rounded bg-white px-1.5 py-0.5 border border-slate-200 text-[10px] font-black opacity-40">
                            <span>⌘</span><span>K</span>
                        </div>
                    </button>
                </div>
            )}

            <nav className={`flex-1 overflow-y-auto px-4 py-2 space-y-1.5 custom-scrollbar ${isCollapsed ? 'mt-4' : ''}`}>
                {!isCollapsed && (
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4 px-4 mt-4 animate-in fade-in duration-300 whitespace-nowrap overflow-hidden">
                        Product Suite
                    </div>
                )}
                {filteredItems.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            prefetch={true}
                            onClick={(e) => {
                                e.preventDefault();
                                handleNavigation(item.href);
                                onNavigate?.();
                            }}
                            className={`group flex items-center rounded-2xl transition-all duration-200 ${isCollapsed ? 'justify-center p-3 w-12 h-12 mx-auto' : 'gap-4 px-4 py-3'} text-xs font-black uppercase tracking-widest ${isActive
                                ? "bg-slate-900 text-white shadow-2xl shadow-slate-900/20 translate-x-1"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                } ${isPending ? 'opacity-50' : ''}`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <Icon
                                size={20}
                                className={`shrink-0 transition-all ${isActive ? "text-brand-500 group-hover:scale-110" : "text-slate-300 group-hover:text-slate-600"}`}
                            />
                            {!isCollapsed && (
                                <span className="animate-in fade-in duration-300 whitespace-nowrap overflow-hidden">
                                    {item.label}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className={`p-6 border-t border-slate-50 space-y-4 ${isCollapsed ? 'px-2' : ''}`}>
                {!isCollapsed ? (
                    <div className="rounded-[2rem] bg-brand-50 p-5 relative overflow-hidden group border border-brand-100/50 animate-in fade-in duration-300">
                        <div className="absolute top-0 right-0 p-2 opacity-10 text-brand-600">
                            <MonitorCheck size={60} />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-brand-600 mb-1">POS Status</p>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500" />
                            <p className="text-[11px] font-black text-slate-900 uppercase">Live & Secure</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center transition-all animate-in fade-in zoom-in w-12 h-12 mx-auto rounded-2xl bg-brand-50 items-center border border-brand-100/50 cursor-pointer" title="POS Status: Live & Secure">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                    </div>
                )}

                {!isCollapsed && (
                    <div className="px-2 text-center space-y-1 animate-in fade-in duration-300 overflow-hidden whitespace-nowrap">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v{APP_VERSION}</p>
                        <a
                            href="https://ezbillify.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[8px] font-black text-slate-200 uppercase tracking-[0.2em] hover:text-brand-600 transition-colors"
                        >
                            Powered by <span className="text-slate-300 group-hover:text-brand-600">EZBillify</span>
                        </a>
                    </div>
                )}

                <button
                    onClick={handleLogout}
                    className={`flex items-center rounded-2xl text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all border border-transparent hover:border-rose-100 ${isCollapsed ? 'justify-center p-3 w-12 h-12 mx-auto' : 'w-full gap-3 px-4 py-3'}`}
                    title={isCollapsed ? "Log Out" : undefined}
                >
                    <LogOut size={20} className="shrink-0" />
                    {!isCollapsed && <span className="animate-in fade-in whitespace-nowrap">Log Out</span>}
                </button>
            </div>
        </aside>
    );
}
