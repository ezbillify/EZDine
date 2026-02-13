"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { getActiveBranchRole, getActiveRestaurantRole } from "../../lib/tenant";

const baseItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pos", label: "POS" },
  { href: "/orders", label: "Orders" },
  { href: "/kds", label: "Kitchen" },
  { href: "/menu", label: "Menu" },
  { href: "/inventory", label: "Inventory" },
  { href: "/customers", label: "Customers" },
  { href: "/tables", label: "Tables" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" }
];

export function PrimaryNav() {
  const pathname = usePathname();
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

  const items =
    role === "owner"
      ? [...baseItems, { href: "/staff", label: "Staff" }]
      : baseItems;

  const filteredItems = items.filter((item) => {
    // Owner always sees full menu + staff
    if (role === "owner") {
      return true;
    }
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
    <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
      {filteredItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`rounded-full border px-4 py-2 font-medium ${
            pathname === item.href
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:text-brand-700"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
