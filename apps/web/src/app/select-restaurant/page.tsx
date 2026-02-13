"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { RestaurantCard } from "../../components/restaurant/RestaurantCard";
import { getAccessibleBranches, getAccessibleRestaurants, setActiveRestaurant } from "../../lib/tenant";
import type { Restaurant } from "../../lib/supabaseTypes";

export default function SelectRestaurantPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [branchesByRestaurant, setBranchesByRestaurant] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        const data = await getAccessibleRestaurants();
        const branches = await getAccessibleBranches();
        if (!mounted) return;

        const counts = branches.reduce<Record<string, number>>((acc, branch) => {
          acc[branch.restaurant_id] = (acc[branch.restaurant_id] ?? 0) + 1;
          return acc;
        }, {});

        setRestaurants(data);
        setBranchesByRestaurant(counts);
        setStatus("idle");

        if (data.length === 1 && data[0]) {
          await setActiveRestaurant(data[0].id);
          router.replace("/select-branch");
        }
      } catch (err) {
        if (!mounted) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to load restaurants");
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSelect = async (restaurantId: string) => {
    await setActiveRestaurant(restaurantId);
    router.replace("/select-branch");
  };

  const content = useMemo(() => {
    if (status === "loading") {
      return <p className="text-sm text-slate-600">Loading restaurants...</p>;
    }
    if (status === "error") {
      return <p className="text-sm text-rose-600">{error}</p>;
    }
    if (restaurants.length === 0) {
      return <p className="text-sm text-slate-600">No restaurants assigned.</p>;
    }
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {restaurants.map((restaurant) => (
          <RestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            branchCount={branchesByRestaurant[restaurant.id] ?? 0}
            onSelect={handleSelect}
          />
        ))}
      </div>
    );
  }, [error, restaurants, status, branchesByRestaurant]);

  return (
    <AuthGate enforceContext={false}>
      <AppShell
        title="Select Restaurant"
        subtitle="Choose the restaurant you want to manage"
        showNav={false}
        showUserMenu={false}
      >
        <div className="rounded-3xl border border-white/60 bg-white/70 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Your restaurants</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pick one to continue. You can switch any time.
          </p>
        </div>
        <div className="mt-6">{content}</div>
      </AppShell>
    </AuthGate>
  );
}
