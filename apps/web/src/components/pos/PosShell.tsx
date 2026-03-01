"use client";

import { AlertCircle, CheckCircle2, Save, Trash2, User, Search, Plus, Phone, X, UserPlus, ArrowRight, Check, Eye, Zap, History, Utensils, ShoppingBag, Printer, Leaf, Flame, Egg } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";

import {
  CartItem,
  addPayment,
  appendOrderItems,
  closeOrder,
  createBill,
  createOrder,
  getMenuItems,
  getOpenOrderForTable,
  getOrderItems,
  getPendingQrOrders,
  getSettledBills,
  getTables,
  toggleItemAvailability
} from "../../lib/pos";
import { buildInvoiceLines, buildKotLines, buildTokenSlipLines, buildConsolidatedReceiptLines, getPrintingSettings, sendPrintJob, PrintLine } from "../../lib/printing";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { supabase } from "../../lib/supabaseClient";
import { getCurrentUserProfile } from "../../lib/tenant";
import { PrintPreviewModal } from "../printing/PrintPreviewModal";
import { PaymentModal } from "./PaymentModal";

type MenuItem = {
  id: string;
  name: string;
  base_price: number;
  gst_rate?: number;
  is_available: boolean;
  is_veg: boolean;
  is_egg: boolean;
  category_id?: string;
};

type OrderItem = {
  id: string;
  item_id: string;
  name: string;
  quantity: number;
  price: number;
  gst_rate?: number;
  status: string;
};

