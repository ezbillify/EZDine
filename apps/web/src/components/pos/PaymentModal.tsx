"use client";

import { X, CreditCard, Banknote, Smartphone, Check } from "lucide-react";
import { Button } from "../ui/Button";

type PaymentModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (method: 'cash' | 'card' | 'upi' | 'online') => void;
    totalAmount: number;
};

export function PaymentModal({
    isOpen,
    onClose,
    onConfirm,
    totalAmount
}: PaymentModalProps) {
    if (!isOpen) return null;

    const methods = [
        { id: 'cash', label: 'Cash', icon: Banknote, color: 'bg-emerald-500' },
        { id: 'upi', label: 'UPI / Scan', icon: Smartphone, color: 'bg-brand-500' },
        { id: 'card', label: 'Credit/Debit Card', icon: CreditCard, color: 'bg-indigo-500' },
        { id: 'online', label: 'Online / Razorpay', icon: ZapIcon, color: 'bg-sky-500' },
    ] as const;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Record Payment</h3>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="text-center mb-8">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Total Payable</p>
                        <div className="text-4xl font-black text-slate-900 tracking-tighter">
                            <span className="text-lg text-slate-400 mr-1">₹</span>
                            {totalAmount.toFixed(2)}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {methods.map((method) => (
                            <button
                                key={method.id}
                                onClick={() => onConfirm(method.id)}
                                className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-white hover:border-brand-200 hover:shadow-lg active:scale-95"
                            >
                                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md transition-transform group-hover:scale-110 ${method.color}`}>
                                    <method.icon size={24} />
                                </div>
                                <span className="text-xs font-black uppercase tracking-wide text-slate-600 group-hover:text-slate-900">
                                    {method.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 bg-slate-50/30 p-4 px-6 text-center">
                    <p className="text-[10px] font-medium text-slate-400">
                        Recording payment will mark the order as <span className="font-bold text-emerald-600">PAID</span> and print the bill.
                    </p>
                </div>
            </div>
        </div>
    );
}

function ZapIcon({ size, className }: { size?: number, className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
    )
}
