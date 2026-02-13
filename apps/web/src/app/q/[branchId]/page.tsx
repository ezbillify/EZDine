"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { Search, Plus, Minus, ShoppingBag, User, Phone, Check, ChevronRight, Utensils, Zap } from "lucide-react";
import { toast, Toaster } from "sonner";
import { getPublicBranchMenu, createOrder, CartItem } from "../../../lib/pos";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";

export default function QrOrderPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const branchId = params.branchId as string;
    const tableId = searchParams.get("t");

    const [loading, setLoading] = useState(true);
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [step, setStep] = useState<"menu" | "cart" | "customer" | "success">("menu");

    // Customer Data
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [orderId, setOrderId] = useState<string | null>(null);
    const [tokenNumber, setTokenNumber] = useState<number | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const items = await getPublicBranchMenu(branchId);
                setMenuItems(items);

                // Restore customer from local storage
                const savedName = localStorage.getItem("ezdine_cust_name");
                const savedPhone = localStorage.getItem("ezdine_cust_phone");
                if (savedName) setName(savedName);
                if (savedPhone) setPhone(savedPhone);
            } catch (err) {
                toast.error("Failed to load menu");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [branchId]);

    const addToCart = (item: any) => {
        if (!item.is_available) {
            toast.error(`${item.name} is Sold Out!`);
            return;
        }
        setCart(prev => {
            const existing = prev.find(i => i.item_id === item.id);
            if (existing) {
                return prev.map(i => i.item_id === item.id ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, { item_id: item.id, name: item.name, price: item.base_price, qty: 1 }];
        });
        toast.success(`Added ${item.name}`);
    };

    const updateQty = (itemId: string, delta: number) => {
        setCart(prev => prev.map(i => {
            if (i.item_id === itemId) {
                const nextQty = Math.max(0, i.qty + delta);
                return nextQty === 0 ? null : { ...i, qty: nextQty };
            }
            return i;
        }).filter(Boolean) as CartItem[]);
    };

    const total = useMemo(() => cart.reduce((sum, i) => sum + i.price * i.qty, 0), [cart]);

    const handleCheckout = async () => {
        if (!name || phone.length < 10) {
            toast.error("Please provide name and valid phone");
            return;
        }

        localStorage.setItem("ezdine_cust_name", name);
        localStorage.setItem("ezdine_cust_phone", phone);

        setLoading(true);
        try {
            const result = await createOrder(
                tableId,
                cart,
                undefined,
                null, // No customer ID yet as they are public users
                tableId ? 'table' : 'qr',
                'counter_pending'
            );
            setOrderId(result.id);
            setTokenNumber(result.token_number);
            setStep("success");
            setCart([]);
        } catch (err: any) {
            toast.error(err.message || "Failed to place order");
        } finally {
            setLoading(false);
        }
    };

    if (loading && step === "menu") {
        return (
            <div className="flex h-screen items-center justify-center p-4 bg-slate-50">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-16 w-16 bg-brand-600/20 rounded-full flex items-center justify-center">
                        <Utensils className="text-brand-600 animate-bounce" size={32} />
                    </div>
                    <p className="text-slate-400 font-medium font-outfit uppercase tracking-widest text-xs">Loading Menu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-outfit text-slate-900 pb-24">
            <Toaster position="top-center" richColors />

            {/* Header */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-brand-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                        <Utensils size={18} />
                    </div>
                    <h1 className="font-black text-lg tracking-tight uppercase">EZDine</h1>
                </div>
                {tableId ? (
                    <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                        Table {tableId.split('-')[0]}
                    </div>
                ) : (
                    <div className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                        Takeaway
                    </div>
                )}
            </header>

            {step === "menu" && (
                <main className="p-4 space-y-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            placeholder="What would you like to eat?"
                            className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-brand-500 transition-all outline-none"
                        />
                    </div>

                    <div className="space-y-4">
                        {menuItems.map(item => (
                            <div
                                key={item.id}
                                className={`bg-white rounded-[1.5rem] p-4 flex gap-4 shadow-sm border items-center animate-fade-in transition-all ${item.is_available ? 'border-slate-100' : 'border-slate-50 opacity-60 grayscale'}`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`h-2.5 w-2.5 rounded-full border ${item.is_veg ? 'bg-emerald-500 border-emerald-700' : 'bg-rose-500 border-rose-700'}`} />
                                        <h3 className="font-bold text-slate-900 line-clamp-1">{item.name}</h3>
                                        {!item.is_available && (
                                            <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest">Sold Out</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{item.description}</p>
                                    <p className="mt-2 font-black text-brand-700">₹{item.base_price}</p>
                                </div>
                                <button
                                    onClick={() => addToCart(item)}
                                    disabled={!item.is_available}
                                    className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 shadow-sm ${item.is_available ? 'bg-brand-50 text-brand-600 hover:bg-brand-600 hover:text-white' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                                >
                                    {item.is_available ? <Plus size={20} /> : <Zap size={18} className="opacity-20" />}
                                </button>
                            </div>
                        ))}
                    </div>
                </main>
            )}

            {step === "cart" && (
                <main className="p-4 space-y-6 animate-slide-up">
                    <div className="flex items-center gap-2 mb-4">
                        <button onClick={() => setStep("menu")} className="text-slate-400 hover:text-brand-600 transition-colors">
                            <Plus className="rotate-45" size={24} />
                        </button>
                        <h2 className="text-xl font-black uppercase tracking-tight">Your Order</h2>
                    </div>

                    <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-xl shadow-slate-200/50">
                        <div className="p-6 space-y-4">
                            {cart.map(item => (
                                <div key={item.item_id} className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-900">{item.name}</p>
                                        <p className="text-xs text-slate-500">₹{item.price}</p>
                                    </div>
                                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-1.5 ring-1 ring-slate-100">
                                        <button onClick={() => updateQty(item.item_id, -1)} className="h-8 w-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-slate-400 hover:text-rose-500">
                                            <Minus size={16} />
                                        </button>
                                        <span className="font-black text-sm w-4 text-center">{item.qty}</span>
                                        <button onClick={() => updateQty(item.item_id, 1)} className="h-8 w-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-slate-400 hover:text-brand-600">
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-50 p-6 space-y-2 border-t border-slate-100">
                            <div className="flex justify-between text-sm text-slate-500">
                                <span>Items Total</span>
                                <span>₹{total.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-black text-slate-900 border-t border-slate-200 pt-2">
                                <span>Grand Total</span>
                                <span>₹{total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <Button
                        className="w-full h-14 rounded-2xl bg-brand-600 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-500/30"
                        onClick={() => setStep("customer")}
                    >
                        Check Out Order
                    </Button>
                </main>
            )}

            {step === "customer" && (
                <main className="p-4 space-y-6 animate-slide-up">
                    <div className="flex items-center gap-2 mb-4">
                        <button onClick={() => setStep("cart")} className="text-slate-400 hover:text-brand-600 transition-colors">
                            <Plus className="rotate-45" size={24} />
                        </button>
                        <h2 className="text-xl font-black uppercase tracking-tight">Guest Details</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Full Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <Input
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="h-14 pl-12 rounded-2xl bg-white border-slate-200 focus:ring-brand-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">Mobile Number</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <Input
                                    placeholder="10-digit mobile number"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="h-14 pl-12 rounded-2xl bg-white border-slate-200 focus:ring-brand-500"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-brand-50 rounded-2xl flex gap-3 items-start">
                            <Zap size={18} className="text-brand-600 mt-0.5" />
                            <p className="text-xs text-brand-700 leading-relaxed">
                                Your order will be sent to the kitchen instantly. You can pay at the counter using your Token Number.
                            </p>
                        </div>
                    </div>

                    <Button
                        className="w-full h-14 rounded-2xl bg-brand-600 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-brand-500/30"
                        disabled={loading}
                        onClick={handleCheckout}
                    >
                        {loading ? "Placing Order..." : "Confirm & Get Token"}
                    </Button>
                </main>
            )}

            {step === "success" && (
                <main className="p-6 flex flex-col items-center justify-center min-h-[80vh] text-center animate-fade-in">
                    <div className="h-24 w-24 bg-emerald-500 rounded-[2rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-200 mb-8 animate-bounce">
                        <Check size={48} strokeWidth={3} />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Order Received!</h2>
                    <p className="text-slate-500 mb-10 max-w-[240px]">Show this token at the counter to collect your order.</p>

                    <div className="bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 w-full shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Your Token</p>
                        <div className="text-7xl font-black text-slate-900 mb-6 font-mono tracking-tighter">
                            {tokenNumber ?? '---'}
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-xs py-2 border-t border-slate-50">
                                <span className="text-slate-400 font-bold uppercase">Status</span>
                                <span className="text-amber-600 font-black uppercase">Kitchen Processing</span>
                            </div>
                            <div className="flex justify-between text-xs py-2 border-t border-slate-50">
                                <span className="text-slate-400 font-bold uppercase">Order #</span>
                                <span className="text-slate-900 font-mono">{orderId?.slice(0, 8).toUpperCase()}</span>
                            </div>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        className="mt-10 text-brand-600 font-black uppercase tracking-widest text-xs"
                        onClick={() => setStep("menu")}
                    >
                        Back to Menu
                    </Button>
                </main>
            )}

            {/* Floating Cart Button */}
            {cart.length > 0 && step === "menu" && (
                <div className="fixed bottom-6 left-4 right-4 z-50 animate-slide-up">
                    <button
                        onClick={() => setStep("cart")}
                        className="w-full bg-brand-600 text-white h-14 rounded-2xl px-6 flex items-center justify-between shadow-2xl shadow-brand-500/40 active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <ShoppingBag size={18} />
                            </div>
                            <span className="font-black uppercase tracking-widest text-xs">{cart.length} Items Selected</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-black text-sm">₹{total.toFixed(2)}</span>
                            <ChevronRight size={18} />
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
}
