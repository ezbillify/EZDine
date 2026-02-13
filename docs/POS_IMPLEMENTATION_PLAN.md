# EZDine POS: Master Implementation Plan

This document outlines the full roadmap for the EZDine POS system based on real-world customer feedback. Our goal is to transform the existing POS into a feature-rich, high-speed, and reliable system for restaurant operations.

## 📋 Phase 1: Core POS Flow & Speed (Top Priority)
*Focus: Ensuring the waiter/cashier can process orders in seconds.*

- [x] **Quick Bill Mode**: Enable billing without table selection (for walk-ins).
- [ ] **Keyboard-First Interface**:
  - `CMD/CTRL + F` to focus search.
  - Arrow keys for menu navigation.
  - `Enter` to add to cart.
  - `CMD + S` to save/print KOT.
- [ ] **Numeric Quick-Pad**: Large touch/mouse friendly dial for setting quantities (1, 2, 5, 10) instantly.
- [ ] **Smart Search**: Search by name, category, or short-codes (e.g., 'PB' for Paneer Butter Masala).

## 🥘 Phase 2: Kitchen & Order Management
*Focus: Clear communication between front-of-house and kitchen.*

- [ ] **Item Modifiers (Add-ons)**: Support for "Extra Spicy", "No Onion", "Jain Style".
- [ ] **KOT Routing**: Automatic printing to designated printers (Kitchen vs. Bar vs. Pizza Oven).
- [ ] **Live Table Status**: Color-coded tables (Empty: Blue, Occupied: Amber, Billing: Red, To-be-cleaned: Grey).
- [ ] **Split Bills**: Ability to split a single table order into multiple separate invoices.

## 💳 Phase 3: Payments & Customer Loyalty
*Focus: Accurate accounting and repeat business.*

- [ ] **Multi-Mode Payments**: Split a bill between Cash + UPI + Card.
- [ ] **Customer Profile 2.0**: 
  - Show "Previous Orders" on lookup.
  - Automatic application of "Regular Customer" discounts.
- [ ] **Store Credit / Khata**: Allow regular customers to "Pay Later" (Account management).

## 📊 Phase 4: Business Intelligence & Controls
*Focus: Management oversight and financial integrity.*

- [ ] **Shift Management (Z-Report)**:
  - Cashier opening/closing balance.
  - Discrepancy tracking (Expected vs. Actual Cash).
- [ ] **Inventory Linkage**: Deduct raw materials (stock) automatically when a menu item is sold.
- [ ] **Manager Overrides**: Pin/Password required for Cancelling orders or giving deep discounts.

---

## 🛠 Technical Requirements Checklist
- [ ] **Database**: Add `modifiers` table and `modifier_options` table.
- [ ] **Supabase RLS**: Ensure waiters can only see active orders for their branch.
- [ ] **Print System**: Refactor `PrintService` to handle asynchronous multi-printer routing.
- [ ] **PWA Support**: Offline mode for cart management in case of spotty internet.

---

## 📝 Customer Feedback Log (To be Filled)
*Use this section to record specific requests from the customer meeting on 2026-02-13.*

1.  **Fast Billing (Implemented)**
2. Quick billing no customer , no table it gives a token number too so the kitchen can call it directly ok?
3. We need a online billing like any customer comes and scans the qr code enter mobile number if new aksks name then they add items then they can pay through razorpay or cash if it paid to cash then it goes to the cash counter they if he tells his token number cash counter will click on the token number and it will open the bill and they can pay through cash we have multiple branch opitin so give me a plan accordingly if it paid then it directly goes to the kitchen we need few users like owner,manager, kitchen ok for customer login using qr no need auth ok? we need to make this perfect ok?
4. make the app too ready ok? make this perfect for all user type make this perfect ok?
5.  Suggest any other features ok?
