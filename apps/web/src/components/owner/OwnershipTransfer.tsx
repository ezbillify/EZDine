"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Share2, Mail, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { findUserByEmail, transferRestaurantOwnership } from "../../lib/owner";
import { getAccessibleRestaurants } from "../../lib/tenant";
import type { Restaurant } from "../../lib/supabaseTypes";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Dropdown } from "../ui/Dropdown";

export function OwnershipTransfer() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  useEffect(() => {
    const load = async () => {
      const data = await getAccessibleRestaurants();
      setRestaurants(data);
      if (data[0]) setRestaurantId(data[0].id);
    };
    load();
  }, []);

  const handleTransfer = async () => {
    if (!restaurantId || !email) return;
    setStatus("saving");
    try {
      const user = await findUserByEmail(email);
      if (!user?.id) throw new Error("No user found with this email");

      const confirmText = prompt(`Type "TRANSFER" to confirm moving ownership to ${email}. You will LOSE access to this restaurant.`);
      if (confirmText !== "TRANSFER") {
        toast.error("Transfer cancelled");
        setStatus("idle");
        return;
      }

      await transferRestaurantOwnership({ restaurant_id: restaurantId, new_owner_user_id: user.id });
      toast.success("Ownership successfully transferred");
      setEmail("");
    } catch (err: any) {
      toast.error(err.message || "Transfer protocol failed");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <Card className="border-rose-100 shadow-xl shadow-rose-200/20 p-0 overflow-hidden">
      <div className="bg-rose-50 p-6 border-b border-rose-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-500/20">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-rose-900">Legal Transfer</h3>
            <p className="text-[10px] font-medium text-rose-400">Migrate root ownership to another account</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-100">
          <AlertTriangle size={20} className="text-amber-600 flex-none mt-0.5" />
          <div>
            <p className="text-xs font-black text-amber-900 uppercase tracking-widest mb-1">Critical Warning</p>
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              Transferring ownership is **irreversible**. The new owner will have full database control, including the ability to remove your access entirely.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Select Entity</label>
            <Dropdown
              value={restaurantId}
              options={restaurants.map((restaurant) => ({
                value: restaurant.id,
                label: restaurant.name
              }))}
              placeholder="Select restaurant"
              onChange={(value) => setRestaurantId(value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Recipient Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="newowner@example.com"
                className="h-12 border-slate-100 focus:border-rose-500 font-bold pl-10"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-50 flex justify-end">
          <Button
            className="h-12 px-10 gap-2 text-xs font-black uppercase tracking-widest bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-500/20 transition-all hover:scale-[1.02]"
            onClick={handleTransfer}
            disabled={status === "saving" || !email}
          >
            {status === "saving" ? "Transferring..." : <><Share2 size={18} /> Execute Transfer</>}
          </Button>
        </div>
      </div>
    </Card>
  );
}
