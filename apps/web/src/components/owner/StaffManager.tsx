"use client";

import { useEffect, useMemo, useState } from "react";

import {
  assignBranchRole,
  findUserByEmail,
  sendOtpInvite
} from "../../lib/owner";
import { getAccessibleBranches, getAccessibleRestaurants } from "../../lib/tenant";
import type { Branch, Restaurant } from "../../lib/supabaseTypes";
import { supabase } from "../../lib/supabaseClient";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Dropdown } from "../ui/Dropdown";

const branchRoles = ["manager", "cashier", "waiter", "kitchen"] as const;

export function StaffManager() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchRole, setBranchRole] = useState<(typeof branchRoles)[number]>("cashier");
  const [status, setStatus] = useState<"idle" | "sending" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<{ id: string; email: string | null; full_name: string | null } | null>(null);

  useEffect(() => {
    const load = async () => {
      const [restaurantsData, branchesData] = await Promise.all([
        getAccessibleRestaurants(),
        getAccessibleBranches()
      ]);
      setRestaurants(restaurantsData);
      setBranches(branchesData);
      if (!restaurantId && restaurantsData[0]) setRestaurantId(restaurantsData[0].id);
      if (!branchId && branchesData[0]) setBranchId(branchesData[0].id);

      const { data: roles } = await supabase
        .from("user_branch_roles")
        .select("id,user_id,branch_id,role");
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id,full_name,email");
      const assignedList = (roles ?? []).map((r: any) => ({
        ...r,
        user: profiles?.find((p: any) => p.id === r.user_id)
      }));
      setAssigned(assignedList);
    };

    load();
  }, []);

  const branchOptions = useMemo(() => {
    if (!restaurantId) return branches;
    return branches.filter((branch) => branch.restaurant_id === restaurantId);
  }, [branches, restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const firstBranch = branchOptions[0]?.id ?? null;
    setBranchId(firstBranch ?? "");
  }, [restaurantId, branchOptions]);

  const handleInvite = async () => {
    if (!email) return;
    setStatus("sending");
    setMessage(null);
    try {
      await sendOtpInvite(email);
      setStatus("idle");
      setMessage("OTP sent. Ask staff to verify email, then assign roles.");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to send OTP");
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
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Lookup failed");
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
      const { data: roles } = await supabase
        .from("user_branch_roles")
        .select("id,user_id,branch_id,role");
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id,full_name,email");
      const assignedList = (roles ?? []).map((r: any) => ({
        ...r,
        user: profiles?.find((p: any) => p.id === r.user_id)
      }));
      setAssigned(assignedList);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to assign roles");
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Invite staff (Step 1)">
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@restaurant.com" />
          <Button onClick={handleInvite} disabled={!email || status === "sending"}>
            {status === "sending" ? "Sending..." : "Send OTP"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          OTP invite creates the user account. They must verify email once before role assignment.
        </p>
      </Card>

      <Card title="Lookup user (Step 2)">
        <div className="grid gap-3 md:grid-cols-[1fr_160px]">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@restaurant.com" />
          <Button onClick={handleLookup} disabled={!email || status === "saving"}>
            {status === "saving" ? "Checking..." : "Find user"}
          </Button>
        </div>
        {foundUser ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">{foundUser.full_name ?? "Staff user"}</p>
            <p>{foundUser.email ?? email}</p>
          </div>
        ) : null}
      </Card>

      <Card title="Assign roles (Step 3)">
        <div className="grid gap-3 md:grid-cols-2">
          <Dropdown
            value={restaurantId}
            options={restaurants.map((restaurant) => ({
              value: restaurant.id,
              label: restaurant.name
            }))}
            placeholder="Select restaurant"
            onChange={(value) => setRestaurantId(value)}
          />
          <Dropdown
            value={branchId}
            options={branchOptions.map((branch) => ({
              value: branch.id,
              label: branch.name
            }))}
            placeholder="Select branch"
            onChange={(value) => setBranchId(value)}
          />
          <Dropdown
            value={branchRole}
            options={branchRoles.map((role) => ({ value: role, label: role }))}
            placeholder="Branch role"
            onChange={(value) => setBranchRole(value as any)}
          />
        </div>
        <Button className="mt-3" onClick={handleAssign} disabled={!foundUser || status === "saving"}>
          {status === "saving" ? "Assigning..." : "Assign roles"}
        </Button>
        {message ? <p className="mt-2 text-xs text-slate-600">{message}</p> : null}
      </Card>

      <Card title="Assigned Users">
        {assigned.length === 0 ? (
          <p className="text-sm text-slate-600">No users assigned yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {assigned.map((item) => {
              const branch = branches.find((b) => b.id === item.branch_id);
              const restaurant = restaurants.find((r) => r.id === branch?.restaurant_id);
              return (
                <li key={item.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {item.user?.full_name ?? item.user?.email ?? "User"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {restaurant?.name ?? "Restaurant"} · {branch?.name ?? "Branch"} · {item.role}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
