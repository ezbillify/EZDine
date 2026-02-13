import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function Card({ title, children, className = "", action }: CardProps) {
  return (
    <div className={`group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
