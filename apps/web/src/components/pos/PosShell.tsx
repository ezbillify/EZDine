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
    <div className="flex h-full w-full gap-4 overflow-hidden">
      <Toaster position="bottom-center" richColors />

      {/* 1. Tables/History Column */}
      <section className="flex w-64 flex-none flex-col gap-4 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 p-2 flex gap-1">
          <button
            onClick={() => setActiveTab("live")}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'live' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Live Status
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            History
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'live' ? (
            <>
              {/* Unified Live Orders Feed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Status</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={playBuzzer}
                      className="text-[9px] font-bold text-slate-400 hover:text-brand-600 uppercase tracking-tighter bg-slate-50 px-2 rounded-lg py-0.5 border border-slate-100 transition-all font-outfit"
                    >
                      Buzzer
                    </button>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white leading-none">
                      {liveOrders.length}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {liveOrders.map((order) => {
                    const isPaid = order.payment_status === 'paid';
                    const isQr = order.source === 'qr' || order.source === 'table';
                    const isActive = activeOrderId === order.id;

                    const theme = isPaid ? 'emerald' : (isQr ? 'amber' : 'brand');
                    const themes: Record<string, any> = {
                      emerald: {
                        active: "border-emerald-500 bg-emerald-50 ring-emerald-200 shadow-emerald-500/10",
                        idle: "border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50",
                        text: "text-emerald-700",
                        badge: "bg-emerald-100 text-emerald-700",
                        activeBadge: "bg-emerald-600 text-white",
                        dot: "bg-emerald-500",
                        dotInner: "bg-emerald-600"
                      },
                      amber: {
                        active: "border-amber-500 bg-amber-50 ring-amber-200 shadow-amber-500/10",
                        idle: "border-slate-200 bg-white hover:border-amber-200",
                        text: "text-amber-700",
                        badge: "bg-amber-100 text-amber-700",
                        activeBadge: "bg-amber-600 text-white",
                        dot: "bg-amber-500",
                        dotInner: "bg-amber-600"
                      },
                      brand: {
                        active: "border-brand-500 bg-brand-50 ring-brand-200 shadow-brand-500/10",
                        idle: "border-slate-200 bg-white hover:border-brand-200",
                        text: "text-brand-700",
                        badge: "bg-brand-100 text-brand-700",
                        activeBadge: "bg-brand-600 text-white",
                        dot: "bg-brand-500",
                        dotInner: "bg-brand-600"
                      }
                    };
                    const s = themes[theme];

                    return (
                      <button
                        key={order.id}
                        onClick={() => loadQrOrder(order)}
                        className={`group relative flex flex-col items-center justify-center rounded-[1.25rem] border p-3 transition-all active:scale-95 shadow-sm ${isActive ? s.active + " ring-1 shadow-lg" : s.idle
                          }`}
                      >
                        {/* Breathing LED */}
                        <div className="absolute top-2 right-2 flex h-2 w-2">
                          <span className={`animate-breathing absolute inline-flex h-full w-full rounded-full opacity-75 ${s.dot}`}></span>
                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${s.dotInner}`}></span>
                        </div>

                        <div className="flex items-start justify-center gap-0.5 mb-1">
                          <span className={`text-xl font-black ${isActive ? s.text : isPaid ? "text-emerald-700" : "text-slate-900"}`}>
                            {order.token_number}
                          </span>
                          {isPaid && <CheckCircle2 size={10} className="text-emerald-600 mt-1" />}
                        </div>

                        <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${isActive ? s.activeBadge : s.badge
                          }`}>
                          {isPaid ? (order.payment_method === 'online' ? 'ONLINE' : 'PAID') : isQr ? 'QR' : (order.order_type === 'takeaway' ? 'TK' : 'DN')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-slate-100 mx-2" />

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
                className={`group relative w-full overflow-hidden rounded-[1.5rem] border-2 p-4 text-left transition-all hover:shadow-lg active:scale-[0.98] ${isQuickBill && !activeTableId
                  ? "border-amber-500 bg-amber-50"
                  : "border-slate-100 bg-white hover:border-amber-200"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isQuickBill && !activeTableId ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-amber-100 group-hover:text-amber-600"}`}>
                      <Zap size={20} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-black uppercase tracking-tight ${isQuickBill && !activeTableId ? "text-amber-900" : "text-slate-900"}`}>Quick Bill</h3>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${isQuickBill && !activeTableId ? "text-amber-600" : "text-slate-400"}`}>Direct / Walk-in</p>
                    </div>
                  </div>
                  {isQuickBill && !activeTableId && <CheckCircle2 size={18} className="text-amber-500" />}
                </div>
              </button>

              <div className="h-px bg-slate-100 mx-2" />

              <div className="grid grid-cols-1 gap-2">
                {tables.map((table) => (
                  <button
                    key={table.id}
                    onClick={() => setActiveTableId(table.id)}
                    className={`relative rounded-xl border p-3 text-left text-sm font-semibold transition-all hover:shadow-md ${activeTableId === table.id
                      ? "border-brand-600 bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                      : "border-slate-200 bg-white text-slate-700 hover:border-brand-200"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{table.name}</span>
                      {activeTableId === table.id && <CheckCircle2 size={16} />}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="flex justify-center p-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" /></div>
              ) : history.length === 0 ? (
                <div className="text-center p-8 opacity-40">
                  <History size={32} className="mx-auto mb-2 text-slate-300" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No settled bills</p>
                </div>
              ) : (
                history.map((bill) => (
                  <div
                    key={bill.id}
                    onClick={() => loadSettledBill(bill)}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-200 text-[10px] font-black text-slate-600">
                          {bill.order?.token_number || "-"}
                        </span>
                        <span className="text-[10px] font-black text-slate-900">#{bill.order?.order_number}</span>
                      </div>
                      <span className="text-[10px] font-black text-brand-600">₹{bill.total}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-bold text-slate-400 truncate max-w-[80px]">{bill.order?.customer?.name || "Guest"}</p>
                      <span className="text-[8px] font-medium text-slate-300">{new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>

      {/* 2. Menu Column */}
      <section className="flex flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex flex-none items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={16} />
            </div>
            <input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none ring-brand-500 transition-all focus:border-brand-500 focus:ring-2"
            />
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {[
              { id: "name", icon: <ArrowRight className="rotate-[-45deg]" size={14} />, label: "A-Z" },
              { id: "price_asc", icon: <Check size={14} />, label: "₹↑" },
              { id: "price_desc", icon: <Check size={14} className="rotate-180" />, label: "₹↓" }
            ].map(s => (
              <button
                key={s.id}
                onClick={() => setSortBy(s.id as any)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase transition-all ${sortBy === s.id ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-none gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`flex-none rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategoryId === null ? "bg-brand-600 text-white shadow-lg shadow-brand-200" : "bg-white border border-slate-100 text-slate-500 hover:border-brand-200"
              }`}
          >
            All Items
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategoryId(c.id)}
              className={`flex-none rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategoryId === c.id ? "bg-brand-600 text-white shadow-lg shadow-brand-200" : "bg-white border border-slate-100 text-slate-500 hover:border-brand-200"
                }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
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
                    className={`flex h-full w-full flex-col justify-between rounded-xl border p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 ${item.is_available
                      ? "border-white bg-white hover:border-brand-300 hover:shadow-md"
                      : "border-slate-100 bg-slate-50 opacity-60 grayscale cursor-not-allowed"
                      }`}
                  >
                    <div className="mb-2 w-full flex justify-between items-start gap-2">
                      <span className="font-semibold text-sm text-slate-900 line-clamp-2 leading-tight flex-1">{item.name}</span>
                    </div>
                    {!item.is_available && (
                      <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-rose-600">
                        Sold Out
                      </span>
                    )}
                    <div className="mt-auto flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-700">
                          ₹{item.base_price}
                        </span>
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center ${item.is_veg ? "bg-green-100 text-green-600" : item.is_egg ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
                          {item.is_veg ? <Leaf size={12} /> : item.is_egg ? <Egg size={12} /> : <Flame size={12} />}
                        </div>
                      </div>
                      {item.is_available && (
                        <div className="h-6 w-6 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus size={14} />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Stock Toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleStock(item); }}
                    className={`absolute -top-1 -right-1 z-10 px-2.5 py-1 rounded-full border transition-all text-[9px] font-black uppercase tracking-wider ${item.is_available
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'}`}
                  >
                    {item.is_available ? "In Stock" : "Out Stock"}
                  </button>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* 3. Current Order Column */}
      <section className="flex w-96 flex-none flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-xl">
        <div className="flex-none border-b border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Order</p>
                {activeBillNumber && <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">Bill #{activeBillNumber}</span>}
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 truncate max-w-[150px]">
                  {isQuickBill && !activeTableId ? "Quick Bill" : (tables.find((t) => t.id === activeTableId)?.name ?? "Select Table")}
                </h3>
                {activeTokenNumber && (
                  <span className={`flex items-center justify-center h-7 w-12 rounded-lg text-white text-sm font-black shadow-sm ${paymentStatus === 'paid' ? 'bg-emerald-500 shadow-emerald-200' : 'bg-brand-600 shadow-brand-200'}`}>
                    T{activeTokenNumber}
                  </span>
                )}
                {paymentStatus === 'paid' && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    Paid
                  </span>
                )}
              </div>
            </div>
            {activeOrderNumber && (
              <div className="text-right flex items-center gap-3">
                <button
                  onClick={handleCancelOrder}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 hover:shadow-sm transition-all"
                  title="Cancel Order"
                >
                  <Trash2 size={16} />
                </button>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Order #</p>
                  <p className="font-mono font-medium text-slate-900">{activeOrderNumber}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => !activeOrderId && setOrderType("dine_in")}
              disabled={!!activeOrderId}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 ${orderType === "dine_in"
                ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                } ${!!activeOrderId && orderType !== "dine_in" ? "opacity-30 cursor-not-allowed" : ""}`}
            >
              <Utensils size={12} />
              Dine-In
            </button>
            <button
              onClick={() => !activeOrderId && setOrderType("takeaway")}
              disabled={!!activeOrderId}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5 ${orderType === "takeaway"
                ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                } ${!!activeOrderId && orderType !== "takeaway" ? "opacity-30 cursor-not-allowed" : ""}`}
            >
              <ShoppingBag size={12} />
              Takeaway
            </button>
          </div>

          <div className="space-y-3">
            {!selectedCustomerId ? (
              <div className="group relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-600 transition-colors">
                  <UserPlus size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Guest Phone Number..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value.replace(/\D/g, ''))}
                  onKeyPress={e => e.key === 'Enter' && handleCustomerLookup()}
                  className="w-full h-12 pl-11 pr-12 rounded-2xl border-2 border-slate-100 bg-slate-50/50 text-sm font-bold placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/5 transition-all outline-none"
                />
                {customerSearch.length >= 10 && (
                  <button
                    onClick={handleCustomerLookup}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 px-3 flex items-center gap-1.5 rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-200 hover:bg-black active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest"
                  >
                    Find
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-white rounded-2xl border-2 border-emerald-100 p-2 shadow-sm shadow-emerald-500/5 group">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-200">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-0.5">Linked Guest</p>
                    <p className="text-sm font-black text-slate-900 leading-none">{selectedCustomerName}</p>
                  </div>
                </div>
                {!activeOrderId && (
                  <button
                    onClick={() => { setSelectedCustomerId(null); setSelectedCustomerName(null) }}
                    className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                    title="Remove Customer"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {existingItems.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-500" /> Running Order
              </p>
              {existingItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm py-1 opacity-75">
                  <div className="flex gap-2">
                    <span className="font-mono text-slate-500">{item.quantity}x</span>
                    <span className="text-slate-700">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-900">₹{item.quantity * item.price}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between text-sm font-medium text-slate-600">
                <span>Running Total</span>
                <span>₹{existingTotal}</span>
              </div>
            </div>
          )}

          {cart.length > 0 && (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-brand-600 flex items-center gap-2">
                  <AlertCircle size={12} /> New Items
                </p>
                <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">Clear</button>
              </div>
              {cart.map((item) => (
                <div key={item.item_id} className="group flex items-center justify-between gap-2 rounded-lg border border-brand-100 bg-brand-50/30 p-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-slate-500">₹{item.price}</p>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
                    <button
                      onClick={() => item.qty > 1 ? updateQty(item.item_id, item.qty - 1) : removeItem(item.item_id)}
                      className="h-7 w-7 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-l-lg"
                    >-</button>
                    <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.item_id, item.qty + 1)}
                      className="h-7 w-7 flex items-center justify-center text-slate-500 hover:bg-slate-50 rounded-r-lg"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {existingItems.length === 0 && cart.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <AlertCircle className="opacity-10 mb-2" size={32} />
              <p className="text-sm">No items in cart</p>
            </div>
          )}
        </div>

        <div className="flex-none border-t border-slate-100 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between text-lg font-bold text-slate-900">
            <span className={paymentStatus === 'paid' ? 'text-emerald-600' : ''}>
              {paymentStatus === 'paid' ? 'Amount Paid' : 'Total'}
            </span>
            <span className={paymentStatus === 'paid' ? 'text-emerald-600' : ''}>₹{(existingTotal + cartTotal).toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-2">
            <Button
              variant="ghost"
              onClick={handlePreviewBill}
              disabled={(!activeTableId && !isQuickBill) || (existingItems.length === 0 && cart.length === 0)}
              className="w-full h-11 border border-slate-200 text-slate-600 hover:text-brand-600 rounded-xl text-xs gap-2"
            >
              <Eye size={16} /> Preview Bill
            </Button>
            {isQuickBill ? (
              <Button
                onClick={() => setShowPaymentModal(true)}
                disabled={status === "saving" || cart.length === 0}
                className="w-full h-11 bg-slate-900 hover:bg-black text-white rounded-xl text-xs gap-2"
              >
                <Printer size={16} /> Order & Print
              </Button>
            ) : (
              <Button
                onClick={handlePlaceOrder}
                disabled={status === "saving" || cart.length === 0}
                className="w-full h-11 bg-slate-900 hover:bg-black text-white rounded-xl"
              >
                {status === "saving" ? "Saving..." : <span className="flex items-center gap-2"><Save size={16} /> KOT / Save</span>}
              </Button>
            )}
          </div>

          {isOrderSettled || paymentStatus === 'paid' ? (
            <div className="w-full space-y-3">
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
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-emerald-500/20 gap-2"
              >
                <Plus size={16} /> Start New Order
              </Button>
              <div className="text-center text-[10px] uppercase font-bold text-slate-300">Order is Settled</div>
            </div>
          ) : (
            <div className="flex gap-3">
              {isQuickBill && (cart.length > 0 || activeOrderId) && (
                <Button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={status === "saving"}
                  className="flex-1 h-12 rounded-xl bg-brand-600 text-white hover:bg-brand-700 font-black uppercase tracking-widest text-xs shadow-lg shadow-brand-500/20"
                >
                  {activeOrderId ? "Pay & Print" : "Pay & Order"}
                </Button>
              )}
              <Button
                onClick={handleCreateBill}
                variant="secondary"
                disabled={status === "saving" || (!activeOrderId && cart.length === 0)}
                className={`flex-1 h-12 rounded-xl ${isQuickBill ? 'hidden' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20'} font-black uppercase tracking-widest text-xs`}
              >
                Finalize & Print
              </Button>
            </div>
          )}
        </div>
      </section>

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
