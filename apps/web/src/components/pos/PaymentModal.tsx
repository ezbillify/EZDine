"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, CreditCard, Banknote, QrCode } from "lucide-react";
import { Button } from "../ui/Button";
import { NumericKeypad } from "./NumericKeypad";

type PaymentModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payments: { method: string; amount: number }[]) => void;
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
    const [useKeyboard] = useState(true); // Toggle between keyboard and keypad
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const formatAmount = (amount: number): string => {
        if (amount === Math.floor(amount)) {
            return amount.toString();
        }
        return amount.toFixed(2);
    };

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
            // Focus cash input after a brief delay
            setTimeout(() => {
                inputRefs.current['cash']?.focus();
                inputRefs.current['cash']?.select();
            }, 100);
        }
    }, [isOpen, totalAmount]);

    const methods = [
        { id: 'cash', label: 'CASH', icon: Banknote, color: 'bg-emerald-500', shortcut: 'Ctrl+1' },
        { id: 'upi', label: 'UPI/SCAN', icon: QrCode, color: 'bg-brand-500', shortcut: 'Ctrl+2' },
        { id: 'card', label: 'CARD', icon: CreditCard, color: 'bg-indigo-500', shortcut: 'Ctrl+3' },
    ] as const;

    const currentTotal = Object.values(amounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const isPaid = currentTotal >= totalAmount - 0.01; // Tolerance

    const handleConfirm = useCallback(() => {
        const payments = Object.entries(amounts)
            .map(([method, amount]) => ({ method, amount: parseFloat(amount) || 0 }))
            .filter(p => p.amount > 0);

        if (payments.length === 0 && totalAmount > 0) return;

        onConfirm(payments as { method: string; amount: number }[]);
    }, [amounts, onConfirm, totalAmount]);

    const handleQuickFill = useCallback((methodId: string) => {
        const otherTotal = Object.entries(amounts)
            .filter(([key]) => key !== methodId)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);

        const toFill = Math.max(0, totalAmount - otherTotal);
        setAmounts(prev => ({ ...prev, [methodId]: formatAmount(toFill) }));
        setActiveField(methodId);
        setTimeout(() => {
            inputRefs.current[methodId]?.focus();
            inputRefs.current[methodId]?.select();
        }, 0);
    }, [amounts, totalAmount]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Enter to confirm
            if (e.key === 'Enter' && isPaid) {
                e.preventDefault();
                handleConfirm();
            }
            // Escape to close
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
            // Tab to switch between fields
            if (e.key === 'Tab') {
                e.preventDefault();
                const methodIds: ('cash' | 'upi' | 'card')[] = ['cash', 'upi', 'card'];
                const currentIndex = methodIds.indexOf(activeField as 'cash' | 'upi' | 'card');
                const nextIndex = e.shiftKey
                    ? (currentIndex - 1 + methodIds.length) % methodIds.length
                    : (currentIndex + 1) % methodIds.length;
                const nextMethod = methodIds[nextIndex] || 'cash';
                setActiveField(nextMethod);
                setTimeout(() => {
                    inputRefs.current[nextMethod]?.focus();
                    inputRefs.current[nextMethod]?.select();
                }, 0);
            }
            // Number keys 1-3 to quick switch payment methods
            if (e.key === '1' && e.ctrlKey) {
                e.preventDefault();
                handleQuickFill('cash');
            }
            if (e.key === '2' && e.ctrlKey) {
                e.preventDefault();
                handleQuickFill('upi');
            }
            if (e.key === '3' && e.ctrlKey) {
                e.preventDefault();
                handleQuickFill('card');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, activeField, isPaid, handleConfirm, handleQuickFill, onClose]);

    const handleInputChange = (methodId: string, value: string) => {
        // Allow only numbers and one decimal point
        if (value && !/^\d*\.?\d*$/.test(value)) return;

        const newAmount = parseFloat(value) || 0;
        const otherTotal = Object.entries(amounts)
            .filter(([k]) => k !== methodId)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            .reduce((sum, [_, val]) => sum + (parseFloat(val) || 0), 0);

        if (otherTotal + newAmount > totalAmount + 0.01) {
            const maxAllowed = totalAmount - otherTotal;
            setAmounts(prev => ({ ...prev, [methodId]: formatAmount(maxAllowed < 0 ? 0 : maxAllowed) }));
        } else {
            setAmounts(prev => ({ ...prev, [methodId]: value }));
        }
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

        handleInputChange(activeField, newValue);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex-none">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Settle Bill</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1">
                            Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">Enter</kbd> to confirm • <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600">Esc</kbd> to cancel
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-6">
                        {/* Left: Payment Methods */}
                        <div className="space-y-4">
                            {/* Total Amount Display */}
                            <div className="bg-slate-50 rounded-3xl p-6 text-center">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total Payable</p>
                                <div className="text-4xl font-black text-slate-900">
                                    <span className="text-xl mr-1 opacity-20">₹</span>
                                    {totalAmount.toFixed(2)}
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="space-y-2">
                                {methods.map((m) => (
                                    <div
                                        key={m.id}
                                        onClick={() => {
                                            setActiveField(m.id);
                                            inputRefs.current[m.id]?.focus();
                                        }}
                                        className={`group relative flex items-center gap-4 rounded-2xl border-2 p-3 transition-all cursor-pointer ${activeField === m.id
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-slate-100 bg-white hover:border-slate-200"
                                            }`}
                                    >
                                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg ${m.color}`}>
                                            <m.icon size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{m.label}</span>
                                                <span className="text-[10px] font-bold text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">{m.shortcut}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-sm font-bold text-slate-300">₹</span>
                                                <input
                                                    ref={el => { inputRefs.current[m.id] = el; }}
                                                    type="text"
                                                    value={amounts[m.id]}
                                                    onChange={(e) => handleInputChange(m.id, e.target.value)}
                                                    onFocus={() => setActiveField(m.id)}
                                                    className="w-full bg-transparent text-lg font-black text-slate-900 outline-none placeholder:text-slate-200"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleQuickFill(m.id);
                                            }}
                                            className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-tighter transition-all ${activeField === m.id
                                                ? "bg-blue-500 text-white shadow-md shadow-blue-200"
                                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                                }`}
                                        >
                                            FILL
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Keypad */}
                        <div className="flex flex-col">
                            <div className="flex-1 rounded-3xl bg-slate-50 p-4">
                                <NumericKeypad
                                    onPress={handleKeyPress}
                                    onDelete={handleDelete}
                                    onClear={handleClear}
                                    onEnter={handleConfirm}
                                    disabled={!useKeyboard}
                                />
                            </div>

                            {/* Summary Footer Area */}
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between px-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Charged</span>
                                    <span className={`text-sm font-bold ${currentTotal > totalAmount + 0.01 ? 'text-blue-600' : 'text-slate-900'}`}>
                                        ₹{currentTotal.toFixed(2)}
                                    </span>
                                </div>
                                {currentTotal < totalAmount - 0.01 ? (
                                    <div className="flex items-center justify-between px-2 text-rose-500">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Left to Pay</span>
                                        <span className="text-sm font-black italic animate-pulse">
                                            ₹{(totalAmount - currentTotal).toFixed(2)}
                                        </span>
                                    </div>
                                ) : currentTotal > totalAmount + 0.01 ? (
                                    <div className="flex items-center justify-between px-2 text-blue-500 bg-blue-50 rounded-xl p-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest">Return Change</span>
                                        <span className="text-sm font-black">
                                            ₹{(currentTotal - totalAmount).toFixed(2)}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-2 text-emerald-500 bg-emerald-50 rounded-xl p-2 justify-center">
                                        <CheckCircle2 size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Exact Amount Paid</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t border-slate-100 bg-slate-50/50 p-6 flex-none">
                    <div className="flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="flex-1 h-14 rounded-2xl border-2 border-slate-200 bg-white text-slate-600 font-black uppercase tracking-widest text-[11px] hover:bg-slate-50 hover:border-slate-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={!isPaid}
                            className={`flex-[2] h-14 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl transition-all ${isPaid
                                ? "bg-slate-900 text-white hover:bg-black shadow-slate-200/50"
                                : "bg-slate-100 text-slate-300 cursor-not-allowed shadow-none"
                                }`}
                        >
                            Complete Payment & Print
                        </Button>
                        <button
                            className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all shadow-sm"
                            title="Print Test Slip"
                        >
                            <QrCode size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function CheckCircle2({ size }: { size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    );
}
