import type { ReactNode } from "react";

type RoleBadgeProps = {
  label: ReactNode;
};

export function RoleBadge({ label }: RoleBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm ring-1 ring-inset ring-slate-900/10">
      {label}
    </span>
  );
}
