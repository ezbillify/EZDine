import { HTMLAttributes, ReactNode } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    gradient?: boolean;
}

export function GlassCard({ children, className = "", onClick, ...props }: GlassCardProps) {
    return (
        <div
            className={`
        relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:shadow-md
        ${onClick ? "cursor-pointer hover:-translate-y-1 hover:border-brand-300" : ""}
        ${className}
      `}
            onClick={onClick}
            {...props}
        >
            {children}
        </div>
    );
}
