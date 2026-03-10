"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

import {
  assignBranchRole,
  findUserByEmail,
  sendOtpInvite,
  removeBranchRole
} from "../../lib/owner";
import { getAccessibleBranches, getAccessibleRestaurants } from "../../lib/tenant";
import type { Branch, Restaurant } from "../../lib/supabaseTypes";
import { supabase } from "../../lib/supabaseClient";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Dropdown } from "../ui/Dropdown";
import { Trash2, UserPlus, Search, UserCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const branchRoles = ["manager", "cashier", "waiter", "kitchen"] as const;

interface AssignedUser {
  id: string;
  user_id: string;
  branch_id: string;
  role: string;
  user?: {
    full_name: string | null;
    email: string | null;
  };
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

export function StaffManager() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [assigned, setAssigned] = useState<AssignedUser[]>([]);
  const [email, setEmail] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchRole, setBranchRole] = useState<(typeof branchRoles)[number]>("cashier");
  const [status, setStatus] = useState<"idle" | "sending" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<{ id: string; email: string | null; full_name: string | null } | null>(null);

  const loadData = useCallback(async () => {
    const [restaurantsData, branchesData] = await Promise.all([
      getAccessibleRestaurants(),
      getAccessibleBranches()
    ]);
    setRestaurants(restaurantsData);
    setBranches(branchesData);
    if (!restaurantId && restaurantsData[0]) setRestaurantId(restaurantsData[0].id);
    if (!branchId && branchesData[0]) setBranchId(branchesData[0].id);

    const { data: rolesData } = await supabase
      .from("user_branch_roles")
      .select("id,user_id,branch_id,role");

    const { data: profilesData } = await supabase
      .from("user_profiles")
      .select("id,full_name,email");

    const roles = (rolesData as unknown as AssignedUser[]) || [];
    const profiles = (profilesData as unknown as Profile[]) || [];

    const assignedList = roles.map((r) => ({
      ...r,
      user: profiles?.find((p) => p.id === r.user_id)
    }));
    setAssigned(assignedList);
  }, [branchId, restaurantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const branchOptions = useMemo(() => {
    if (!restaurantId) return branches;
    return branches.filter((branch) => branch.restaurant_id === restaurantId);
  }, [branches, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const firstBranch = branchOptions[0]?.id ?? null;
    if (firstBranch) setBranchId(firstBranch);
  }, [restaurantId, branchOptions]);

  const handleInvite = async () => {
    if (!email) return;
    setStatus("sending");
    setMessage(null);
    try {
      await sendOtpInvite(email);
      setStatus("idle");
      setMessage("OTP sent. Ask staff to verify email, then assign roles.");
      toast.success("Magic link sent to " + email);
    } catch (err: unknown) {
      setStatus("error");
      const errorMsg = err instanceof Error ? err.message : "Failed to send OTP";
      setMessage(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleLookup = async () => {
    if (!email) return;
    setStatus("saving");
    setMessage(null);
    try {
      const profile = await findUserByEmail(email);
      if (!profile?.id) {
        setFoundUser(null);
        setStatus("idle");
        setMessage("User not found. Ask them to login once first.");
        return;
      }
      setFoundUser(profile);
      setStatus("idle");
      setMessage("User found. Assign roles below.");
      toast.success("Staff profile linked");
    } catch (err: unknown) {
      setStatus("error");
      const errorMsg = err instanceof Error ? err.message : "Lookup failed";
      setMessage(errorMsg);
    }
  };

  const handleAssign = async () => {
    if (!email || !restaurantId || !foundUser) return;
    setStatus("saving");
    setMessage(null);
    try {
      if (branchId) {
        await assignBranchRole({ user_id: foundUser.id, branch_id: branchId, role: branchRole });
      }
      setStatus("idle");
      setMessage("Roles assigned successfully.");
      toast.success("Staff role updated");
      await loadData();
    } catch (err: unknown) {
      setStatus("error");
      const errorMsg = err instanceof Error ? err.message : "Failed to assign roles";
      setMessage(errorMsg);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Remove this staff member's access?")) return;
    try {
      await removeBranchRole(id);
      toast.success("Access revoked");
      await loadData();
    } catch (err) {
      toast.error("Failed to revoke access");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-0 overflow-hidden border-slate-100 shadow-xl shadow-slate-200/40">
          <div className="bg-slate-50 p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/20">
              <UserPlus size={16} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Step 1: Invite</h3>
          </div>
          <div className="p-5">
            <div className="flex gap-2 mb-4">
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@restaurant.com" className="h-11 border-slate-100 focus:border-brand-500 font-bold" />
              <Button onClick={handleInvite} disabled={!email || status === "sending"} className="h-11 px-6 text-[10px] font-black uppercase tracking-widest">
                {status === "sending" ? "..." : "Send OTP"}
              </Button>
            </div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tight leading-relaxed">
              Magic link invite creates the user account. They must verify email once before role assignment.
            </p>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden border-slate-100 shadow-xl shadow-slate-200/40">
          <div className="bg-slate-50 p-5 border-b border-slate-100 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Search size={16} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Step 2: Lookup</h3>
          </div>
          <div className="p-5">
            <div className="flex gap-2">
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Verified Email" className="h-11 border-slate-100 focus:border-indigo-500 font-bold" />
              <Button onClick={handleLookup} disabled={!email || status === "saving"} className="h-11 px-6 text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700">
                {status === "saving" ? "..." : "Link User"}
              </Button>
            </div>
            {foundUser && (
              <div className="mt-4 flex items-center gap-3 p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-xs shadow-sm">
                <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 border border-indigo-200">
                  <UserCheck size={20} />
                </div>
                <div>
                  <p className="font-black text-indigo-900">{foundUser.full_name || "Linked Account"}</p>
                  <p className="text-[10px] font-bold text-indigo-400 truncate">{foundUser.email}</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden border-slate-100 shadow-xl shadow-slate-200/40">
        <div className="bg-slate-50 p-5 border-b border-slate-100 flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldCheck size={16} />
          </div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Step 3: Assign Access</h3>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Entity</label>
              <Dropdown
                value={restaurantId}
                options={restaurants.map((restaurant) => ({
                  value: restaurant.id,
                  label: restaurant.name
                }))}
                placeholder="Restaurant"
                onChange={(value) => setRestaurantId(value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Location</label>
              <Dropdown
                value={branchId}
                options={branchOptions.map((branch) => ({
                  value: branch.id,
                  label: branch.name
                }))}
                placeholder="Branch"
                onChange={(value) => setBranchId(value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Permission Level</label>
              <Dropdown
                value={branchRole}
                options={branchRoles.map((role) => ({ value: role, label: role.toUpperCase() }))}
                placeholder="Staff Role"
                onChange={(value) => setBranchRole(value as (typeof branchRoles)[number])}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={handleAssign} disabled={!foundUser || status === "saving"} className="h-12 px-10 text-[10px] font-black uppercase tracking-widest bg-slate-900 hover:bg-black shadow-lg">
              {status === "saving" ? "Provisioning..." : "Assign Permission"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden border-slate-100 shadow-xl shadow-slate-200/40">
        <div className="bg-slate-50 p-6 border-b border-slate-100">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Team Roster</h3>
          <p className="text-[10px] font-medium text-slate-400">Manage {assigned.length} active staff permissions</p>
        </div>
        <div className="p-4">
          {assigned.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <UserCheck size={32} className="mx-auto mb-2 opacity-10" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-50">No Permissions Assigned</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {assigned.map((item) => {
                const branch = branches.find((b) => b.id === item.branch_id);
                const restaurant = restaurants.find((r) => r.id === branch?.restaurant_id);
                return (
                  <div key={item.id} className="group flex items-center justify-between p-4 rounded-3xl border border-slate-100 bg-white hover:bg-slate-50 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-all">
                        <UserCheck size={20} />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 leading-tight">
                          {item.user?.full_name ?? item.user?.email ?? "User"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">
                            {item.role}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 truncate max-w-[150px]">
                            {restaurant?.name} · {branch?.name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="h-10 w-10 flex items-center justify-center bg-rose-100 border-2 border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 rounded-xl transition-all shadow-sm active:scale-95"
                      onClick={() => handleRemove(item.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
