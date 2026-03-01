"use client";

import { useState, useEffect } from "react";
import { X, CreditCard, Banknote, Smartphone, QrCode } from "lucide-react";
import { Button } from "../ui/Button";
import { NumericKeypad } from "./NumericKeypad";

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
        upi: ""
    });
    
    const [activeField, setActiveField] = useState<string>("cash");

    // Reset & Auto-fill Logic
    useEffect(() => {
        if (isOpen) {
            // Default to Full Cash for speed
            setAmounts({
                cash: totalAmount > 0 ? formatAmount(totalAmount) : "",
                card: "",
                upi: ""
            });
            setActiveField("cash");
        }
    }, [isOpen, totalAmount]);

    const formatAmount = (amount: number): string => {
        if (amount === Math.floor(amount)) {
            return amount.toString();
        }
        return amount.toFixed(2);
    };

    const methods = [
        { id: 'cash', label: 'CASH', icon: Banknote, color: 'bg-emerald-500' },
        { id: 'upi', label: 'UPI/SCAN', icon: QrCode, color: 'bg-brand-500' },
        { id: 'card', label: 'CARD', icon: CreditCard, color: 'bg-indigo-500' },
    ] as const;

    const currentTotal = Object.values(amounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const remaining = Math.max(0, totalAmount - currentTotal);
    const isPaid = currentTotal >= totalAmount - 0.01; // Tolerance

    const handleConfirm = () => {
        const payments = Object.entries(amounts)
            .map(([method, amount]) => ({ method, amount: parseFloat(amount) || 0 }))
            .filter(p => p.amount > 0);

        if (payments.length === 0 && totalAmount > 0) return;

        onConfirm(payments as any);
    };

    const handleQuickFill = (methodId: string) => {
        const otherTotal = Object.entries(amounts)
            .filter(([key]) => key !== methodId)
            .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);

        const toFill = Math.max(0, totalAmount - otherTotal);
        setAmounts(prev => ({ ...prev, [methodId]: formatAmount(toFill) }));
        setActiveField(methodId);
    };

    const handleKeyPress = (key: string) => {
        const currentValue = amounts[activeField] || "";
        let newValue = currentValue;

        if (key === '.') {
            if (!currentValue.includes('.')) {
                newValue = currentValue + key;
            }
        } else {
            newValue = currentValue + key;
        }

        const newAmount = parseFloat(newValue) || 0;
        const otherTotal = Object.entries(amounts)
            .filter(([k]) => k !== activeField)
            .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);

        if (otherTotal + newAmount > totalAmount + 0.01) {
            const maxAllowed = totalAmount - otherTotal;
            setAmounts(prev => ({ ...prev, [activeField]: formatAmount(maxAllowed < 0 ? 0 : maxAllowed) }));
        } else {
            setAmounts(prev => ({ ...prev, [activeField]: newValue }));
        }
    };

    const handleDelete = () => {
        const currentValue = amounts[activeField] || "";
        if (currentValue.length > 0) {
            setAmounts(prev => ({ ...prev, [activeField]: currentValue.slice(0, -1) }));
        }
    };

    const handleClear = () => {
        setAmounts(prev => ({ ...prev, [activeField]: "" }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex-none">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Settle Bill</h3>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Total Amount Display */}
                    <div className="bg-slate-50 rounded-3xl p-6 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total Payable</p>
                        <div className="text-5xl font-black text-slate-900 tracking-tighter mb-4">
                            ₹{formatAmount(totalAmount)}
                        </div>
                        <div className="flex items-center justify-center gap-3">
                            <div className="h-px w-10 bg-slate-200" />
                            <p className={`text-sm font-black uppercase tracking-tight ${remaining <= 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {remaining <= 0.01 ? 'PAID IN FULL' : `DUE: ₹${formatAmount(remaining)}`}
                            </p>
                            <div className="h-px w-10 bg-slate-200" />
                        </div>
                    </div>

                    {/* Payment Method Buttons */}
                    <div className="grid grid-cols-3 gap-3">
                        {methods.map((method) => {
                            const isActive = activeField === method.id;
                            const hasValue = (parseFloat(amounts[method.id] || "") || 0) > 0;
                            
                            return (
                                <button
                                    key={method.id}
                                    onClick={() => {
                                        if (activeField === method.id && !hasValue) {
                                            handleQuickFill(method.id);
                                        } else {
                                            setActiveField(method.id);
                                        }
                                    }}
                                    onDoubleClick={() => handleQuickFill(method.id)}
                                    className={`p-4 rounded-2xl transition-all duration-200 ${
                                        isActive 
                                            ? `${method.color} text-white shadow-lg` 
                                            : 'bg-white border-2 border-slate-100 text-slate-600 hover:border-slate-200'
                                    }`}
                                >
                                    <method.icon size={22} className="mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-tight mb-1">{method.label}</p>
                                    {hasValue && (
                                        <p className={`text-xs font-black ${isActive ? 'text-white' : method.color.replace('bg-', 'text-')}`}>
                                            ₹{amounts[method.id]}
                                        </p>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Numeric Keypad */}
                    <NumericKeypad
                        onKeyPress={handleKeyPress}
                        onDelete={handleDelete}
                        onClear={handleClear}
                    />
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 bg-slate-50 p-6 space-y-3 flex-none">
                    <Button
                        id="btn-confirm-payment"
                        onClick={handleConfirm}
                        disabled={!isPaid && totalAmount > 0}
                        className={`w-full h-16 text-sm rounded-2xl shadow-xl transition-all font-black uppercase tracking-[0.2em] ${isPaid
                            ? "bg-slate-900 hover:bg-black text-white shadow-slate-900/10 hover:shadow-slate-900/20"
                            : "bg-slate-100 text-slate-300 cursor-not-allowed"
                            }`}
                    >
                        Confirm & Settle
                    </Button>
                </div>
            </div>
        </div>
    );
}