export function PosShell() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<{ id: string; name: string }[]>([]);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrderNumber, setActiveOrderNumber] = useState<string | null>(null);
  const [activeTokenNumber, setActiveTokenNumber] = useState<number | null>(null);
  const [activeBillNumber, setActiveBillNumber] = useState<string | null>(null);
  const [isQuickBill, setIsQuickBill] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "paid">("pending");
  const [liveOrders, setLiveOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "price_asc" | "price_desc">("name");

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [isOrderSettled, setIsOrderSettled] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [bypassKitchen, setBypassKitchen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");

  // Print Preview State
  const [previewData, setPreviewData] = useState<{
    isOpen: boolean;
    title: string;
    lines: PrintLine[];
    width: 58 | 80;
  }>({
    isOpen: false,
    title: "",
    lines: [],
    width: 80
  });

  // State split: Existing items (from DB) vs New items (local cart)
  const [existingItems, setExistingItems] = useState<OrderItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [status, setStatus] = useState<"idle" | "saving">("idle");

  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const playBuzzer = () => {
    try {
      const AudioCtxClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioCtxClass) return;

      const audioCtx = new AudioCtxClass();

      const playPulse = (delay: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime + delay);

        gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + delay + 0.05);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + delay + 0.3);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime + delay);
        osc.stop(audioCtx.currentTime + delay + 0.3);
      };

      if (audioCtx.state === 'suspended') audioCtx.resume();

      playPulse(0);
      playPulse(0.4);
      playPulse(0.8);
    } catch (e) {
      console.error("Audio buzzer failed", e);
    }
  };

  // Load initial data
  useEffect(() => {
    const load = async () => {
      try {
        const [items, tableData] = await Promise.all([getMenuItems(), getTables()]);
        setMenuItems(items as MenuItem[]);
        setTables(tableData as any);

        // Also load categories for the current branch
        const profile = await getCurrentUserProfile();
        if (profile?.active_branch_id) {
          const { data: branch } = await supabase.from("branches").select("restaurant_id").eq("id", profile.active_branch_id).single();
          if (branch) {
            const { data: cats } = await supabase.from("menu_categories").select("id, name").eq("restaurant_id", branch.restaurant_id).order("name");
            setCategories(cats ?? []);
          }
        }
      } catch (err) {
        toast.error("Failed to load menu or tables");
      }
    };
    load();

    // Auto-refresh live orders every 10s to clear expired paid tokens
    const interval = setInterval(() => {
      if (activeTab === "live") fetchLiveOrders();
    }, 10000);

    // Listen for Realtime Order Updates
    const channel = supabase
      .channel("pos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async (payload) => {
          const newOrder = payload.new as any;
          const eventType = payload.eventType;

          fetchLiveOrders();
          if (activeTableId && newOrder && newOrder.table_id === activeTableId) {
            setLastUpdated(Date.now());
          }

          if (activeOrderId && newOrder && newOrder.id === activeOrderId) {
            setPaymentStatus(newOrder.payment_status);
            // If it becomes paid, refresh live list to ensure timers are fresh
            if (newOrder.payment_status === 'paid') fetchLiveOrders();
          }
          if (eventType === 'INSERT' || (eventType === 'UPDATE' && newOrder.payment_status === 'paid')) {
            playBuzzer();
            toast.success("New Order / Payment Update", {
              description: `Order #${newOrder.order_number} Updated`,
              action: { label: "Refresh", onClick: () => fetchLiveOrders() }
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items" },
        (payload) => {
          // If items change, we definitely need to refresh active table if it matches
          // For QR orders list, usually total amount or item count might show, so safe to refresh.
          fetchLiveOrders();
          // We don't have table_id in order_items payload usually, so we might just force refresh active table
          // to be safe, or we could fetch the order to check table_id. 
          // For simplicity/performance balance: just trigger refresh. 
          // The loadTableOrder hook is cheap enough.
          setLastUpdated(Date.now());
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MenuItem;
            setMenuItems((prev) =>
              prev.map((item) => item.id === updated.id ? { ...item, ...updated } : item)
            );
          } else {
            // For INSERT/DELETE or complex changes, refetch
            getMenuItems().then(items => setMenuItems(items as MenuItem[]));
          }
        }
      )
      .subscribe((status) => {
        console.log("POS Realtime Status:", status);
        if (status === 'SUBSCRIBED') {
          toast.success("Connected to Live Updates");
        }
        if (status === 'CHANNEL_ERROR') {
          toast.error("Live Updates Error");
        }
      });

    fetchLiveOrders();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [activeTableId]); // Add activeTableId dependency to listener? No, listener should be stable.
  // We need to handle activeTableId refresh carefully. 



  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await getSettledBills();
      setHistory(data);
    } catch (err) {
      toast.error("Failed to load order history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchLiveOrders = async () => {
    try {
      const orders = await getPendingQrOrders();
      setLiveOrders(orders);
    } catch (err) {
      console.error("Failed to fetch QR orders", err);
    }
  };

  const loadQrOrder = async (order: any) => {
    try {
      setIsOrderSettled(false);
      setActiveTableId(order.table_id);
      setIsQuickBill(!order.table_id);
      setActiveOrderId(order.id);
      setActiveOrderNumber(order.order_number);
      setActiveTokenNumber(order.token_number);
      setSelectedCustomerId(order.customer_id);
      setSelectedCustomerName(order.customer?.name || null);
      setOrderType(order.order_type || "takeaway");
      setPaymentStatus(order.payment_status || "pending");

      const items = await getOrderItems(order.id);
      const mappedItems: OrderItem[] = items.map((i) => ({
        id: i.id,
        item_id: i.item_id,
        name: menuItems.find((m) => m.id === i.item_id)?.name ?? "Unknown Item",
        quantity: i.quantity,
        price: i.price,
        gst_rate: menuItems.find((m) => m.id === i.item_id)?.gst_rate ?? 0,
        status: i.status
      }));
      setExistingItems(mappedItems);
      setCart([]); // Clear local cart as we are loading existing order
      toast.info(`Loaded QR Order - Token ${order.token_number}`);
    } catch (err) {
      toast.error("Failed to load QR order details");
    }
  };

  const loadSettledBill = async (bill: any) => {
    try {
      if (!bill.order_id) return;

      const orderData = bill.order; // Joined data from getSettledBills

      // Determine if it was table or quick bill based on bill details or fetch order details if needed.
      // For simplicity, we treat settled bills essentially as Quick Bills visually unless table info is needed.
      // But let's try to be accurate if possible. 
      // Since getSettledBills doesn't join table_id yet, we might need to fetch order details.

      // Actually, let's fetch full order details to be safe
      const orderItems = await getOrderItems(bill.order_id);

      // Map items
      const mappedItems: OrderItem[] = orderItems.map((i) => ({
        id: i.id,
        item_id: i.item_id,
        name: menuItems.find((m) => m.id === i.item_id)?.name ?? "Unknown Item",
        quantity: i.quantity,
        price: i.price,
        gst_rate: menuItems.find((m) => m.id === i.item_id)?.gst_rate ?? 0,
        status: i.status
      }));

      setCart([]);
      setExistingItems(mappedItems);
      setActiveOrderId(bill.order_id);
      setActiveOrderNumber(orderData?.order_number);
      setActiveTokenNumber(orderData?.token_number);
      setActiveBillNumber(bill.bill_number);
      setSelectedCustomerName(orderData?.customer?.name || "Guest");

      // IMPORTANT: Set Read-Only Mode
      setIsOrderSettled(true);

      // Optional: Reset table selection to avoid confusion?
      setActiveTableId(null);
      setIsQuickBill(true); // Visually detached from tables

      toast.info(`Loaded Settled Bill #${bill.order?.order_number}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load bill details");
    }
  };

  const handleToggleStock = async (item: MenuItem) => {
    try {
      const nextStatus = !item.is_available;
      await toggleItemAvailability(item.id, nextStatus);
      setMenuItems(prev => prev.map(m => m.id === item.id ? { ...m, is_available: nextStatus } : m));
      toast.success(`${item.name} marked ${nextStatus ? 'Available' : 'Out of Stock'}`);
    } catch (err) {
      toast.error("Failed to update stock status");
    }
  };

  // Restore cart from cache when switching tables
  useEffect(() => {
    if (!activeTableId && !isQuickBill) {
      setCart([]);
      return;
    }
    const cacheKey = isQuickBill ? 'ezdine_cart_quick' : `ezdine_cart_${activeTableId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setCart(JSON.parse(cached));
      } catch {
        setCart([]);
      }
    } else {
      setCart([]);
    }
  }, [activeTableId, isQuickBill]);

  // Persist cart to cache on change
  useEffect(() => {
    if (activeTableId || isQuickBill) {
      const cacheKey = isQuickBill ? 'ezdine_cart_quick' : `ezdine_cart_${activeTableId}`;
      localStorage.setItem(cacheKey, JSON.stringify(cart));
    }
  }, [cart, activeTableId, isQuickBill]);

  // Load existing order for table
  useEffect(() => {
    const loadTableOrder = async () => {
      if (!activeTableId) {
        if (!isQuickBill) {
          setExistingItems([]);
          setActiveOrderId(null);
          setActiveOrderNumber(null);
          setSelectedCustomerId(null);
          setSelectedCustomerName(null);
        }
        return;
      }
      try {
        setIsOrderSettled(false);
        setIsQuickBill(false); // If table selected, it's not a quick bill
        const order = await getOpenOrderForTable(activeTableId);
        if (order) {
          setActiveOrderId(order.id);
          setActiveOrderNumber(order.order_number);
          setActiveTokenNumber(order.token_number);
          setSelectedCustomerId(order.customer_id);
          setSelectedCustomerName((order as any).customer?.name || null);
          setOrderType(order.order_type || "dine_in");
          setPaymentStatus((order as any).payment_status || "pending");
          const items = await getOrderItems(order.id);
          const mappedItems: OrderItem[] = items.map((i) => ({
            id: i.id,
            item_id: i.item_id,
            name: menuItems.find((m) => m.id === i.item_id)?.name ?? "Unknown Item",
            quantity: i.quantity,
            price: i.price,
            gst_rate: menuItems.find((m) => m.id === i.item_id)?.gst_rate ?? 0,
            status: i.status
          }));
          setExistingItems(mappedItems);
        } else {
          setActiveOrderId(null);
          setActiveOrderNumber(null);
          setActiveTokenNumber(null);
          setExistingItems([]);
          setSelectedCustomerId(null);
          setSelectedCustomerName(null);
          setPaymentStatus("pending");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load table order");
      }
    };
    loadTableOrder();
  }, [activeTableId, menuItems, status, lastUpdated]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * item.price, 0),
    [cart]
  );

  const existingTotal = useMemo(
    () => existingItems.reduce((sum, item) => sum + item.quantity * item.price, 0),
    [existingItems]
  );

  // Customer Management
  const handleCustomerLookup = async () => {
    if (customerSearch.length < 10) return;
    const profile = await getCurrentUserProfile();
    if (!profile) return;

    const cleanPhone = customerSearch.trim().replace(/\s/g, '');

    // Search by restaurant (and optionally prioritize branch if needed, but phone is unique per restaurant)
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone")
      .eq("restaurant_id", profile.active_restaurant_id)
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (data) {
      setSelectedCustomerId(data.id);
      setSelectedCustomerName(data.name);
      setCustomerSearch("");
      toast.success(`Customer linked: ${data.name}`);
    } else {
      setNewCustPhone(cleanPhone);
      setNewCustName("");
      setShowCustomerModal(true);
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustName || !newCustPhone) return;
    const profile = await getCurrentUserProfile();
    if (!profile) return;

    // Use active_branch_id if available to scope customer to branch
    const branchId = profile.active_branch_id || (activeTableId ? tables.find(t => t.id === activeTableId)?.id : null); // Table doesn't allow easy branch lookup from here without extra query/data, so stick to profile active branch

    const { data, error } = await supabase
      .from("customers")
      .upsert({
        restaurant_id: profile.active_restaurant_id,
        name: newCustName,
        phone: newCustPhone
      }, { onConflict: 'restaurant_id,phone' })
      .select()
      .single();

    if (data && !error) {
      setSelectedCustomerId(data.id);
      setSelectedCustomerName(data.name);
      setShowCustomerModal(false);
      toast.success("New customer created and linked");
    } else {
      toast.error("Failed to add customer");
    }
  };

  const addItem = (item: MenuItem) => {
    if (!activeTableId && !isQuickBill) {
      toast.error("Select a table or Quick Bill first");
      return;
    }

    if (!item.is_available) {
      toast.error(`${item.name} is currently Out of Stock!`);
      return;
    }

    // Enforce Customer Selection ONLY for Table Orders (Quick Bill is optional)
    if (!selectedCustomerId && !isQuickBill) {
      toast.warning("Please select a customer first!");
      const input = document.getElementById('customer-search-input');
      if (input) input.focus();
      return;
    }

    setCart((prev) => {
      const existing = prev.find((c) => c.item_id === item.id);
      if (existing) {
        return prev.map((c) => (c.item_id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { item_id: item.id, name: item.name, qty: 1, price: item.base_price, gst_rate: item.gst_rate }];
    });
  };

  const updateQty = (itemId: string, qty: number) => {
    setCart((prev) => prev.map((c) => (c.item_id === itemId ? { ...c, qty } : c)));
  };

  const removeItem = (itemId: string) => {
    setCart((prev) => prev.filter((c) => c.item_id !== itemId));
  };

  const handlePlaceOrder = async () => {
    if (!activeTableId && !isQuickBill) {
      toast.error("Select a table or Quick Bill first");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setStatus("saving");
    try {
      let orderId = activeOrderId;
      let orderNumber = activeOrderNumber;

      if (!orderId) {
        const order = await createOrder(activeTableId, cart, undefined, selectedCustomerId, 'pos', 'pending', undefined, undefined, 'cash', orderType);
        orderId = order.id;
        orderNumber = order.order_number;
        setActiveOrderId(orderId);
        setActiveOrderNumber(orderNumber);
        setActiveTokenNumber(order.token_number);
      } else {
        await appendOrderItems(orderId, cart);
      }

      // Printing Logic
      try {
        const settings = await getPrintingSettings();
        if (settings) {
          const kotLines = buildKotLines({
            restaurantName: "EZDine",
            branchName: "Branch",
            tableName: isQuickBill ? "QUICK BILL" : (tables.find((t) => t.id === activeTableId)?.name ?? "--"),
            orderId: orderNumber ?? "--",
            tokenNumber: activeTokenNumber?.toString(),
            items: cart.map((c) => ({ name: c.name, qty: c.qty }))
          });
          await sendPrintJob({
            printerId: settings.printerIdKot ?? "kitchen-1",
            width: settings.widthKot ?? 58,
            type: "kot",
            lines: kotLines
          });
        }
      } catch (printErr: any) {
        console.error("Printing failed", printErr);
        toast.error("Order saved, but printing failed: " + printErr.message);
      }

      const cacheKey = isQuickBill ? 'ezdine_cart_quick' : `ezdine_cart_${activeTableId}`;
      setCart([]);
      localStorage.removeItem(cacheKey);
      toast.success("Order placed successfully");
    } catch (err: any) {
      setStatus("idle");
    }
  };

  const handlePaymentConfirm = async (payments: { method: string, amount: number }[]) => {
    setShowPaymentModal(false);
    setStatus("saving");

    try {
      let orderId = activeOrderId;
      let orderNumber = activeOrderNumber;
      let tokenNumber = activeTokenNumber;

      const primaryMethod = payments[0]?.method ?? 'cash';

      // 1. Create or Update Order
      if (!orderId) {
        // New Order
        const order = await createOrder(
          activeTableId,
          cart,
          undefined,
          selectedCustomerId,
          'pos',
          'paid',
          undefined,
          undefined,
          primaryMethod as any,
          orderType
        );
        orderId = order.id;
        orderNumber = order.order_number;
        tokenNumber = order.token_number;
      } else {
        // Existing Order - Append items if any
        if (cart.length > 0) {
          await appendOrderItems(orderId, cart);
        }
      }

      const settings = await getPrintingSettings();
      // 2. Print KOT (Only if new items exist AND not bypassing kitchen)
      if (cart.length > 0 && !bypassKitchen && settings) {
        try {
          const kotLines = buildKotLines({
            restaurantName: "EZDine",
            branchName: "Branch", // Ideally fetch this
            tableName: isQuickBill ? "QUICK BILL" : (tables.find((t) => t.id === activeTableId)?.name ?? "--"),
            orderId: orderNumber ?? "--",
            tokenNumber: tokenNumber?.toString(),
            items: cart.map((c) => ({ name: c.name, qty: c.qty, note: c.notes }))
          });

          await sendPrintJob({
            printerId: settings.printerIdKot ?? "kitchen-1",
            width: settings.widthKot ?? 58,
            type: "kot",
            lines: kotLines
          });
        } catch (printErr: any) {
          console.error("KOT Print failed", printErr);
          toast.error("KOT printing failed: " + printErr.message);
        }
      }

      // 3. Create Bill & Payment
      const fullItems = [
        ...existingItems.map(i => ({ item_id: i.item_id, name: i.name, qty: i.quantity, price: i.price })),
        ...cart
      ];

      const totalAmount = fullItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

      const bill = await createBill(orderId!, fullItems as any);

      // Add all payments
      for (const p of payments) {
        await addPayment(bill.id, p.method, p.amount);
      }

      // 3. Mark as Paid & Pending (Critical for KDS)
      // We need to fetch the current status first to avoid resetting 'preparing' orders back to 'pending'.
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId!)
        .single();

      const newStatus = (currentOrder?.status === 'counter_pending') ? 'pending' : currentOrder?.status;

      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: newStatus, // Only force pending if it was hidden (counter_pending)
          payment_method: primaryMethod
        })
        .eq('id', orderId!);

      // 4. Print Bill & Token
      try {
        if (settings) {
          const consolidate = (settings as any).consolidatedPrinting === true;

          if (consolidate) {
            const consolidatedLines = buildConsolidatedReceiptLines({
              restaurantName: "EZDine",
              branchName: "Branch",
              tableName: isQuickBill ? "QUICK BILL" : (tables.find((t) => t.id === activeTableId)?.name ?? "--"),
              orderId: `${orderNumber}`, // using order number for display
              tokenNumber: tokenNumber?.toString(),
              orderType: isQuickBill ? "Takeaway" : "Dine In",
              items: fullItems.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
              subtotal: totalAmount,
              tax: 0,
              total: totalAmount
            });

            await sendPrintJob({
              printerId: settings.printerIdInvoice ?? "billing-1",
              width: settings.widthInvoice ?? 80,
              type: "invoice",
              lines: consolidatedLines
            });
          } else {
            // Bill
            const billLines = buildInvoiceLines({
              restaurantName: "EZDine",
              branchName: "Branch",
              billId: `${orderNumber}`, // Usually bill number is different but using order for now
              tokenNumber: tokenNumber,
              items: fullItems.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
              subtotal: totalAmount,
              tax: 0,
              total: totalAmount
            });

            await sendPrintJob({
              printerId: settings.printerIdInvoice ?? "billing-1",
              width: settings.widthInvoice ?? 80,
              type: "invoice",
              lines: billLines
            });

            // Separate Token Slip (To same printer as invoice usually, but stripped down)
            if (tokenNumber) {
              const tokenLines = buildTokenSlipLines({
                restaurantName: "EZDine",
                tokenNumber: tokenNumber,
                orderType: isQuickBill ? "Takeaway" : "Dine In",
                itemsCount: fullItems.reduce((acc, i) => acc + i.qty, 0)
              });

              await sendPrintJob({
                printerId: settings.printerIdInvoice ?? "billing-1", // Same printer as invoice for token slip usually
                width: settings.widthInvoice ?? 80,
                type: "token",
                lines: tokenLines
              });
            }
          }
        }
      } catch (printErr: any) {
        console.error("Bill Print failed", printErr);
        toast.error("Bill printing failed: " + printErr.message);
      }

      // 5. Reset
      const cacheKey = isQuickBill ? 'ezdine_cart_quick' : `ezdine_cart_${activeTableId}`;
      setCart([]);
      localStorage.removeItem(cacheKey);
      setActiveOrderId(null);
      setActiveOrderNumber(null);
      setActiveTokenNumber(null);
      setSelectedCustomerId(null);
      setSelectedCustomerName(null);
      setBypassKitchen(false);
      if (isQuickBill) setIsQuickBill(false); // Reset Quick Bill state

      // Refresh History & QR List
      const data = await getSettledBills();
      setHistory(data);
      fetchLiveOrders();
      toast.success("Order Settled & Paid!");
    } catch (err: any) {
      toast.error(err.message || "Failed to process payment");
    } finally {
      setStatus("idle");
    }
  };

  const handleCancelOrder = async () => {
    if (!activeOrderId) return;
    if (!confirm("Are you sure you want to CANCEL this order?")) return;

    setStatus("saving");
    try {
      await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', activeOrderId);

      // Reset
      const cacheKey = isQuickBill ? 'ezdine_cart_quick' : `ezdine_cart_${activeTableId}`;
      setCart([]);
      localStorage.removeItem(cacheKey);
      setActiveOrderId(null);
      setActiveOrderNumber(null);
      setActiveTokenNumber(null);
      setActiveBillNumber(null);
      setExistingItems([]);
      setSelectedCustomerId(null);
      setSelectedCustomerName(null);
      if (isQuickBill) setIsQuickBill(false);

      fetchLiveOrders();
      toast.success("Order Cancelled");
    } catch (err: any) {
      toast.error("Failed to cancel order");
    } finally {
      setStatus("idle");
    }
  };

  const handlePreviewBill = async () => {
    if (!activeOrderId && cart.length === 0) return;

    // Combine existing and cart items for preview
    const billable = [
      ...existingItems.map(i => ({ name: i.name, qty: i.quantity, price: i.price, gst_rate: i.gst_rate ?? 0 })),
      ...cart.map(c => ({ name: c.name, qty: c.qty, price: c.price, gst_rate: c.gst_rate ?? 0 }))
    ];

    if (billable.length === 0) return;

    const total = billable.reduce((sum, i) => sum + i.qty * i.price, 0);
    // Calculate tax breakdown (assuming inclusive prices)
    const tax = billable.reduce((sum, i) => {
      const lineTotal = i.qty * i.price;
      const t = lineTotal - (lineTotal / (1 + (i.gst_rate / 100)));
      return sum + t;
    }, 0);
    const subtotal = total - tax;

    const lines = buildInvoiceLines({
      restaurantName: "EZDine",
      branchName: isQuickBill ? "Walk-in" : (tables.find(t => t.id === activeTableId)?.name ?? "Branch"),
      billId: "PREVIEW",
      tokenNumber: activeTokenNumber,
      items: billable,
      subtotal: subtotal,
      tax: tax,
      total: total
    });

    setPreviewData({
      isOpen: true,
      title: "Bill Preview",
      lines,
      width: 80
    });
  };

  const handleCreateBill = async () => {
    if (!activeOrderId && !isQuickBill) {
      toast.error("No active order or quick bill");
      return;
    }

    setStatus("saving");
    try {
      let currentOrderId = activeOrderId;

      // For Quick Bill, create order on the fly if it hasn't been saved yet
      if (isQuickBill && !currentOrderId) {
        if (cart.length === 0) {
          toast.error("Cart is empty");
          setStatus("idle");
          return;
        }
        const order = await createOrder(null, cart, undefined, selectedCustomerId || null, 'pos', 'pending', undefined, undefined, 'cash', orderType);
        currentOrderId = order.id;
        // Print KOT for Quick Bill too if needed? Usually yes.
        try {
          const settings = await getPrintingSettings();
          if (settings) {
            const kotLines = buildKotLines({
              restaurantName: "EZDine",
              branchName: "Branch",
              tableName: "QUICK BILL",
              orderId: order.order_number,
              items: cart.map((c) => ({ name: c.name, qty: c.qty }))
            });
            await sendPrintJob({
              printerId: settings.printerIdKot ?? "kitchen-1",
              width: settings.widthKot ?? 58,
              type: "kot",
              lines: kotLines
            });
          }
        } catch (e) { console.error("KOT print failed", e); }
      }

      const billable = [...existingItems];
      if (isQuickBill && activeOrderId) {
        // If it was a saved quick bill, items are already in existingItems
      } else if (isQuickBill && !activeOrderId) {
        // If it's a fresh quick bill, billable items are from the cart
        cart.forEach(c => billable.push({
          id: '', // Not needed for mapping to billItems
          item_id: c.item_id,
          name: c.name,
          quantity: c.qty,
          price: c.price,
          status: 'pending'
        }));
      }

      if (billable.length === 0) {
        toast.error("No items to bill");
        setStatus("idle");
        return;
      }

      const billItems: CartItem[] = billable.map((i) => ({
        item_id: i.item_id,
        name: i.name,
        qty: i.quantity,
        price: i.price
      }));

      // For table orders, show payment modal instead of auto-settling with cash
      if (!isQuickBill) {
        setBypassKitchen(true);
        setShowPaymentModal(true);
        setStatus("idle");
        return;
      }

      const bill = await createBill(currentOrderId!, billItems);
      const billTotal = billItems.reduce((sum, i) => sum + i.qty * i.price, 0);

      // Only add cash payment if there isn't already a payment linked to this order
      // We check if currentOrder exists and is already paid to avoid duplicate revenue
      const { data: existingOrder } = await supabase.from('orders').select('payment_status').eq('id', currentOrderId!).single();
      if (existingOrder?.payment_status !== 'paid') {
        await addPayment(bill.id, "cash", billTotal);
        await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', currentOrderId!);
      }

      try {
        const settings = await getPrintingSettings();
        if (settings) {
          const invoiceLines = buildInvoiceLines({
            restaurantName: "EZDine",
            branchName: isQuickBill ? "Direct" : "Branch",
            billId: bill.bill_number,
            tokenNumber: activeTokenNumber,
            items: billItems.map((c) => ({ name: c.name, qty: c.qty, price: c.price })),
            subtotal: billTotal,
            tax: 0,
            total: billTotal
          });
          await sendPrintJob({
            printerId: settings.printerIdInvoice ?? "billing-1",
            width: settings.widthInvoice ?? 80,
            type: "invoice",
            lines: invoiceLines
          });
        }
      } catch (printErr: any) {
        console.error("Printing failed", printErr);
        toast.error("Bill created, but printing failed");
      }

      await closeOrder(currentOrderId!);

      const cacheKey = isQuickBill ? 'ezdine_cart_quick' : `ezdine_cart_${activeTableId}`;
      localStorage.removeItem(cacheKey);

      setActiveOrderId(null);
      setActiveOrderNumber(null);
      setActiveTokenNumber(null);
      setActiveBillNumber(null);
      setExistingItems([]);
      setCart([]);
      setSelectedCustomerId(null);
      setSelectedCustomerName(null);
      if (isQuickBill) setIsQuickBill(false);

      fetchLiveOrders();
      toast.success("Bill created and settled!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create bill");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden">
      <Toaster position="bottom-center" richColors />

      {/* Mobile-inspired Layout: Sidebar + Main Area */}
      
      {/* 1. Compact Sidebar - Mobile Design Inspired */}
      <section className="flex w-72 flex-none flex-col bg-white border-r border-slate-200 shadow-lg">
        {/* Header */}
        <div className="border-b border-slate-100 bg-slate-50 p-4">
          <h2 className="text-lg font-black text-slate-900 mb-2">POS TERMINAL</h2>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab("live")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'live' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Live Orders
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              History
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'live' ? (
            <div className="space-y-4">
              {/* Quick Bill Button - Mobile Style */}
              <button
                onClick={() => {
                  setIsOrderSettled(false);
                  setActiveTableId(null);
                  setIsQuickBill(true);
                  setExistingItems([]);
                  setActiveOrderId(null);
                  setActiveOrderNumber(null);
                  setActiveTokenNumber(null);
                }}
                className={`w-full p-4 rounded-2xl border-2 transition-all ${isQuickBill && !activeTableId
                  ? "border-blue-500 bg-blue-50 shadow-lg"
                  : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-md"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isQuickBill && !activeTableId ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                    <Zap size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-900">Quick Bill</h3>
                    <p className="text-sm text-slate-500">Walk-in / Direct</p>
                  </div>
                  {isQuickBill && !activeTableId && <CheckCircle2 size={20} className="text-blue-500 ml-auto" />}
                </div>
              </button>

              {/* Live Orders Grid - Mobile Style */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-700">Live Orders</h3>
                  <span className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {liveOrders.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {liveOrders.map((order) => {
                    const isPaid = order.payment_status === 'paid';
                    const isActive = activeOrderId === order.id;
                    
                    return (
                      <button
                        key={order.id}
                        onClick={() => loadQrOrder(order)}
                        className={`relative p-4 rounded-2xl border-2 transition-all ${isActive 
                          ? "border-green-500 bg-green-50 shadow-lg" 
                          : isPaid 
                            ? "border-green-200 bg-green-50/50 hover:bg-green-50" 
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                          }`}
                      >
                        {/* Status Indicator */}
                        <div className="absolute top-2 right-2">
                          <div className={`w-3 h-3 rounded-full ${isPaid ? 'bg-green-500' : 'bg-orange-500'} animate-pulse`}></div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-2xl font-black text-slate-900 mb-1">
                            {order.token_number}
                          </div>
                          <div className={`text-xs font-bold px-2 py-1 rounded-lg ${isPaid 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-orange-100 text-orange-700'
                          }`}>
                            {isPaid ? 'PAID' : 'PENDING'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tables Section - Mobile Style */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3">Tables</h3>
                <div className="grid grid-cols-1 gap-2">
                  {tables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => setActiveTableId(table.id)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${activeTableId === table.id
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{table.name}</span>
                        {activeTableId === table.id && <CheckCircle2 size={16} className="text-blue-500" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* History Section */
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="flex justify-center p-8">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center p-8 text-slate-400">
                  <History size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-medium">No settled bills</p>
                </div>
              ) : (
                history.map((bill) => (
                  <div
                    key={bill.id}
                    onClick={() => loadSettledBill(bill)}
                    className="p-4 bg-white rounded-2xl border border-slate-200 hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">
                          {bill.order?.token_number || "-"}
                        </span>
                        <span className="font-bold text-slate-900">#{bill.order?.order_number}</span>
                      </div>
                      <span className="font-bold text-green-600">₹{bill.total}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{bill.order?.customer?.name || "Guest"}</span>
                      <span className="text-slate-400">{new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* 2. Main Content Area - Mobile Inspired */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {/* Top Bar - Mobile Style */}
        <div className="bg-white border-b border-slate-200 p-4">
          {/* Current Order Info */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  {isQuickBill && !activeTableId ? "Quick Bill" : (tables.find((t) => t.id === activeTableId)?.name ?? "Select Table")}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {activeOrderNumber && (
                    <span className="text-sm text-slate-500">Order #{activeOrderNumber}</span>
                  )}
                  {activeTokenNumber && (
                    <span className="bg-blue-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                      Token {activeTokenNumber}
                    </span>
                  )}
                  {paymentStatus === 'paid' && (
                    <span className="bg-green-100 text-green-700 text-sm font-bold px-3 py-1 rounded-full">
                      PAID
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Order Type Toggle */}
            <div className="flex bg-slate-100 rounded-xl p-1">
              <button
                onClick={() => !activeOrderId && setOrderType("dine_in")}
                disabled={!!activeOrderId}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${orderType === "dine_in"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                  } ${!!activeOrderId && orderType !== "dine_in" ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <Utensils size={16} />
                Dine-In
              </button>
              <button
                onClick={() => !activeOrderId && setOrderType("takeaway")}
                disabled={!!activeOrderId}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${orderType === "takeaway"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                  } ${!!activeOrderId && orderType !== "takeaway" ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <ShoppingBag size={16} />
                Takeaway
              </button>
            </div>
          </div>

          {/* Customer Section */}
          {!selectedCustomerId ? (
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <UserPlus size={20} />
              </div>
              <input
                type="text"
                placeholder="Enter guest phone number..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value.replace(/\D/g, ''))}
                onKeyPress={e => e.key === 'Enter' && handleCustomerLookup()}
                className="w-full h-12 pl-12 pr-20 rounded-xl border-2 border-slate-200 bg-white text-sm font-medium placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
              />
              {customerSearch.length >= 10 && (
                <button
                  onClick={handleCustomerLookup}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-4 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-black transition-all"
                >
                  Find
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-green-50 border-2 border-green-200 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-green-600 uppercase">Linked Guest</p>
                  <p className="font-bold text-slate-900">{selectedCustomerName}</p>
                </div>
              </div>
              {!activeOrderId && (
                <button
                  onClick={() => { setSelectedCustomerId(null); setSelectedCustomerName(null) }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Menu Section */}
        <div className="flex-1 flex gap-4 p-4 overflow-hidden">
          {/* Menu Items */}
          <div className="flex-1 flex flex-col">
            {/* Search and Filters */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-xl border-2 border-slate-200 bg-white text-sm font-medium placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                />
              </div>
              <div className="flex bg-slate-100 rounded-xl p-1">
                {[
                  { id: "name", label: "A-Z" },
                  { id: "price_asc", label: "₹↑" },
                  { id: "price_desc", label: "₹↓" }
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSortBy(s.id as any)}
                    className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${sortBy === s.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategoryId(null)}
                className={`flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCategoryId === null 
                  ? "bg-blue-500 text-white shadow-lg" 
                  : "bg-white border-2 border-slate-200 text-slate-600 hover:border-blue-300"
                }`}
              >
                All Items
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`flex-none px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCategoryId === c.id 
                    ? "bg-blue-500 text-white shadow-lg" 
                    : "bg-white border-2 border-slate-200 text-slate-600 hover:border-blue-300"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {menuItems
                  .filter(i => {
                    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesCategory = !selectedCategoryId || i.category_id === selectedCategoryId;
                    return matchesSearch && matchesCategory;
                  })
                  .sort((a, b) => {
                    if (sortBy === "name") return a.name.localeCompare(b.name);
                    if (sortBy === "price_asc") return a.base_price - b.base_price;
                    if (sortBy === "price_desc") return b.base_price - a.base_price;
                    return 0;
                  })
                  .map((item) => (
                    <div key={item.id} className="relative group">
                      <button
                        onClick={() => addItem(item)}
                        disabled={!item.is_available}
                        className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${item.is_available
                          ? "border-slate-200 bg-white hover:border-blue-300 hover:shadow-lg active:scale-95"
                          : "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                          }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="font-bold text-slate-900 line-clamp-2 flex-1 pr-2">{item.name}</h3>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${item.is_veg ? "bg-green-100 text-green-600" : item.is_egg ? "bg-yellow-100 text-yellow-600" : "bg-red-100 text-red-600"}`}>
                            {item.is_veg ? <Leaf size={14} /> : item.is_egg ? <Egg size={14} /> : <Flame size={14} />}
                          </div>
                        </div>
                        
                        {!item.is_available && (
                          <div className="mb-3">
                            <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-lg">
                              SOLD OUT
                            </span>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-black text-slate-900">₹{item.base_price}</span>
                          {item.is_available && (
                            <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus size={18} />
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Stock Toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleStock(item); }}
                        className={`absolute -top-2 -right-2 px-2 py-1 rounded-lg text-xs font-bold transition-all ${item.is_available
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                      >
                        {item.is_available ? "IN" : "OUT"}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Cart Section - Mobile Inspired */}
          <div className="w-96 bg-white rounded-2xl border-2 border-slate-200 shadow-xl flex flex-col">
            {/* Cart Header */}
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black text-slate-900">Current Order</h3>
                {activeBillNumber && (
                  <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-lg">
                    Bill #{activeBillNumber}
                  </span>
                )}
              </div>
              
              {activeOrderNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Order #{activeOrderNumber}</span>
                  <button
                    onClick={handleCancelOrder}
                    className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all"
                    title="Cancel Order"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Existing Items */}
              {existingItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <p className="text-sm font-bold text-slate-600 uppercase">Running Order</p>
                  </div>
                  {existingItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-slate-100">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="text-sm text-slate-500">{item.quantity}x ₹{item.price}</p>
                      </div>
                      <span className="font-bold text-slate-900">₹{item.quantity * item.price}</span>
                    </div>
                  ))}
                  <div className="border-t border-dashed border-slate-300 pt-2 flex justify-between font-semibold text-slate-700">
                    <span>Running Total</span>
                    <span>₹{existingTotal}</span>
                  </div>
                </div>
              )}

              {/* New Items */}
              {cart.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-blue-500" />
                      <p className="text-sm font-bold text-blue-600 uppercase">New Items</p>
                    </div>
                    <button 
                      onClick={() => setCart([])} 
                      className="text-sm text-red-500 hover:text-red-700 font-medium"
                    >
                      Clear
                    </button>
                  </div>
                  {cart.map((item) => (
                    <div key={item.item_id} className="bg-blue-50 border-2 border-blue-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-sm text-slate-500">₹{item.price} each</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center bg-white rounded-lg border border-slate-200">
                          <button
                            onClick={() => item.qty > 1 ? updateQty(item.item_id, item.qty - 1) : removeItem(item.item_id)}
                            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-l-lg"
                          >
                            -
                          </button>
                          <span className="w-12 text-center font-bold">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.item_id, item.qty + 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-r-lg"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-bold text-slate-900">₹{item.qty * item.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {existingItems.length === 0 && cart.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <AlertCircle size={48} className="opacity-20 mb-4" />
                  <p className="text-lg font-medium">No items in cart</p>
                  <p className="text-sm">Add items from the menu</p>
                </div>
              )}
            </div>

            {/* Cart Footer */}
            <div className="border-t border-slate-100 p-4 space-y-4">
              {/* Total */}
              <div className="flex items-center justify-between text-xl font-black">
                <span className={paymentStatus === 'paid' ? 'text-green-600' : 'text-slate-900'}>
                  {paymentStatus === 'paid' ? 'Amount Paid' : 'Total'}
                </span>
                <span className={paymentStatus === 'paid' ? 'text-green-600' : 'text-slate-900'}>
                  ₹{(existingTotal + cartTotal).toFixed(2)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="ghost"
                    onClick={handlePreviewBill}
                    disabled={(!activeTableId && !isQuickBill) || (existingItems.length === 0 && cart.length === 0)}
                    className="h-12 border-2 border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 rounded-xl font-bold"
                  >
                    <Eye size={18} className="mr-2" /> Preview
                  </Button>
                  {isQuickBill ? (
                    <Button
                      onClick={() => setShowPaymentModal(true)}
                      disabled={status === "saving" || cart.length === 0}
                      className="h-12 bg-slate-900 hover:bg-black text-white rounded-xl font-bold"
                    >
                      <Printer size={18} className="mr-2" /> Order & Print
                    </Button>
                  ) : (
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={status === "saving" || cart.length === 0}
                      className="h-12 bg-slate-900 hover:bg-black text-white rounded-xl font-bold"
                    >
                      {status === "saving" ? "Saving..." : (
                        <>
                          <Save size={18} className="mr-2" /> KOT / Save
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {isOrderSettled || paymentStatus === 'paid' ? (
                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        setIsOrderSettled(false);
                        setActiveTableId(null);
                        setIsQuickBill(true);
                        setExistingItems([]);
                        setActiveOrderId(null);
                        setActiveOrderNumber(null);
                        setActiveTokenNumber(null);
                        setActiveBillNumber(null);
                        setCart([]);
                        setSelectedCustomerId(null);
                        setSelectedCustomerName(null);
                      }}
                      className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl shadow-lg"
                    >
                      <Plus size={18} className="mr-2" /> Start New Order
                    </Button>
                    <div className="text-center text-sm font-bold text-slate-400">Order is Settled</div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    {isQuickBill && (cart.length > 0 || activeOrderId) && (
                      <Button
                        onClick={() => setShowPaymentModal(true)}
                        disabled={status === "saving"}
                        className="flex-1 h-12 rounded-xl bg-blue-500 text-white hover:bg-blue-600 font-black shadow-lg"
                      >
                        {activeOrderId ? "Pay & Print" : "Pay & Order"}
                      </Button>
                    )}
                    <Button
                      onClick={handleCreateBill}
                      variant="secondary"
                      disabled={status === "saving" || (!activeOrderId && cart.length === 0)}
                      className={`flex-1 h-12 rounded-xl ${isQuickBill ? 'hidden' : 'bg-green-500 text-white hover:bg-green-600 shadow-lg'} font-black`}
                    >
                      Finalize & Print
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handlePaymentConfirm}
        totalAmount={existingTotal + cartTotal}
      />

      {
        showCustomerModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <Card className="bg-white border-slate-200 w-full animate-slide-up shadow-2xl max-w-sm p-6 rounded-3x">
              <h3 className="text-sm font-black uppercase text-slate-900 mb-4">Register New Guest</h3>
              <div className="space-y-4">
                <Input placeholder="Guest Name" value={newCustName} onChange={e => setNewCustName(e.target.value)} className="h-11" />
                <Input placeholder="Phone Number" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value.replace(/\D/g, ''))} className="h-11" />
                <div className="flex gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setShowCustomerModal(false)} className="flex-1">Cancel</Button>
                  <Button onClick={handleAddCustomer} className="flex-[2] bg-brand-600 text-white h-11 rounded-xl">Register & Link</Button>
                </div>
              </div>
            </Card>
          </div>
        )
      }

      <PrintPreviewModal
        isOpen={previewData.isOpen}
        onClose={() => setPreviewData(prev => ({ ...prev, isOpen: false }))}
        title={previewData.title}
        lines={previewData.lines}
        width={previewData.width}
        onPrint={handleCreateBill}
      />
    </div >
  );
}
