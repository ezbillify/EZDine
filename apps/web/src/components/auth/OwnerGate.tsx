"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getActiveRestaurantRole } from "../../lib/tenant";

type OwnerGateProps = {
  children: React.ReactNode;
};

export function OwnerGate({ children }: OwnerGateProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = async () => {
      const role = await getActiveRestaurantRole();
      if (role !== "owner") {
        router.replace("/dashboard");
        return;
      }
      setReady(true);
    };

    check();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Checking permissions...
      </div>
    );
  }

  return <>{children}</>;
}
