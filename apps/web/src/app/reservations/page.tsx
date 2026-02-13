"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Calendar as CalendarIcon,
    Users,
    Clock,
    Plus,
    Search,
    CheckCircle2,
    XCircle,
    UserPlus,
    ArrowRight,
    Ticket,
    Timer,
    Phone,
    User,
    History,
    Printer,
    RotateCcw
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { format } from "date-fns";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";

type Tab = "reservations" | "waitlist";

export default function GuestManagementPage() {
    const [activeTab, setActiveTab] = useState<Tab>("reservations");
    const [loading, setLoading] = useState(true);
    const [reservations, setReservations] = useState<any[]>([]);
    const [waitlist, setWaitlist] = useState<any[]>([]);

    // Form states
    const [showAddModal, setShowAddModal] = useState(false);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [size, setSize] = useState("2");
    const [time, setTime] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [isNewUser, setIsNewUser] = useState(true);
    const [fetchingCustomer, setFetchingCustomer] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const profile = await getCurrentUserProfile();
            if (!profile?.active_branch_id) return;

            if (activeTab === "reservations") {
                const { data } = await supabase
                    .from("reservations")
                    .select("*, table:tables(name)")
                    .eq("branch_id", profile.active_branch_id)
                    .gte("reservation_time", new Date().toISOString())
                    .order("reservation_time", { ascending: true });
                setReservations(data ?? []);
            } else {
                const { data } = await supabase
                    .from("waitlist")
                    .select("*")
                    .eq("branch_id", profile.active_branch_id)
                    .neq("status", "seated")
                    .neq("status", "cancelled")
                    .order("token_number", { ascending: true });
                setWaitlist(data ?? []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        loadData();

        let channel: ReturnType<typeof supabase.channel> | null = null;

        const setupRealtime = async () => {
            const profile = await getCurrentUserProfile();
            if (!profile?.active_branch_id) return;

            channel = supabase
                .channel('guest-updates')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `branch_id=eq.${profile.active_branch_id}` }, () => {
                    loadData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist', filter: `branch_id=eq.${profile.active_branch_id}` }, () => {
                    loadData();
                })
                .subscribe();
        };

        setupRealtime();

        return () => {
            if (channel) supabase.removeChannel(channel);
        };
    }, [activeTab, loadData]);

    // Enhanced Autofill logic for Indian phone numbers
    useEffect(() => {
        const lookupCustomer = async () => {
            const cleanPhone = phone.trim().replace(/\s/g, '');
            if (cleanPhone.length >= 10) {
                setFetchingCustomer(true);
                const profile = await getCurrentUserProfile();
                if (!profile) {
                    setFetchingCustomer(false);
                    return;
                }

                // Try exact match first
                let { data, error } = await supabase
                    .from("customers")
                    .select("name")
                    .eq("restaurant_id", profile.active_restaurant_id)
                    .eq("phone", cleanPhone)
                    .maybeSingle();

                // Try with +91 if length is 10 and no match
                if (!data && cleanPhone.length === 10) {
                    const with91 = `+91${cleanPhone}`;
                    const { data: data91 } = await supabase
                        .from("customers")
                        .select("name")
                        .eq("restaurant_id", profile.active_restaurant_id)
                        .eq("phone", with91)
                        .maybeSingle();
                    data = data91;
                }

                // Try fuzzy match (ends with) as a fallback
                if (!data) {
                    const suffix = cleanPhone.slice(-10);
                    const { data: fuzzyData } = await supabase
                        .from("customers")
                        .select("name")
                        .eq("restaurant_id", profile.active_restaurant_id)
                        .ilike("phone", `%${suffix}`)
                        .maybeSingle();
                    data = fuzzyData;
                }

                if (data) {
                    setName(data.name || "");
                    setIsNewUser(false);
                    toast.success(`Found Customer: ${data.name}`, {
                        description: "Details autofilled successfully.",
                        duration: 2500
                    });
                } else {
                    setIsNewUser(true);
                }
                setFetchingCustomer(false);
            } else {
                setIsNewUser(true);
            }
        };

        const timer = setTimeout(lookupCustomer, 500);
        return () => clearTimeout(timer);
    }, [phone]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const profile = await getCurrentUserProfile();
            if (!profile) return;

            const cleanPhone = phone.trim().replace(/\s/g, '');

            // Upsert into customers table
            await supabase.from("customers").upsert({
                restaurant_id: profile.active_restaurant_id,
                phone: cleanPhone,
                name
            }, { onConflict: 'restaurant_id,phone' });

            if (activeTab === "reservations") {
                const resTime = new Date(`${date}T${time}`).toISOString();
                const { error } = await supabase.from("reservations").insert({
                    restaurant_id: profile.active_restaurant_id,
                    branch_id: profile.active_branch_id,
                    customer_name: name,
                    phone: cleanPhone,
                    party_size: Number(size),
                    reservation_time: resTime,
                    status: 'confirmed'
                });
                if (error) throw error;
                toast.success("Reservation added successfully");
            } else {
                const { data: token } = await supabase.rpc('next_waitlist_token', { p_branch_id: profile.active_branch_id });

                const { error } = await supabase.from("waitlist").insert({
                    restaurant_id: profile.active_restaurant_id,
                    branch_id: profile.active_branch_id,
                    customer_name: name,
                    phone: cleanPhone,
                    party_size: Number(size),
                    token_number: token || 1,
                    status: 'waiting'
                });
                if (error) throw error;
                toast.success(`Waitlist token #${token} issued`);
            }

            setShowAddModal(false);
            setName("");
            setPhone("");
            setSize("2");
            loadData();
        } catch (err) {
            toast.error("Process failed");
        }
    };

    const updateStatus = async (table: string, id: string, status: string) => {
        const { error } = await supabase.from(table).update({ status }).eq("id", id);
        if (!error) {
            toast.success("Status updated");
            loadData();
        }
    };

    return (
        <AuthGate>
            <AppShell title="Guest Management" subtitle="Manage bookings and waitlist">
                <Toaster richColors position="bottom-right" />

                <div className="space-y-6">
                    {/* Header Controls */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
                            {[
                                { id: "reservations", label: "Reservations", icon: CalendarIcon },
                                { id: "waitlist", label: "Waitlist / Line Token", icon: Ticket },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTab(t.id as Tab)}
                                    className={`flex items-center gap-2 px-6 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === t.id
                                        ? "bg-white text-brand-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                        }`}
                                >
                                    <t.icon size={16} />
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        <Button className="gap-2 shadow-lg shadow-brand-500/20 px-8 h-12" onClick={() => {
                            setShowAddModal(true);
                            setName("");
                            setPhone("");
                            setIsNewUser(true);
                        }}>
                            <Plus size={20} />
                            <span className="text-sm font-black uppercase tracking-widest">
                                {activeTab === 'reservations' ? 'New Reservation' : 'Issue Line Token'}
                            </span>
                        </Button>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                        <div className="space-y-4">
                            {loading ? (
                                <div className="flex h-64 items-center justify-center">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
                                </div>
                            ) : activeTab === "reservations" ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {reservations.length === 0 ? (
                                        <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                                            <CalendarIcon className="mx-auto text-slate-200 mb-4" size={48} />
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No upcoming reservations</p>
                                        </div>
                                    ) : reservations.map(res => (
                                        <Card key={res.id} className="relative group border-slate-100 hover:border-brand-200 transition-all overflow-hidden">
                                            <div className={`absolute top-0 right-0 h-1 w-24 ${res.status === 'confirmed' ? 'bg-blue-400' : 'bg-emerald-400'}`} />

                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        {format(new Date(res.reservation_time), "EEE, MMM d")}
                                                    </span>
                                                    <h4 className="text-lg font-black text-slate-900">{res.customer_name}</h4>
                                                </div>
                                                <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${res.status === 'confirmed' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                                                    }`}>
                                                    {res.status}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center gap-4 text-sm font-bold text-slate-600">
                                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg">
                                                        <Clock size={16} className="text-brand-500" />
                                                        {format(new Date(res.reservation_time), "hh:mm a")}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg">
                                                        <Users size={16} className="text-brand-500" />
                                                        {res.party_size} People
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                                                        <Phone size={14} className="text-slate-500" />
                                                    </div>
                                                    {res.phone}
                                                </div>
                                            </div>

                                            <div className="mt-6 flex gap-2 pt-2 border-t border-slate-50">
                                                <Button
                                                    className="flex-1 h-10 gap-2 text-[10px] uppercase font-black bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-500/10 border-none px-0"
                                                    onClick={() => updateStatus('reservations', res.id, 'seated')}
                                                >
                                                    <UserPlus size={14} /> Seat Now
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="flex-1 h-10 gap-2 text-[10px] uppercase font-black bg-slate-50 text-slate-500 hover:bg-slate-100 px-0"
                                                    onClick={() => updateStatus('reservations', res.id, 'cancelled')}
                                                >
                                                    <XCircle size={14} /> Cancel
                                                </Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {waitlist.length === 0 ? (
                                        <div className="py-16 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                                            <Ticket className="mx-auto text-slate-200 mb-4" size={48} />
                                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Waitlist is currently empty</p>
                                        </div>
                                    ) : waitlist.map(entry => (
                                        <Card key={entry.id} className="flex items-center justify-between group border-slate-100 hover:border-brand-200 transition-colors p-5">
                                            <div className="flex items-center gap-8">
                                                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-xl shadow-brand-500/20">
                                                    <span className="text-3xl font-black">#{entry.token_number}</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-xl font-black text-slate-900">{entry.customer_name}</h4>
                                                    <div className="flex items-center gap-5 mt-1.5">
                                                        <span className="text-sm font-bold text-slate-500 flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 rounded-lg">
                                                            <Users size={16} className="text-brand-500" /> {entry.party_size} People
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-500 flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 rounded-lg">
                                                            <Timer size={16} className="text-brand-500" /> {format(new Date(entry.created_at), "hh:mm a")}
                                                        </span>
                                                        <span className="text-sm font-bold text-slate-400 flex items-center gap-1.5 ml-1">
                                                            <div className="h-6 w-6 flex items-center justify-center rounded-md bg-slate-100"><Phone size={14} className="text-slate-400" /></div>
                                                            {entry.phone}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex gap-3">
                                                <Button variant="outline" className="h-14 w-14 p-0 text-emerald-600 border-emerald-100 hover:bg-emerald-50 shadow-sm" onClick={() => updateStatus('waitlist', entry.id, 'seated')} title="Seat Customer">
                                                    <UserPlus size={24} />
                                                </Button>
                                                <Button variant="outline" className="h-14 w-14 p-0 text-amber-600 border-amber-100 hover:bg-amber-50 shadow-sm" onClick={() => updateStatus('waitlist', entry.id, 'notified')} title="Notify Customer">
                                                    <Phone size={24} />
                                                </Button>
                                                <Button variant="outline" className="h-14 w-14 p-0 text-rose-600 border-rose-100 hover:bg-rose-50 shadow-sm" onClick={() => updateStatus('waitlist', entry.id, 'cancelled')} title="Cancel Token">
                                                    <XCircle size={24} />
                                                </Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Sidebar Stats */}
                        <div className="space-y-4">
                            <Card title="Today's Summary" className="bg-gradient-to-br from-brand-500 to-brand-700 border-none text-white overflow-hidden relative">
                                <div className="absolute top-0 right-0 -translate-y-4 translate-x-4 opacity-10">
                                    <CalendarIcon size={120} />
                                </div>
                                <div className="space-y-4 pt-2 relative z-10">
                                    <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                                        <span className="text-white/70 font-bold uppercase tracking-widest text-[10px]">Upcoming Bookings</span>
                                        <span className="font-black text-white text-lg">{reservations.filter(r => r.status === 'confirmed').length}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                                        <span className="text-white/70 font-bold uppercase tracking-widest text-[10px]">Avg Wait Time</span>
                                        <span className="font-black text-white text-lg">12 Mins</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-white/70 font-bold uppercase tracking-widest text-[10px]">Active Waitlist</span>
                                        <span className="font-black text-white text-lg">{waitlist.length} Groups</span>
                                    </div>
                                </div>
                            </Card>

                            {showAddModal && (
                                <Card className="animate-slide-up border-brand-200 shadow-2xl p-0 overflow-hidden">
                                    <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
                                        <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">
                                            {activeTab === 'reservations' ? 'New Reservation' : 'New Waitlist Entry'}
                                        </h3>
                                        {fetchingCustomer ? (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-200 text-[9px] font-black uppercase text-slate-500 animate-pulse">
                                                Looking up...
                                            </div>
                                        ) : !isNewUser ? (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-[9px] font-black uppercase text-emerald-700">
                                                <CheckCircle2 size={10} /> Found Guest
                                            </div>
                                        ) : null}
                                    </div>
                                    <form onSubmit={handleAdd} className="p-4 space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Phone Number</label>
                                            <Input
                                                placeholder="e.g. 9876543210"
                                                value={phone}
                                                onChange={e => setPhone(e.target.value)}
                                                autoFocus
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Guest Name</label>
                                            <Input
                                                placeholder="Customer Name"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                className={!isNewUser ? "bg-emerald-50/50 border-emerald-100 text-emerald-900 font-bold" : ""}
                                                required
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Party Size</label>
                                                <Input type="number" value={size} onChange={e => setSize(e.target.value)} required />
                                            </div>
                                            {activeTab === 'reservations' && (
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Time</label>
                                                    <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
                                                </div>
                                            )}
                                        </div>

                                        {activeTab === 'reservations' && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Date</label>
                                                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                                            </div>
                                        )}

                                        <div className="flex gap-2 justify-end pt-2">
                                            <Button variant="ghost" type="button" className="text-xs font-bold uppercase" onClick={() => setShowAddModal(false)}>Cancel</Button>
                                            <Button type="submit" className="text-xs font-black uppercase px-6">
                                                {activeTab === 'reservations' ? 'Book Table' : 'Issue Token'}
                                            </Button>
                                        </div>
                                    </form>
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </AppShell>
        </AuthGate>
    );
}
