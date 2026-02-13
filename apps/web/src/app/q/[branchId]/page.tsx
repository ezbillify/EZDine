"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Script from "next/script";
import {
    Search, Plus, Minus, ShoppingBag, User, Phone,
    Check, ChevronRight, Utensils, Zap, Star, Clock,
    ChevronLeft, ArrowRight, Info, Coffee
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { getPublicBranchMenu, createOrder, CartItem, getPublicBranchDetails, getMenuCategories, checkCustomerExist, createPublicCustomer } from "../../../lib/pos";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { verifyPayment } from "../../../lib/pos";

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
    const [step, setStep] = useState<"onboarding_type" | "onboarding_mobile" | "onboarding_name" | "menu" | "cart" | "payment" | "success">("onboarding_type");

    // Customer & Order Data
    const [orderType, setOrderType] = useState<"dine_in" | "takeaway">(initialTableId ? "dine_in" : "takeaway");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [customerId, setCustomerId] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
    const [orderId, setOrderId] = useState<string | null>(null);
    const [tokenNumber, setTokenNumber] = useState<number | null>(null);

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

            {/* Premium Header - Only show if not success step, or maybe show always for branding */}
            {step !== "onboarding_type" && step !== "onboarding_mobile" && step !== "onboarding_name" && step !== "success" && (
                <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 px-4 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-500/30 transform transition-transform hover:rotate-6">
                                <Utensils size={20} />
                            </div>
                            <div>
                                <h1 className="font-black text-xl tracking-tighter leading-none text-slate-900">
                                    {branchInfo?.restaurant?.name || "EZDine"}
                                </h1>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">
                                    {branchInfo?.name || "Main Branch"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 shadow-sm border ${orderType === 'dine_in' ? 'bg-brand-50 border-brand-100 text-brand-600' : 'bg-slate-900 border-slate-900 text-white'}`}>
                                {orderType === 'dine_in' ? (
                                    <>
                                        <span className="h-2 w-2 rounded-full bg-brand-600 animate-pulse" />
                                        <span className="text-xs font-black uppercase tracking-widest">{initialTableId ? `Table ${initialTableId.split('-')[0]}` : "Dine In"}</span>
                                    </>
                                ) : (
                                    <>
                                        <ShoppingBag size={14} />
                                        <span className="text-xs font-black uppercase tracking-widest">Takeaway</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </header>
            )}

            {/* Onboarding: Step 1 - Order Type */}
            {step === "onboarding_type" && (
                <main className="min-h-screen flex flex-col items-center justify-center p-5 animate-in fade-in zoom-in-95 duration-700">
                    <div className="w-full max-w-[360px] bg-white rounded-[2.5rem] shadow-2xl shadow-brand-100/40 border border-brand-50 p-6 pt-10 relative overflow-hidden text-center">
                        {/* Decorative Background */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-full -mr-12 -mt-12 blur-3xl opacity-40" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-50 rounded-full -ml-12 -mb-12 blur-3xl opacity-40" />

                        <div className="relative z-10 text-center mb-8">
                            <div className="h-16 w-16 bg-brand-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-brand-500/20 mb-5 rotate-3">
                                <Coffee size={28} />
                            </div>
                            <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-600 mb-1.5">Welcome to</h2>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-3">
                                {branchInfo?.restaurant?.name || "EZDine"}
                            </h1>
                            <p className="text-slate-400 font-medium text-[11px] tracking-wide">How would you like to enjoy your meal today?</p>
                        </div>

                        {/* Order Type Selection */}
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <button
                                onClick={() => setOrderType("dine_in")}
                                className={`p-4 rounded-[1.75rem] flex flex-col items-center gap-2.5 transition-all border-2 ${orderType === "dine_in"
                                    ? "bg-brand-50 border-brand-500 shadow-lg shadow-brand-100 scale-102"
                                    : "bg-white border-slate-100 grayscale opacity-60 hover:opacity-100 hover:grayscale-0"
                                    }`}
                            >
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${orderType === "dine_in" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                                    <Utensils size={18} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-900">Dine-In</span>
                            </button>
                            <button
                                onClick={() => setOrderType("takeaway")}
                                className={`p-4 rounded-[1.75rem] flex flex-col items-center gap-2.5 transition-all border-2 ${orderType === "takeaway"
                                    ? "bg-slate-900 border-slate-900 shadow-lg shadow-slate-200 scale-102 text-white"
                                    : "bg-white border-slate-100 grayscale opacity-60 hover:opacity-100 hover:grayscale-0"
                                    }`}
                            >
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${orderType === "takeaway" ? "bg-amber-400 text-slate-900" : "bg-slate-100 text-slate-400"}`}>
                                    <ShoppingBag size={18} />
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest">Takeaway</span>
                            </button>
                        </div>

                        <Button
                            className="w-full h-14 rounded-[1.5rem] bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-brand-600"
                            onClick={() => setStep("onboarding_mobile")}
                        >
                            Continue <ArrowRight size={16} className="ml-2" />
                        </Button>
                    </div>

                    <p className="mt-6 text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em] text-center">
                        Powered by <span className="text-brand-500">EZDine Premium</span>
                    </p>
                </main>
            )}

            {/* Onboarding: Step 2 - Mobile Number */}
            {step === "onboarding_mobile" && (
                <main className="min-h-screen flex flex-col items-center justify-center p-5 animate-in slide-in-from-bottom-10 duration-500">
                    <div className="w-full max-w-[360px] bg-white rounded-[2.5rem] shadow-2xl shadow-brand-100/40 border border-brand-50 p-6 pt-10 relative overflow-hidden">
                        <div className="mb-8 text-center">
                            <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-600 mb-1.5">Verification</h2>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-3">Your Mobile</h1>
                            <p className="text-slate-400 font-medium text-[11px] tracking-wide">Enter your number to view our menu</p>
                        </div>

                        <div className="relative mb-8">
                            <Phone className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${phone ? 'text-brand-600' : 'text-slate-300'}`} size={18} />
                            <input
                                placeholder="Phone Number"
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                className="w-full h-14 pl-12 pr-6 rounded-[1.25rem] bg-slate-50 border-2 border-transparent focus:border-brand-500/20 focus:bg-white transition-all outline-none font-bold text-sm text-slate-900 placeholder:text-slate-300"
                            />
                        </div>

                        <Button
                            className="w-full h-14 rounded-[1.5rem] bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-slate-900/20 disabled:opacity-50"
                            onClick={handleMobileSubmit}
                            disabled={loading || phone.length < 10}
                        >
                            {loading ? "Checking..." : "Verify & Open Menu"} <ArrowRight size={16} className="ml-2" />
                        </Button>

                        <button onClick={() => setStep("onboarding_type")} className="w-full mt-6 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            Go Back
                        </button>
                    </div>
                </main>
            )}

            {/* Onboarding: Step 3 - Name Entry (New Customers Only) */}
            {step === "onboarding_name" && (
                <main className="min-h-screen flex flex-col items-center justify-center p-5 animate-in fade-in duration-500 bg-slate-900/10 backdrop-blur-sm z-50 fixed inset-0">
                    <div className="w-full max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl p-6 pt-10 text-center relative">
                        <div className="h-14 w-14 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 mx-auto mb-5">
                            <User size={24} />
                        </div>
                        <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-brand-600 mb-1.5">New Customer</h2>
                        <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-none mb-3">What's your name?</h1>
                        <p className="text-slate-400 font-medium text-[10px] tracking-wide mb-8">We'd love to know who we're serving today!</p>

                        <div className="relative mb-8">
                            <User className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${name ? 'text-brand-600' : 'text-slate-300'}`} size={18} />
                            <input
                                placeholder="Your Name"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                autoFocus
                                className="w-full h-14 pl-12 pr-6 rounded-[1.25rem] bg-slate-50 border-2 border-transparent focus:border-brand-500/20 focus:bg-white transition-all outline-none font-bold text-sm text-slate-900 placeholder:text-slate-300"
                            />
                        </div>

                        <Button
                            className="w-full h-14 rounded-[1.5rem] bg-brand-600 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-brand-500/20 disabled:opacity-50"
                            onClick={handleNameSubmit}
                            disabled={loading || !name}
                        >
                            {loading ? "Welcome..." : "Start Dining"}
                        </Button>
                    </div>
                </main>
            )}

            {step === "menu" && (
                <main className="animate-in fade-in duration-700 slide-in-from-bottom-2">
                    {/* Search & Categories Bar */}
                    <div className="px-4 pt-4 pb-2 bg-white/40 sticky top-[73px] z-40 backdrop-blur-sm">
                        <div className="relative mb-6">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <Search size={20} />
                            </div>
                            <input
                                placeholder="Craving something specific?"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full h-14 bg-white border-0 shadow-sm ring-1 ring-slate-100 rounded-[1.25rem] pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-brand-500 transition-all outline-none placeholder:text-slate-300"
                            />
                        </div>

                        {/* Category Scroller */}
                        <div
                            ref={categoryRef}
                            className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mask-linear-r"
                        >
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.name)}
                                    className={`whitespace-nowrap px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${activeCategory === cat.name
                                        ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20 scale-105"
                                        : "bg-white text-slate-500 hover:bg-slate-50 ring-1 ring-slate-100"
                                        }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="p-4 flex flex-col gap-4">
                        {filteredItems.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center opacity-50">
                                <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                    <Search size={32} className="text-slate-300" />
                                </div>
                                <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs">No Items Found</h3>
                                <p className="text-xs text-slate-300 mt-1">Try another category or search term</p>
                            </div>
                        ) : (
                            filteredItems.map(item => (
                                <div
                                    key={item.id}
                                    className={`group relative bg-white rounded-[2rem] p-5 flex gap-5 shadow-sm ring-1 ring-slate-100 items-center transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50 hover:ring-brand-100 ${!item.is_available ? 'opacity-60 grayscale bg-slate-50' : ''}`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-white shadow-sm ${item.is_veg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300">
                                                {item.menu_categories?.name || "Kitchen"}
                                            </span>
                                            {!item.is_available && (
                                                <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ml-auto">Sold Out</span>
                                            )}
                                        </div>
                                        <h3 className="font-black text-lg text-slate-900 tracking-tight leading-none mb-2">{item.name}</h3>
                                        <p className="text-[11px] font-medium text-slate-400 line-clamp-2 leading-relaxed mb-4">{item.description}</p>
                                        <div className="flex items-center justify-between">
                                            <p className="font-black text-xl text-slate-900 tracking-tighter">
                                                <span className="text-xs font-bold text-slate-300 mr-0.5">₹</span>
                                                {item.base_price}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => addToCart(item)}
                                        disabled={!item.is_available}
                                        className={`h-14 w-14 rounded-[1.5rem] flex items-center justify-center transition-all active:scale-95 shadow-lg group-hover:scale-105 ${item.is_available
                                            ? 'bg-brand-600 text-white shadow-brand-500/20 hover:bg-slate-900'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                            }`}
                                    >
                                        {item.is_available ? <Plus size={24} strokeWidth={3} /> : <Zap size={20} className="opacity-30" />}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </main>
            )}

            {step === "cart" && (
                <main className="p-4 px-6 animate-in slide-in-from-bottom-8 duration-500">
                    <div className="flex items-center justify-between mb-8">
                        <button onClick={() => setStep("menu")} className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-sm ring-1 ring-slate-100 text-slate-400 hover:text-brand-600 transition-all">
                            <ChevronLeft size={24} />
                        </button>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight text-center flex-1">Your Basket</h2>
                        <div className="w-12" />
                    </div>

                    <div className="space-y-4 mb-8">
                        {cart.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center opacity-50">
                                <div className="h-24 w-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center mb-6">
                                    <ShoppingBag size={40} className="text-slate-300" />
                                </div>
                                <h3 className="font-black text-slate-400 uppercase tracking-widest text-sm">Basket is empty</h3>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.item_id} className="bg-white rounded-[2rem] p-5 flex items-center justify-between gap-4 ring-1 ring-slate-100 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex-1">
                                        <p className="font-black text-slate-900 text-lg leading-none mb-1">{item.name}</p>
                                        <p className="text-xs font-bold text-slate-400">₹{item.price} each</p>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50 rounded-2xl p-1.5 ring-1 ring-slate-200/50">
                                        <button onClick={() => updateQty(item.item_id, -1)} className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400 hover:text-rose-500 active:scale-90 transition-all">
                                            <Minus size={18} strokeWidth={3} />
                                        </button>
                                        <span className="font-black text-base w-6 text-center text-slate-900 font-mono">{item.qty}</span>
                                        <button onClick={() => updateQty(item.item_id, 1)} className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-slate-400 hover:text-brand-600 active:scale-90 transition-all">
                                            <Plus size={18} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {cart.length > 0 && (
                        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-slate-900/30 mb-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-[40%] h-full bg-gradient-to-l from-brand-600/20 to-transparent pointer-events-none" />
                            <div className="relative z-10 space-y-4">
                                <div className="flex justify-between items-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                    <span>Subtotal</span>
                                    <span>₹{total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                    <span>Taxes & Fees</span>
                                    <span className="text-emerald-500">Free</span>
                                </div>
                                <div className="h-px bg-white/10 w-full" />
                                <div className="flex justify-between items-end pt-2">
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Total Payable</span>
                                    <span className="text-4xl font-black text-brand-500 tracking-tighter">
                                        <span className="text-lg font-bold mr-1">₹</span>
                                        {total.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {cart.length > 0 && (
                        <Button
                            className="w-full h-16 rounded-[2rem] bg-brand-600 text-white font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-brand-500/40 active:scale-95 transition-all group"
                            onClick={() => setStep("payment")}
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                            ) : (
                                <>Confirm Order <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" /></>
                            )}
                        </Button>
                    )}
                </main>
            )}

            {step === "success" && (
                <main className="p-8 flex flex-col items-center justify-center min-h-[90vh] text-center animate-in zoom-in-95 duration-1000">
                    <div className="relative mb-12">
                        <div className="absolute inset-0 bg-emerald-500/20 rounded-[3rem] animate-ping duration-[3s]" />
                        <div className="relative h-32 w-32 bg-emerald-500 rounded-[3rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40">
                            <Check size={64} strokeWidth={4} className="animate-in fade-in zoom-in duration-500 delay-500" />
                        </div>
                        <div className="absolute -top-4 -right-4 h-12 w-12 bg-amber-400 rounded-2xl flex items-center justify-center text-amber-900 shadow-xl border-4 border-white rotate-12">
                            <Star size={24} fill="currentColor" />
                        </div>
                    </div>

                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none mb-3 italic">Awesome!</h2>
                    <p className="text-slate-500 font-bold mb-12 max-w-[240px]">We've received your order. Please show this token at the counter.</p>

                    <div className="w-full max-w-sm relative">
                        {/* Decorative side cutouts */}
                        <div className="absolute left-[-15px] top-1/2 -translate-y-1/2 h-8 w-8 bg-[#FDFDFF] rounded-full z-10 shadow-inner" />
                        <div className="absolute right-[-15px] top-1/2 -translate-y-1/2 h-8 w-8 bg-[#FDFDFF] rounded-full z-10 shadow-inner" />

                        <div className="bg-white rounded-[3rem] border border-slate-100 p-10 shadow-2xl shadow-slate-200/50 overflow-hidden">
                            <div className="flex items-center justify-center gap-2 mb-8">
                                <span className="h-1 w-12 bg-slate-100 rounded-full" />
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">Your Ticket</span>
                                <span className="h-1 w-12 bg-slate-100 rounded-full" />
                            </div>

                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-600 mb-2">Token Number</p>
                            <div className="text-[100px] font-black text-slate-900 leading-none mb-4 tracking-tighter flex items-center justify-center gap-2">
                                <span className="text-3xl text-slate-200 mt-6 -mr-4">#</span>
                                {tokenNumber ?? '---'}
                            </div>

                            <div className="pt-8 mt-4 border-t-2 border-dashed border-slate-100 space-y-4">
                                <div className="flex justify-between items-center group">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Clock size={12} className="group-hover:text-amber-500 transition-colors" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status</span>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1 rounded-full ring-1 ring-amber-100">Preparing</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Info size={12} className="group-hover:text-brand-500 transition-colors" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Order Ref</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 font-mono tracking-wider">{orderId?.slice(0, 8).toUpperCase()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <p className="mt-12 text-[10px] font-black uppercase tracking-widest text-slate-300">Thank you for dining with us!</p>

                    <Button
                        variant="ghost"
                        className="mt-6 text-brand-600 font-black uppercase tracking-[0.2em] text-[10px] hover:bg-brand-50 rounded-full px-8 py-4 transition-all"
                        onClick={() => setStep("onboarding_type")}
                    >
                        Order More Items
                    </Button>
                </main>
            )}

            {/* Floating Cart Pill - Minimal & Sexy */}
            {cart.length > 0 && step === "menu" && (
                <div className="fixed bottom-8 left-0 right-0 z-50 px-6 animate-in slide-in-from-bottom-10 duration-700">
                    <button
                        onClick={() => setStep("cart")}
                        className="mx-auto max-w-[320px] bg-slate-900 text-white h-16 rounded-[2rem] px-8 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.3)] active:scale-95 transition-all transform hover:translate-y-[-4px] ring-4 ring-white"
                    >
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <ShoppingBag size={20} className="text-brand-500" />
                                <div className="absolute -top-2 -right-2 h-5 w-5 bg-brand-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 animate-bounce">
                                    {cart.length}
                                </div>
                            </div>
                            <span className="font-black uppercase tracking-[0.1em] text-[11px]">View Order</span>
                        </div>
                        <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                            <span className="text-xs font-bold text-slate-400 mr-1">₹</span>
                            <span className="font-black text-lg tracking-tighter">{total.toFixed(0)}</span>
                            <ChevronRight size={18} className="text-slate-500" />
                        </div>
                    </button>
                </div>
            )}
            {/* Razorpay SDK */}
            <Script src="https://checkout.razorpay.com/v1/checkout.js" />
        </div>
    );
}

