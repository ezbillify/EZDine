"use client";

import { AlertCircle, CheckCircle2, Save, Trash2, User, Search, Plus, Phone, X, UserPlus, ArrowRight, Check, Eye, Zap, History } from "lucide-react";
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
import { buildInvoiceLines, buildKotLines, getPrintingSettings, sendPrintJob, PrintLine } from "../../lib/printing";
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
  is_available: boolean;
};

type OrderItem = {
  id: string;
  item_id: string;
  name: string;
  quantity: number;
  price: number;
  status: string;
};

export function PosShell() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<{ id: string; name: string }[]>([]);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrderNumber, setActiveOrderNumber] = useState<string | null>(null);
  const [activeTokenNumber, setActiveTokenNumber] = useState<number | null>(null);
  const [isQuickBill, setIsQuickBill] = useState(false);
  const [qrOrders, setQrOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [isOrderSettled, setIsOrderSettled] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
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
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;

      const audioCtx = new AudioContext();

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5); // Drop to A4

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
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
      } catch (err) {
        toast.error("Failed to load menu or tables");
      }
    };
    load();

    // Listen for Realtime Order Updates
    const channel = supabase
      .channel("pos-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        async (payload) => {
          fetchQrOrders();
          if (activeTableId && payload.new && (payload.new as any).table_id === activeTableId) {
            setLastUpdated(Date.now());
          }

          const newOrder = payload.new as any;
          const eventType = payload.eventType;
          if (eventType === 'INSERT' || (eventType === 'UPDATE' && newOrder.payment_status === 'paid')) {
            playBuzzer();
            toast.success("New Order / Payment Update", {
              description: `Order #${newOrder.order_number} Updated`,
              action: { label: "Refresh", onClick: () => fetchQrOrders() }
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
          fetchQrOrders();
          // We don't have table_id in order_items payload usually, so we might just force refresh active table
          // to be safe, or we could fetch the order to check table_id. 
          // For simplicity/performance balance: just trigger refresh. 
          // The loadTableOrder hook is cheap enough.
          setLastUpdated(Date.now());
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

    fetchQrOrders();

    return () => {
      supabase.removeChannel(channel);
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

  const fetchQrOrders = async () => {
    try {
      const orders = await getPendingQrOrders();
      setQrOrders(orders);
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

      const items = await getOrderItems(order.id);
      const mappedItems: OrderItem[] = items.map((i) => ({
        id: i.id,
        item_id: i.item_id,
        name: menuItems.find((m) => m.id === i.item_id)?.name ?? "Unknown Item",
        quantity: i.quantity,
        price: i.price,
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
        status: i.status
      }));

      setCart([]);
      setExistingItems(mappedItems);
      setActiveOrderId(bill.order_id);
      setActiveOrderNumber(orderData?.order_number);
      setActiveTokenNumber(orderData?.token_number);
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
          const items = await getOrderItems(order.id);
          const mappedItems: OrderItem[] = items.map((i) => ({
            id: i.id,
            item_id: i.item_id,
            name: menuItems.find((m) => m.id === i.item_id)?.name ?? "Unknown Item",
            quantity: i.quantity,
            price: i.price,
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
      return [...prev, { item_id: item.id, name: item.name, qty: 1, price: item.base_price }];
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
        const order = await createOrder(activeTableId, cart, undefined, selectedCustomerId);
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
          primaryMethod as any
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

      // 2. Print KOT (Only if new items exist)
      if (cart.length > 0) {
        try {
          const settings = await getPrintingSettings();
          if (settings) {
            const kotLines = buildKotLines({
              restaurantName: "EZDine",
              branchName: "Branch",
              tableName: isQuickBill ? "QUICK BILL" : (tables.find((t) => t.id === activeTableId)?.name ?? "--"),
              orderId: orderNumber ?? "--",
              tokenNumber: tokenNumber?.toString(),
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

      // 4. Print Bill
      try {
        const settings = await getPrintingSettings();
        if (settings) {
          const billLines = buildInvoiceLines({
            restaurantName: "EZDine",
            branchName: "Branch",
            billId: `${orderNumber}`,
            items: fullItems.map(c => ({ name: c.name, qty: c.qty, price: c.price })),
            subtotal: totalAmount,
            tax: 0,
            total: totalAmount
          });
          await sendPrintJob({
            printerId: settings.printerIdInvoice ?? "billing-1", // Changed from printerIdBill to match usage elsewhere if needed, or keep consistent
            width: settings.widthBill ?? 80,
            type: "invoice",
            lines: billLines
          });
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
      if (isQuickBill) setIsQuickBill(false); // Reset Quick Bill state

      // Refresh History
      const data = await getSettledBills();
      setHistory(data);
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
      setExistingItems([]);
      setSelectedCustomerId(null);
      setSelectedCustomerName(null);
      if (isQuickBill) setIsQuickBill(false);

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
    const billable = [...existingItems.map(i => ({ name: i.name, qty: i.quantity, price: i.price }))];
    cart.forEach(c => billable.push({ name: c.name, qty: c.qty, price: c.price }));

    if (billable.length === 0) return;

    const total = billable.reduce((sum, i) => sum + i.qty * i.price, 0);
    const lines = buildInvoiceLines({
      restaurantName: "EZDine",
      branchName: isQuickBill ? "Walk-in" : (tables.find(t => t.id === activeTableId)?.name ?? "Branch"),
      billId: "PREVIEW",
      items: billable,
      subtotal: total,
      tax: 0,
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
        const order = await createOrder(null, cart, undefined, selectedCustomerId || null, 'pos', 'pending', undefined, undefined, 'cash', 'takeaway');
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

      const bill = await createBill(currentOrderId!, billItems);
      const billTotal = billItems.reduce((sum, i) => sum + i.qty * i.price, 0);
      await addPayment(bill.id, "cash", billTotal);

      try {
        const settings = await getPrintingSettings();
        if (settings) {
          const invoiceLines = buildInvoiceLines({
            restaurantName: "EZDine",
            branchName: isQuickBill ? "Direct" : "Branch",
            billId: bill.bill_number,
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
      setExistingItems([]);
      setCart([]);
      setSelectedCustomerId(null);
      setSelectedCustomerName(null);
      if (isQuickBill) setIsQuickBill(false);

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
              {/* QR Incoming Orders */}
              {qrOrders.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-600">Incoming QR</h3>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white leading-none animate-pulse">
                      {qrOrders.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {qrOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => loadQrOrder(order)}
                        className={`w-full rounded-[1.5rem] border p-3 text-left transition-all hover:shadow-lg active:scale-[0.98] ${order.payment_method === 'online' && order.payment_status === 'paid'
                          ? 'border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50'
                          : order.payment_method === 'online'
                            ? 'border-slate-100 bg-slate-50/50 hover:bg-slate-100 opacity-60'
                            : 'border-brand-100 bg-brand-50/50 hover:bg-brand-50'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl font-black text-lg shadow-sm ${order.payment_method === 'online' && order.payment_status === 'paid' ? 'bg-emerald-500 text-white'
                            : order.payment_method === 'online' ? 'bg-slate-200 text-slate-500'
                              : 'bg-brand-600 text-white'
                            }`}>
                            {order.token_number}
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`text-[9px] font-black uppercase tracking-wider ${order.payment_method === 'online' && order.payment_status === 'paid' ? 'text-emerald-600'
                                : order.payment_method === 'online' ? 'text-slate-400'
                                  : 'text-brand-600'
                                }`}>
                                {order.payment_method === 'online' && order.payment_status === 'paid' ? 'Paid Online'
                                  : order.payment_method === 'online' ? 'Paying...'
                                    : 'Cash Counter'}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                {order.order_type === 'dine_in' ? 'Dine-in' : 'Takeaway'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900">
                              <span className="truncate">{order.customer?.name || "Guest"}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-slate-100 mx-2" />
                </div>
              )}

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
        <div className="relative flex-none">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={16} />
          </div>
          <input
            placeholder="Search menu..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none ring-brand-500 transition-all focus:border-brand-500 focus:ring-2"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {menuItems.map((item) => (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => addItem(item)}
                  disabled={!item.is_available}
                  className={`flex h-full w-full flex-col justify-between rounded-xl border p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 ${item.is_available
                    ? "border-white bg-white hover:border-brand-300 hover:shadow-md"
                    : "border-slate-100 bg-slate-50 opacity-60 grayscale cursor-not-allowed"
                    }`}
                >
                  <div className="mb-2 w-full">
                    <span className="font-semibold text-slate-900 line-clamp-2">{item.name}</span>
                    {!item.is_available && (
                      <span className="mt-1 block text-[10px] font-black uppercase tracking-widest text-rose-600">
                        Sold Out
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between w-full">
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-700">
                      ₹{item.base_price}
                    </span>
                    {item.is_available && (
                      <div className="h-6 w-6 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus size={14} />
                      </div>
                    )}
                  </div>
                </button>

                {/* Manager/Staff Toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleStock(item); }}
                  className={`absolute -top-1 -right-1 z-10 p-1.5 rounded-lg shadow-sm border transition-all ${item.is_available ? 'bg-white border-slate-200 text-slate-400 hover:text-rose-500' : 'bg-rose-600 border-rose-700 text-white'}`}
                  title={item.is_available ? "Mark Out of Stock" : "Mark Available"}
                >
                  <Zap size={10} className={item.is_available ? "" : "fill-current"} />
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
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Order</p>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 truncate max-w-[150px]">
                  {isQuickBill && !activeTableId ? "Quick Bill" : (tables.find((t) => t.id === activeTableId)?.name ?? "Select Table")}
                </h3>
                {activeTokenNumber && (
                  <span className="flex items-center justify-center h-7 w-12 rounded-lg bg-brand-600 text-white text-sm font-black shadow-sm shadow-brand-200">
                    T{activeTokenNumber}
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

          <div className="relative">
            {!selectedCustomerId ? (
              <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1.5 focus-within:border-brand-500 transition-all">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                  <UserPlus size={16} />
                </div>
                <input
                  type="text"
                  placeholder="Customer Phone..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleCustomerLookup()}
                  className="flex-1 bg-transparent border-none text-xs font-medium placeholder:text-slate-400 focus:ring-0 text-slate-700"
                />
                {customerSearch.length >= 10 && (
                  <button onClick={handleCustomerLookup} className="h-7 w-7 flex items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between bg-emerald-50 rounded-xl border border-emerald-100 p-1.5 group">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
                    <User size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-emerald-600">Guest</p>
                    <p className="text-xs font-bold text-slate-900">{selectedCustomerName}</p>
                  </div>
                </div>
                {!activeOrderId && (
                  <button onClick={() => { setSelectedCustomerId(null); setSelectedCustomerName(null) }} className="h-7 w-7 text-slate-400 hover:text-rose-500 transition-colors">
                    <X size={16} />
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
            <span>Total</span>
            <span>₹{(existingTotal + cartTotal).toFixed(2)}</span>
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
            {(!isQuickBill) && (
              <Button
                onClick={handlePlaceOrder}
                disabled={status === "saving" || cart.length === 0}
                className="w-full h-11 bg-slate-900 hover:bg-black text-white rounded-xl"
              >
                {status === "saving" ? "Saving..." : <span className="flex items-center gap-2"><Save size={16} /> KOT / Save</span>}
              </Button>
            )}
          </div>

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
                <Input placeholder="Phone Number" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} className="h-11" />
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
