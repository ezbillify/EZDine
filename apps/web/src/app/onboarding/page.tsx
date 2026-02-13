"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthGate } from "../../components/auth/AuthGate";
import { AppShell } from "../../components/layout/AppShell";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { bootstrapRestaurant } from "../../lib/onboarding";
import { getAccessibleRestaurants } from "../../lib/tenant";

export default function OnboardingPage() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const restaurants = await getAccessibleRestaurants();
      if (restaurants.length > 0) {
        router.replace("/dashboard");
      }
    };
    check();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("saving");
    setMessage(null);

    try {
      await bootstrapRestaurant({
        restaurant_name: restaurantName,
        branch_name: branchName,
        city: city || null,
        state: state || null
      });
      setStatus("success");
      setMessage("Restaurant created. You can now open the dashboard.");
      router.replace("/dashboard");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to create restaurant");
    }
  };

  return (
    <AuthGate enforceContext={false}>
      <AppShell title="Onboarding" subtitle="Create your restaurant and first branch">
        <div className="max-w-xl">
          <Card title="Restaurant setup">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Restaurant name</label>
                <Input
                  value={restaurantName}
                  onChange={(event) => setRestaurantName(event.target.value)}
                  placeholder="EZ Dine Bistro"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Main branch name</label>
                <Input
                  value={branchName}
                  onChange={(event) => setBranchName(event.target.value)}
                  placeholder="Koramangala"
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">City</label>
                  <Input value={city} onChange={(event) => setCity(event.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">State</label>
                  <Input value={state} onChange={(event) => setState(event.target.value)} />
                </div>
              </div>
              <Button type="submit" disabled={status === "saving"}>
                {status === "saving" ? "Creating..." : "Create restaurant"}
              </Button>
              {message ? <p className="text-sm text-slate-600">{message}</p> : null}
            </form>
          </Card>
        </div>
      </AppShell>
    </AuthGate>
  );
}
