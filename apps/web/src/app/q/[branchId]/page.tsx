"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Script from "next/script";
import {
    Search, Plus, Minus, ShoppingBag, User, Phone,
    Check, ChevronRight, Utensils, Zap, Star, Clock,
    ChevronLeft, ArrowRight, Info, Coffee, CheckCircle2
} from "lucide-react";
import { toast, Toaster } from "sonner";
import {
    getPublicBranchMenu, createOrder, CartItem, getPublicBranchDetails,
    getMenuCategories, checkCustomerExist, createPublicCustomer, getOrdersByPhone
} from "../../../lib/pos";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { verifyPayment } from "../../../lib/pos";
import { supabase } from "../../../lib/supabaseClient";

declare global {
    interface Window {
        Razorpay: any;
    }
}

export default function QrOrderPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const branchId = params.branchId as string;
    const initialTableId = searchParams.get("t");

    const [loading, setLoading] = useState(true);
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [branchInfo, setBranchInfo] = useState<any>(null);
    const [activeCategory, setActiveCategory] = useState<string>("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [step, setStep] = useState<"onboarding_type" | "onboarding_mobile" | "onboarding_name" | "menu" | "cart" | "payment" | "success" | "track_lookup" | "track_view">("onboarding_type");

    // Customer & Order Data
    const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
    useEffect(() => {
        if (initialTableId) setOrderType("dine_in");
    }, [initialTableId]);
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
    const [orderId, setOrderId] = useState<string | null>(null);
    const [tokenNumber, setTokenNumber] = useState<number | null>(null);
    const [trackedOrders, setTrackedOrders] = useState<any[]>([]);
    const [trackPhone, setTrackPhone] = useState("");

    const categoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [items, branchData, cats] = await Promise.all([
                    getPublicBranchMenu(branchId),
                    getPublicBranchDetails(branchId),
                    getMenuCategories(branchId)
                ]);

                setMenuItems(items);
                setBranchInfo(branchData);
                setCategories([{ id: 'all', name: 'All' }, ...cats]);

                // Restore customer from local storage
                const savedName = localStorage.getItem("ezdine_cust_name");
                const savedPhone = localStorage.getItem("ezdine_cust_phone");
                if (savedName) setName(savedName);
                if (savedPhone) setPhone(savedPhone);

                // If we have saved details, we could potentially skip onboarding,
                // but the user wants to choose Dine In / Takeaway first.
            } catch (err) {
                console.error(err);
                toast.error("Failed to load restaurant data");
            } finally {
                setLoading(false);
            }
        };
        load();

        const channel = supabase
            .channel(`menu-realtime-${branchId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "menu_items",
                    filter: `branch_id=eq.${branchId}`
                },
                (payload) => {
                    if (payload.eventType === 'UPDATE') {
                        const updated = payload.new as any;
                        setMenuItems(prev => prev.map(item =>
                            item.id === updated.id ? { ...item, ...updated } : item
                        ));
                    } else {
                        // For INSERT/DELETE, just reload the list
                        getPublicBranchMenu(branchId).then(setMenuItems);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [branchId]);

    const filteredItems = useMemo(() => {
        return menuItems.filter(item => {
            const matchesCategory = activeCategory === "All" || item.menu_categories?.name === activeCategory;
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [menuItems, activeCategory, searchQuery]);

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

    const handleMobileSubmit = async () => {
        if (!phone || phone.length < 10) {
            toast.error("Please enter a valid phone number");
            return;
        }

        setLoading(true);
        try {
            const customer = await checkCustomerExist(branchInfo.restaurant_id, phone);
            if (customer) {
                setName(customer.name);
                setCustomerId(customer.id);
                localStorage.setItem("ezdine_cust_name", customer.name);
                localStorage.setItem("ezdine_cust_phone", phone);
                setStep("menu");
                toast.success(`Welcome back, ${customer.name}!`);
            } else {
                setStep("onboarding_name");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error checking customer details");
        } finally {
            setLoading(false);
        }
    };

    const handleNameSubmit = async () => {
        if (!name) {
            toast.error("Please enter your name");
            return;
        }

        setLoading(true);
        try {
            const customer = await createPublicCustomer(branchInfo.restaurant_id, name, phone);
            setCustomerId(customer.id);
            localStorage.setItem("ezdine_cust_name", name);
            localStorage.setItem("ezdine_cust_phone", phone);
            setStep("menu");
            toast.success("Details saved! Enjoy your meal.");
        } catch (err) {
            console.error(err);
            toast.error("Error saving your details");
        } finally {
            setLoading(false);
        }
    };

    const handleTrackLookup = async () => {
        if (!trackPhone || trackPhone.length < 10) {
            toast.error("Please enter your valid phone number");
            return;
        }
        setLoading(true);
        try {
            const orders = await getOrdersByPhone(branchId, trackPhone);
            if (orders.length === 0) {
                toast.error("No active orders found for this number");
            } else {
                setTrackedOrders(orders);
                setStep("track_view");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error looking up orders");
        } finally {
            setLoading(false);
        }
    };

    const handleOnboardingComplete = () => {
        if (!name.trim()) {
            toast.error("Please enter your name");
            return;
        }
        if (phone.length < 10) {
            toast.error("Please enter a valid phone number");
            return;
        }
        localStorage.setItem("ezdine_cust_name", name);
        localStorage.setItem("ezdine_cust_phone", phone);
        setStep("menu");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleCheckout = async () => {
        setLoading(true);
        try {
            // 1. Create Order first (status: pending/counter_pending)
            const result = await createOrder(
                orderType === "dine_in" ? (initialTableId || null) : null,
                cart,
                undefined,
                customerId,
                initialTableId ? 'table' : 'qr',
                'counter_pending', // Always start as counter_pending until paid
                branchId,
                branchInfo.restaurant_id,
                paymentMethod,
                orderType
            );

            setOrderId(result.id);
            setTokenNumber(result.token_number);

            // 2. Handle Online Payment if selected
            if (paymentMethod === 'online') {
                if (!branchInfo.razorpay_enabled || !branchInfo.razorpay_key) {
                    toast.error("Online payments are currently unavailable for this branch.");
                    setLoading(false);
                    return;
                }

                const options = {
                    key: branchInfo.razorpay_key,
                    amount: Math.round(total * 100), // In paise
                    currency: "INR",
                    name: branchInfo.restaurant?.name || "EZDine",
                    description: `Order #${result.order_number}`,
                    order_id: "", // We can use direct capture or pass a Razorpay Order ID if implemented
                    handler: async function (response: any) {
                        try {
                            setLoading(true);
                            await verifyPayment(result.id, response.razorpay_payment_id, response.razorpay_signature);
                            setStep("success");
                            setCart([]);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        } catch (err) {
                            toast.error("Payment verification failed. Please contact staff.");
                        } finally {
                            setLoading(false);
                        }
                    },
                    prefill: {
                        name: name,
                        contact: phone,
                    },
                    theme: {
                        color: "#0F172A",
                    },
                };

                const rzp = new window.Razorpay(options);
                rzp.open();
                setLoading(false);
                return;
            }

            // 3. For Cash, proceed to success immediately
            setStep("success");
            setCart([]);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err: any) {
            toast.error(err.message || "Failed to place order");
        } finally {
            setLoading(false);
        }
    };

    if (loading && (step === "onboarding_type" || step === "onboarding_mobile")) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Getting things ready...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-outfit select-none">
            <Toaster position="top-center" richColors />

            {/* Premium Header */}
            {step !== "onboarding_type" && step !== "onboarding_mobile" && step !== "onboarding_name" && step !== "success" && (
                <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                <Utensils size={20} />
                            </div>
                            <div>
                                <h1 className="font-extrabold text-xl tracking-tight leading-none text-slate-900">
                                    {branchInfo?.restaurant?.name || "EZDine"}
                                </h1>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                    <span className="h-1 w-1 bg-brand-500 rounded-full" />
                                    {branchInfo?.name || "Main Branch"}
                                </p>
                            </div>
                        </div>
                        <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border ${orderType === 'dine_in' ? 'bg-brand-50 border-brand-100 text-brand-600' : 'bg-slate-900 border-slate-900 text-white'}`}>
                            {orderType === 'dine_in' ? (
                                <>
                                    <span className="h-2 w-2 rounded-full bg-brand-600 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{initialTableId ? `Table ${initialTableId.split('-')[0]}` : "Dine In"}</span>
                                </>
                            ) : (
                                <>
                                    <ShoppingBag size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Takeaway</span>
                                </>
                            )}
                        </div>
                    </div>
                </header>
            )}

            {/* Onboarding: Step 1 - Order Type */}
            {step === "onboarding_type" && (
                <main className="min-h-[90vh] flex flex-col items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-700">
                    <div className="w-full max-w-[340px] bg-white rounded-3xl shadow-xl border border-slate-100 p-6 pt-8 text-center">
                        <div className="mb-6">
                            <div className="h-14 w-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-slate-200">
                                <Coffee size={24} />
                            </div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-1">Welcome to</h2>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">
                                {branchInfo?.restaurant?.name || "EZDine"}
                            </h1>
                            <p className="text-slate-400 font-medium text-[11px] tracking-wide">Select your dining preference</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <Button
                                variant={orderType === "dine_in" ? "primary" : "outline"}
                                className={`h-28 rounded-3xl flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-all border-2 ${orderType === "dine_in"
                                    ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                                    : "bg-white border-slate-100 text-slate-400 opacity-60"
                                    }`}
                                onClick={() => setOrderType("dine_in")}
                            >
                                <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${orderType === "dine_in" ? "bg-white/10" : "bg-slate-50"}`}>
                                    <Utensils size={22} className={orderType === "dine_in" ? "text-white" : "text-slate-400"} />
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest block">Dine-In</span>
                                    {orderType === "dine_in" && <div className="h-1 w-1 bg-brand-500 rounded-full mx-auto" />}
                                </div>
                            </Button>
                            <Button
                                variant={orderType === "takeaway" ? "primary" : "outline"}
                                className={`h-28 rounded-3xl flex flex-col items-center justify-center gap-2 active:scale-[0.98] transition-all border-2 ${orderType === "takeaway"
                                    ? "bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-200"
                                    : "bg-white border-slate-100 text-slate-400 opacity-60"
                                    }`}
                                onClick={() => setOrderType("takeaway")}
                            >
                                <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${orderType === "takeaway" ? "bg-white/10" : "bg-slate-50"}`}>
                                    <ShoppingBag size={22} className={orderType === "takeaway" ? "text-white" : "text-slate-400"} />
                                </div>
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest block">Takeaway</span>
                                    {orderType === "takeaway" && <div className="h-1 w-1 bg-brand-500 rounded-full mx-auto" />}
                                </div>
                            </Button>
                        </div>

                        <button
                            className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[12px] shadow-lg shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                            onClick={() => setStep("onboarding_mobile")}
                        >
                            Continue <ArrowRight size={18} />
                        </button>

                        <button
                            onClick={() => setStep("track_lookup")}
                            className="mt-12 group flex items-center gap-2 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-900 transition-colors"
                        >
                            <Clock size={14} className="group-hover:animate-spin-slow" />
                            Already Ordered? Check Status
                        </button>
                    </div>
                </main>
            )}

            {step === "track_lookup" && (
                <main className="min-h-[90vh] flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-10 duration-500">
                    <div className="w-full max-w-[340px] bg-white rounded-3xl shadow-xl border border-slate-100 p-6 pt-8 relative overflow-hidden text-center">
                        <button
                            onClick={() => setStep("onboarding_type")}
                            className="absolute top-4 left-4 p-2 rounded-full bg-slate-100 text-slate-900 active:scale-90 transition-all"
                        >
                            <ChevronLeft size={18} />
                        </button>

                        <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 mx-auto shadow-sm">
                            <Clock size={28} className="text-emerald-600" />
                        </div>

                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-1">Track Order</h2>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-3 italic">Check Status</h1>
                        <p className="text-slate-400 font-bold mb-8 max-w-[200px] mx-auto text-xs">Enter your mobile number to see your live kitchen status.</p>

                        <div className="space-y-4">
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                <input
                                    type="tel"
                                    placeholder="Phone Number"
                                    value={trackPhone}
                                    onChange={(e) => setTrackPhone(e.target.value)}
                                    className="w-full h-14 pl-12 pr-4 bg-slate-50 border-none rounded-2xl text-base font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-slate-900/5 transition-all outline-none"
                                />
                            </div>

                            <Button
                                variant="primary"
                                className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] active:scale-[0.98] transition-all shadow-lg shadow-slate-200"
                                onClick={handleTrackLookup}
                                disabled={loading}
                            >
                                {loading ? "Searching..." : "Track My Orders"}
                            </Button>
                        </div>
                    </div>
                </main>
            )}

            {step === "track_view" && (
                <main className="min-h-[90vh] flex flex-col items-center p-6 bg-slate-50/50 animate-in fade-in duration-500">
                    <div className="w-full max-w-[400px] flex items-center justify-between mb-8">
                        <button
                            onClick={() => setStep("track_lookup")}
                            className="p-3 rounded-2xl bg-white text-slate-900 shadow-sm active:scale-90 transition-all border border-slate-100"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight italic">Live Status</h2>
                        <div className="w-10" />
                    </div>

                    <div className="w-full max-w-[400px] space-y-4">
                        {trackedOrders.length > 0 ? trackedOrders.map((order) => (
                            <div key={order.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm relative overflow-hidden">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Token</p>
                                        <p className="text-4xl font-black text-slate-900 italic tracking-tighter">#{order.token_number}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'ready' ? 'bg-emerald-50 text-emerald-600' :
                                            order.status === 'preparing' ? 'bg-amber-50 text-amber-600 animate-pulse' :
                                                'bg-slate-50 text-slate-400'
                                            }`}>
                                            {order.status}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
                                        <Clock size={12} />
                                        <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className={`text-[10px] font-black uppercase tracking-widest ${order.payment_status === 'paid' ? 'text-emerald-500' : 'text-amber-500'
                                        }`}>
                                        {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className="py-20 text-center opacity-40">
                                <p className="font-black uppercase tracking-widest text-[10px]">No active orders found</p>
                            </div>
                        )}
                    </div>

                    <p className="mt-12 text-[10px] font-bold text-slate-400 text-center max-w-[220px] leading-relaxed">
                        Stay close to the counter if your status is <span className="text-emerald-600 font-black">"Ready"</span>.
                    </p>

                    <button
                        onClick={() => setStep("onboarding_type")}
                        className="mt-8 text-slate-900 font-black uppercase tracking-widest text-[10px] underline underline-offset-8 decoration-slate-200"
                    >
                        Back to Welcome
                    </button>
                </main>
            )}

            {/* Onboarding: Step 2 - Mobile Number */}
            {step === "onboarding_mobile" && (
                <main className="min-h-[90vh] flex flex-col items-center justify-center p-4 animate-in slide-in-from-bottom-10 duration-500">
                    <div className="w-full max-w-[340px] bg-white rounded-3xl shadow-xl border border-slate-100 p-6 pt-8 relative overflow-hidden">
                        <div className="mb-6 text-center">
                            <div className="h-12 w-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Zap size={20} />
                            </div>
                            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-1">Quick Login</h2>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">Your Mobile</h1>
                            <p className="text-slate-400 font-medium text-[11px] tracking-wide">Enter your number to continue</p>
                        </div>

                        <div className="relative mb-6">
                            <Phone className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${phone ? 'text-slate-900' : 'text-slate-300'}`} size={18} />
                            <input
                                placeholder="Phone Number"
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="w-full h-14 pl-12 pr-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-slate-900/10 focus:bg-white transition-all outline-none font-bold text-base text-slate-900 placeholder:text-slate-300"
                            />
                        </div>

                        <button
                            className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[12px] shadow-lg shadow-slate-200 disabled:opacity-50 transition-all active:scale-95"
                            onClick={handleMobileSubmit}
                            disabled={loading || phone.length < 10}
                        >
                            {loading ? "Verifying..." : "Proceed to Menu"}
                        </button>

                        <button onClick={() => setStep("onboarding_type")} className="w-full mt-4 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Back
                        </button>
                    </div>
                </main>
            )}

            {/* Onboarding: Step 3 - Name Entry */}
            {step === "onboarding_name" && (
                <main className="min-h-[90vh] flex flex-col items-center justify-center p-4 animate-in fade-in duration-500">
                    <div className="w-full max-w-[340px] bg-white rounded-3xl shadow-xl border border-slate-100 p-6 pt-8 text-center relative">
                        <div className="h-12 w-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <User size={20} />
                        </div>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-1">New Guest</h2>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">What's your name?</h1>
                        <p className="text-slate-400 font-medium text-[11px] tracking-wide mb-6">We'd love to know who we're serving!</p>

                        <div className="relative mb-6">
                            <User className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${name ? 'text-slate-900' : 'text-slate-300'}`} size={18} />
                            <input
                                placeholder="Your Name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                autoFocus
                                className="w-full h-14 pl-12 pr-6 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-slate-900/10 focus:bg-white transition-all outline-none font-bold text-base text-slate-900 placeholder:text-slate-300"
                            />
                        </div>

                        <button
                            className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[12px] shadow-lg shadow-slate-200 disabled:opacity-50 transition-all active:scale-95"
                            onClick={handleNameSubmit}
                            disabled={loading || !name}
                        >
                            {loading ? "Welcome..." : "Start Ordering"}
                        </button>
                    </div>
                </main>
            )}

            {/* Menu Screen */}
            {step === "menu" && (
                <main className="animate-in fade-in duration-700 slide-in-from-bottom-2 pb-32">
                    <div className="px-4 pt-4 pb-2 bg-slate-50/80 sticky top-[73px] z-40 backdrop-blur-md">
                        <div className="relative mb-4">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <Search size={20} />
                            </div>
                            <input
                                placeholder="Search menu..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full h-12 bg-white border border-slate-200 rounded-2xl pl-12 pr-4 text-base font-medium focus:ring-2 focus:ring-slate-900/5 transition-all outline-none"
                            />
                        </div>

                        <div ref={categoryRef} className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.name)}
                                    className={`whitespace-nowrap px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat.name
                                        ? "bg-slate-900 text-white shadow-md shadow-slate-200"
                                        : "bg-white text-slate-500 border border-slate-100"
                                        }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 grid gap-4">
                        {filteredItems.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center opacity-40">
                                <Search size={40} className="text-slate-300 mb-4" />
                                <h3 className="font-black text-slate-400 uppercase tracking-widest text-[10px]">No matches</h3>
                            </div>
                        ) : (
                            filteredItems.map(item => (
                                <div key={item.id} className={`bg-white rounded-3xl p-5 flex gap-5 border border-slate-100 shadow-sm items-center ${!item.is_available ? 'opacity-50 grayscale' : ''}`}>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`h-2.5 w-2.5 rounded-full ${item.is_veg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{item.menu_categories?.name}</span>
                                            {!item.is_available && <span className="text-[9px] font-black text-rose-500 uppercase ml-auto tracking-widest">Sold Out</span>}
                                        </div>
                                        <h3 className="font-extrabold text-lg text-slate-900 leading-tight mb-1">{item.name}</h3>
                                        <p className="text-[11px] font-medium text-slate-400 line-clamp-2 mb-3">{item.description}</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xs font-bold text-slate-400">₹</span>
                                            <span className="font-black text-xl text-slate-900 italic tracking-tighter">{item.base_price}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => addToCart(item)}
                                        disabled={!item.is_available}
                                        className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${item.is_available ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'bg-slate-100 text-slate-300'}`}
                                    >
                                        <Plus size={22} strokeWidth={2.5} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </main>
            )}

            {/* Cart Screen */}
            {step === "cart" && (
                <main className="p-4 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="flex items-center justify-between mb-8">
                        <button onClick={() => setStep("menu")} className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 text-slate-400">
                            <ChevronLeft size={24} />
                        </button>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight text-center flex-1">Your Order</h2>
                        <div className="w-12" />
                    </div>

                    <div className="space-y-3 mb-6">
                        {cart.length === 0 ? (
                            <div className="py-20 text-center opacity-40">
                                <ShoppingBag size={40} className="mx-auto mb-4" />
                                <h3 className="font-black uppercase tracking-widest text-[10px]">Your basket is empty</h3>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.item_id} className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-100">
                                    <div className="flex-1">
                                        <p className="font-black text-slate-900 leading-none mb-1">{item.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400">₹{item.price}</p>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-1 border border-slate-100">
                                        <button onClick={() => updateQty(item.item_id, -1)} className="h-8 w-8 bg-white rounded-lg flex items-center justify-center text-slate-400 shadow-sm">
                                            <Minus size={16} strokeWidth={3} />
                                        </button>
                                        <span className="font-black text-sm w-4 text-center text-slate-900">{item.qty}</span>
                                        <button onClick={() => updateQty(item.item_id, 1)} className="h-8 w-8 bg-white rounded-lg flex items-center justify-center text-slate-400 shadow-sm">
                                            <Plus size={16} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {cart.length > 0 && (
                        <>
                            <div className="bg-slate-900 rounded-3xl p-6 text-white mb-6">
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span>Subtotal</span>
                                        <span>₹{total.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <span>Taxes</span>
                                        <span className="text-emerald-500">Free</span>
                                    </div>
                                </div>
                                <div className="h-px bg-white/10 mb-4" />
                                <div className="flex justify-between items-end">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</span>
                                    <span className="text-3xl font-black text-brand-500 tracking-tighter italic">₹{total.toFixed(2)}</span>
                                </div>
                            </div>
                            <button
                                className="w-full h-16 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[12px] shadow-lg shadow-slate-200 active:scale-95 transition-all"
                                onClick={() => setStep("payment")}
                                disabled={loading}
                            >
                                {loading ? "Processing..." : "Select Payment Method"}
                            </button>
                        </>
                    )}
                </main>
            )}

            {/* Payment Screen */}
            {step === "payment" && (
                <main className="p-6 animate-in slide-in-from-right duration-500">
                    <div className="flex items-center justify-between mb-8">
                        <button onClick={() => setStep("cart")} className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 text-slate-400">
                            <ChevronLeft size={24} />
                        </button>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight text-center flex-1">Checkout</h2>
                        <div className="w-12" />
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="bg-slate-900 rounded-3xl p-6 text-white text-center shadow-lg shadow-slate-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Amount to Pay</p>
                            <p className="text-4xl font-black tracking-tighter italic">₹{total.toFixed(2)}</p>
                        </div>

                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 px-2 mt-6 mb-2">Payment Method</p>

                        <button
                            onClick={() => setPaymentMethod('online')}
                            className={`w-full p-5 rounded-3xl flex items-center gap-4 transition-all border-2 ${paymentMethod === 'online' ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-100'}`}
                        >
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${paymentMethod === 'online' ? 'bg-emerald-500 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                <Zap size={24} />
                            </div>
                            <div className="text-left flex-1">
                                <h3 className={`font-black text-sm uppercase tracking-tight ${paymentMethod === 'online' ? 'text-emerald-900' : 'text-slate-900'}`}>Pay Online</h3>
                                <p className="text-[10px] font-bold text-slate-400">UPI, Cards, Netbanking</p>
                            </div>
                            {paymentMethod === 'online' && <CheckCircle2 className="text-emerald-500" size={24} />}
                        </button>

                        <button
                            onClick={() => setPaymentMethod('cash')}
                            className={`w-full p-5 rounded-3xl flex items-center gap-4 transition-all border-2 ${paymentMethod === 'cash' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-100'}`}
                        >
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${paymentMethod === 'cash' ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                <Utensils size={24} />
                            </div>
                            <div className="text-left flex-1">
                                <h3 className={`font-black text-sm uppercase tracking-tight ${paymentMethod === 'cash' ? 'text-white' : 'text-slate-900'}`}>Pay at Counter</h3>
                                <p className={`text-[10px] font-bold ${paymentMethod === 'cash' ? 'text-white/50' : 'text-slate-400'}`}>Cash or Card at desk</p>
                            </div>
                            {paymentMethod === 'cash' && <Check size={24} className="text-white" />}
                        </button>
                    </div>

                    <button
                        className="w-full h-16 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[12px] shadow-lg shadow-slate-200 active:scale-95 transition-all"
                        onClick={handleCheckout}
                        disabled={loading}
                    >
                        {loading ? "Processing..." : paymentMethod === 'online' ? "Proceed to Payment" : "Confirm Order"}
                    </button>
                </main>
            )}

            {/* Success Screen */}
            {step === "success" && (
                <main className="p-6 flex flex-col items-center justify-center min-h-[90vh] text-center animate-in zoom-in-95 duration-1000">
                    <div className="h-24 w-24 bg-emerald-500 rounded-3xl flex items-center justify-center text-white shadow-xl mb-8">
                        <Check size={48} strokeWidth={4} />
                    </div>

                    <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-2 italic">Bravo!</h2>
                    <p className="text-slate-400 font-bold mb-10 max-w-[240px] text-xs">
                        {paymentMethod === 'cash'
                            ? "Please pay at the counter. Your order will start once confirmed."
                            : "Your order has been placed. Show this ticket at the counter."}
                    </p>

                    <div className="w-full max-w-[320px] bg-white rounded-3xl border border-slate-100 p-8 shadow-xl relative overflow-hidden">
                        <div className="flex items-center justify-center gap-2 mb-6 opacity-20">
                            <span className="h-0.5 w-6 bg-slate-900 rounded-full" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Dining Pass</span>
                            <span className="h-0.5 w-6 bg-slate-900 rounded-full" />
                        </div>

                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Token Number</p>
                        <div className="text-7xl font-black text-slate-900 leading-none mb-6 tracking-tighter">
                            <span className="text-2xl text-slate-200 mr-1 font-bold">#</span>
                            {tokenNumber ?? '---'}
                        </div>

                        <div className="pt-6 border-t-2 border-dashed border-slate-100 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status</span>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${paymentMethod === 'cash'
                                    ? 'text-amber-600 bg-amber-50'
                                    : 'text-emerald-600 bg-emerald-50'
                                    }`}>
                                    {paymentMethod === 'cash' ? 'Awaiting Payment' : 'Confirmed'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-bold text-slate-300">
                                <span>Ref ID</span>
                                <span className="font-mono">{orderId?.slice(0, 8)}</span>
                            </div>
                        </div>
                    </div>

                    <button
                        className="mt-12 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:text-slate-900 transition-colors"
                        onClick={() => setStep("onboarding_type")}
                    >
                        Place Another Order
                    </button>
                </main>
            )}

            {/* Floating Cart Pill */}
            {cart.length > 0 && step === "menu" && (
                <div className="fixed bottom-6 left-0 right-0 px-6 z-50 animate-in slide-in-from-bottom-10">
                    <button
                        onClick={() => setStep("cart")}
                        className="mx-auto max-w-[320px] bg-slate-900 text-white h-14 rounded-2xl px-6 flex items-center justify-between shadow-2xl active:scale-95 transition-all w-full"
                    >
                        <div className="flex items-center gap-3">
                            <ShoppingBag size={18} className="text-brand-500" />
                            <span className="font-black uppercase tracking-[0.2em] text-[10px]">Basket ({cart.length})</span>
                        </div>
                        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                            <span className="font-black text-lg italic tracking-tighter">₹{total.toFixed(0)}</span>
                            <ArrowRight size={16} />
                        </div>
                    </button>
                </div>
            )}

            {/* SDKs */}
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />
        </div>
    );
}

