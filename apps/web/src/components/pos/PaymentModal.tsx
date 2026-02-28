"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, Banknote, Smartphone, Check } from "lucide-react";
import { Button } from "../ui/Button";

type PaymentModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payments: any[]) => void;
    totalAmount: number;
};

export function PaymentModal({
    isOpen,
    onClose,
    onConfirm,
    totalAmount
}: PaymentModalProps) {
    const [amounts, setAmounts] = useState<Record<string, string>>({
        cash: "",
        card: "",
        upi: "",
        online: ""
    });

    // Reset & Auto-fill Logic
    useEffect(() => {
        if (isOpen) {
            // Default to Full Cash for speed
            setAmounts({
                cash: totalAmount > 0 ? totalAmount.toFixed(2) : "",
                card: "",
                upi: "",
                online: ""
            });
        }
    }, [isOpen, totalAmount]);

    // Keyboard Shortcut (Enter to Confirm)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === "Enter") {
                e.preventDefault();
                // We need a way to reference the latest state. 
                // Since this effect depends on isPaid/amounts, we might need a ref or include them in dependency.
                // Or better, just attach onKeyDown to the inputs and a global listener for the modal scope.
                document.getElementById("btn-confirm-payment")?.click();
            }
            if (e.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen]);

    const methods = [
        { id: 'cash', label: 'Cash', icon: Banknote, color: 'bg-emerald-500' },
        { id: 'upi', label: 'UPI / Scan', icon: Smartphone, color: 'bg-brand-500' },
        { id: 'card', label: 'Credit/Debit Card', icon: CreditCard, color: 'bg-indigo-500' },
        { id: 'online', label: 'Online / Razorpay', icon: ZapIcon, color: 'bg-sky-500' },
    ] as const;

    const currentTotal = Object.values(amounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const remaining = Math.max(0, totalAmount - currentTotal);
    const isPaid = currentTotal >= totalAmount - 0.5; // Tolerance

    const handleConfirm = () => {
        // Build the result
        // onConfirm expects a single method string strictly, but we need to pass data.
        // We will need to update the Parent to accept an object or array.
        // For now, let's pass a special object via 'any' or refactor the parent first.
        // Wait, the instruction says "Pass list of payments to onConfirm". 
        // I need to update the interface first or cast it.
        // Let's coerce it for now and update Parent immediately after.

        const payments = Object.entries(amounts)
            .map(([method, amount]) => ({ method, amount: parseFloat(amount) || 0 }))
            .filter(p => p.amount > 0);

        if (payments.length === 0 && totalAmount > 0) return;

        // We'll pass the array disguised as the first arg, or we need to update the prop type.
        // Since I can't change the parent in this same tool call, and TypeScript will error if I change the prop type here without changing parent,
        // I will update the prop type definition in this file to `any` temporarily or `(method: string | any[])`.
        // Actually, I can just update the type definition here!
        onConfirm(payments as any);
    };

    const handleQuickFill = (methodId: string) => {
        const otherTotal = Object.entries(amounts)
            .filter(([key]) => key !== methodId)
            .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);

        const toFill = Math.max(0, totalAmount - otherTotal);
        if (toFill > 0) {
            setAmounts(prev => ({ ...prev, [methodId]: toFill.toFixed(2) }));
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex-none">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Record Payment</h3>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 overflow-y-auto">
                    <div className="text-center mb-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Total Payable</p>
                        <div className="text-4xl font-black text-slate-900 tracking-tighter">
                            <span className="text-lg text-slate-400 mr-1">₹</span>
                            {totalAmount.toFixed(2)}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {methods.map((method) => (
                            <div key={method.id} className="flex items-center gap-3 group">
                                <button
                                    onClick={() => handleQuickFill(method.id)}
                                    className={`flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-white shadow-md transition-transform active:scale-95 ${method.color}`}
                                    title="Click to fill remaining"
                                >
                                    <method.icon size={20} />
                                </button>
                                <div className="flex-1 relative">
                                    <label className="absolute -top-2 left-2 px-1 bg-white text-[10px] font-bold uppercase text-slate-400">
                                        {method.label}
                                    </label>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        value={amounts[method.id]}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const numVal = parseFloat(val) || 0;
                                            const otherTotal = Object.entries(amounts)
                                                .filter(([key]) => key !== method.id)
                                                .reduce((sum, [_, v]) => sum + (parseFloat(v) || 0), 0);

                                            if (otherTotal + numVal > totalAmount + 0.01) {
                                                const max = Math.max(0, totalAmount - otherTotal);
                                                setAmounts(prev => ({ ...prev, [method.id]: max.toFixed(2) }));
                                            } else {
                                                setAmounts(prev => ({ ...prev, [method.id]: val }));
                                            }
                                        }}
                                        autoFocus={method.id === 'cash'}
                                        className="h-12 w-full rounded-xl border border-slate-200 pl-4 pr-4 font-mono font-bold text-lg text-slate-900 placeholder:text-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 bg-slate-50 p-4 px-6 space-y-3 flex-none">
                    <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-slate-500">Paid: <span className="text-slate-900">₹{currentTotal.toFixed(2)}</span></span>
                        <span className={remaining > 0 ? "text-rose-600" : "text-emerald-600"}>
                            {remaining > 0 ? `Remaining: ₹${remaining.toFixed(2)}` : "Fully Paid"}
                        </span>
                    </div>

                    <Button
                        id="btn-confirm-payment"
                        onClick={handleConfirm}
                        disabled={!isPaid && totalAmount > 0}
                        className={`w-full h-14 text-lg rounded-2xl shadow-xl transition-all ${isPaid
                            ? "bg-slate-900 hover:bg-black text-white shadow-slate-900/10 hover:shadow-slate-900/20"
                            : "bg-slate-100 text-slate-300 cursor-not-allowed"
                            }`}
                    >
                        Confirm Settlement
                    </Button>
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
