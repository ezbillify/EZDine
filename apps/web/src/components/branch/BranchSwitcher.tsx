"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getAccessibleBranches,
  getAccessibleRestaurants,
  getCurrentUserProfile,
  setActiveBranch,
  setActiveRestaurant
} from "../../lib/tenant";
import type { Branch, Restaurant } from "../../lib/supabaseTypes";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Dropdown } from "../ui/Dropdown";

export function BranchSwitcher() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeRestaurant, setActiveRestaurantState] = useState<string | null>(null);
  const [activeBranch, setActiveBranchState] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const filteredBranches = useMemo(() => {
    if (!activeRestaurant) return branches;
    return branches.filter((b) => b.restaurant_id === activeRestaurant);
  }, [branches, activeRestaurant]);

  const activeBranchData = useMemo(
    () => filteredBranches.find((b) => b.id === activeBranch),
    [filteredBranches, activeBranch]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        const profile = await getCurrentUserProfile();
        const [restaurantsData, branchesData] = await Promise.all([
          getAccessibleRestaurants(),
          getAccessibleBranches(profile?.active_restaurant_id ?? undefined)
        ]);

        if (!mounted) return;
        setRestaurants(restaurantsData);
        setBranches(branchesData);
        const restId = profile?.active_restaurant_id ?? restaurantsData[0]?.id ?? null;
        setActiveRestaurantState(restId);
        setActiveBranchState(profile?.active_branch_id ?? branchesData[0]?.id ?? null);
        setStatus("idle");
      } catch (err) {
        if (!mounted) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load branches");
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (!activeRestaurant) return;
    setStatus("saving");
    setError(null);

    try {
      await setActiveRestaurant(activeRestaurant);
      if (activeBranch) {
        await setActiveBranch(activeBranch);
      }
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to update branch");
    }
  };

  return (
    <Card title="Active Location">
      {restaurants.length === 0 ? (
        <p className="text-sm text-slate-600">No restaurants assigned.</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">Restaurant</label>
            <Dropdown
              value={activeRestaurant}
              options={restaurants.map((restaurant) => ({
                value: restaurant.id,
                label: restaurant.name
              }))}
              placeholder="Select restaurant"
              onChange={(value) => {
                setActiveRestaurantState(value);
                setActiveBranchState(null);
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">Branch</label>
            <Dropdown
              value={activeBranch}
              options={filteredBranches.map((branch) => ({
                value: branch.id,
                label: branch.name
              }))}
              placeholder="Select branch"
              onChange={(value) => setActiveBranchState(value)}
            />
          </div>
          {activeBranchData ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">{activeBranchData.name}</p>
              <p>{activeBranchData.address ?? "Address not set"}</p>
              <p>{activeBranchData.phone ?? "Phone not set"}</p>
            </div>
          ) : null}
          <Button onClick={handleSave} disabled={status === "saving" || !activeRestaurant}>
            {status === "saving" ? "Saving..." : "Save Selection"}
          </Button>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
      )}
    </Card>
  );
}
