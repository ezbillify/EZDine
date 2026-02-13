"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Search,
  UserPlus,
  Phone,
  Mail,
  Trophy,
  Calendar,
  Trash2,
  MoreVertical,
  ChevronRight,
  Filter,
  Plus,
  CircleDashed,
  Star,
  User
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { format } from "date-fns";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Section } from "../../components/ui/Section";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCustomers = useCallback(async () => {
    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_restaurant_id) return;

      const { data, error } = await supabase
        .from("customers")
        .select("*, branches(name)")
        .eq("restaurant_id", profile.active_restaurant_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data ?? []);
    } catch (err) {
      console.error("Load customers error:", err);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !name) {
      toast.error("Phone and Name are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const profile = await getCurrentUserProfile();
      if (!profile?.active_restaurant_id) {
        toast.error("No active restaurant found");
        return;
      }

      const cleanPhone = phone.trim().replace(/\s/g, '');

      const { error } = await supabase
        .from("customers")
        .upsert({
          restaurant_id: profile.active_restaurant_id,
          phone: cleanPhone,
          name: name.trim(),
          email: email.trim() || null
        }, { onConflict: 'restaurant_id,phone' });

      if (error) throw error;

      toast.success("Customer saved successfully");
      setName("");
      setPhone("");
      setEmail("");
      loadCustomers();
    } catch (err: any) {
      console.error("Save customer error:", err);
      toast.error(err.message || "Failed to save customer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;

    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Customer deleted");
      loadCustomers();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const filteredCustomers = customers.filter(c =>
  (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <AuthGate>
      <AppShell
        title="Customers"
        subtitle="Manage guest loyalty and profiles"
        actions={
          <div className="flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-600 ring-1 ring-inset ring-brand-200">
            <Trophy size={14} className="text-brand-500" />
            {customers.length} Registered Guests
          </div>
        }
      >
        <Toaster richColors position="bottom-right" />

        <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
          {/* Left Column: Form & Stats */}
          <div className="space-y-6">
            <Card className="border-brand-100 shadow-xl shadow-brand-500/5">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-500/20">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Add Guest</h3>
                  <p className="text-[10px] font-medium text-slate-400">Quickly register a new customer</p>
                </div>
              </div>

              <form onSubmit={handleCreateCustomer} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                  <Input
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="h-11 border-slate-100 focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Phone Number</label>
                  <Input
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    className="h-11 border-slate-100 focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email (Optional)</label>
                  <Input
                    type="email"
                    placeholder="rahul@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="h-11 border-slate-100 focus:border-brand-500"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 gap-2 text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <CircleDashed className="animate-spin" size={18} /> : <Plus size={18} />}
                  Save Profile
                </Button>
              </form>
            </Card>

            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-none text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 -translate-y-4 translate-x-4 opacity-10">
                <Star size={120} />
              </div>
              <div className="relative z-10">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loyalty Insights</h4>
                <div className="mt-4 space-y-4">
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl backdrop-blur-sm">
                    <span className="text-xs font-bold text-slate-300">Total Visits (MTD)</span>
                    <span className="text-lg font-black">{Math.floor(customers.length * 1.5)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl backdrop-blur-sm">
                    <span className="text-xs font-bold text-slate-300">Reward Vouchers</span>
                    <span className="text-lg font-black">24</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: List & Search */}
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/10 focus-within:border-brand-500 transition-all">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Search name, phone or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:ring-0"
              />
              <Button variant="ghost" className="h-10 text-[10px] uppercase font-black text-slate-400 gap-2">
                <Filter size={14} /> Filter
              </Button>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-3xl border border-slate-100">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-100 border-t-brand-600" />
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Synchronizing database...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-3xl border border-dashed border-slate-200">
                  <Users className="text-slate-200" size={64} />
                  <div className="text-center">
                    <p className="text-lg font-black text-slate-400">No Guests Found</p>
                    <p className="text-xs font-medium text-slate-400 mt-1">Start by adding your first customer on the left.</p>
                  </div>
                </div>
              ) : (
                filteredCustomers.map(customer => (
                  <Card key={customer.id} className="group p-0 overflow-hidden border-slate-100 hover:border-brand-200 transition-all">
                    <div className="flex items-center gap-6 p-4">
                      {/* Avatar */}
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors shadow-inner">
                        <User size={28} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-lg font-black text-slate-900 truncate">{customer.name}</h4>
                          <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-500">
                            {customer.branches?.name ?? "All Branches"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-4">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                            <Phone size={14} className="text-brand-500" /> {customer.phone}
                          </span>
                          {customer.email && (
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                              <Mail size={14} className="text-brand-500" /> {customer.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                            <Calendar size={14} /> Joined {format(new Date(customer.created_at), "MMM yyyy")}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pr-2">
                        <Button variant="outline" className="h-10 w-10 p-0 text-slate-400 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50" onClick={() => handleDelete(customer.id)}>
                          <Trash2 size={18} />
                        </Button>
                        <Button variant="ghost" className="h-10 w-10 p-0 text-slate-300">
                          <ChevronRight size={18} />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
