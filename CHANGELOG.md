
## v1.19.1 (2026-03-10)

### Fixes
* Removed unused icon import from lucide-react to improve code maintainability


## v1.19.0 (2026-03-10)


### Features
* Introduced new `DashboardModule` and `QuickAccessLink` types
* Added coming soon feature to modules and links



## v1.18.1 (2026-03-10)

### Fixes
* Removed unused icons and variables from the codebase
* Refactored the sidebar items to use a typed interface


## v1.18.0 (2026-03-10)

### Features
* Added 'Coming Soon' label to dashboard links
* Refactored sidebar and menu page for better user experience
### Fixes
* Improved code quality and consistency


## v1.17.0 (2026-03-10)

# Features
* Added menu bar to desktop application
* Improved user profile caching for better performance
# Fixes
* Updated dependencies for web application
* Improved performance of web application


## v1.16.0 (2026-03-09)

### Features
* Enhanced Print Bridge UI with improved styling and layout
* Added printer detection for Windows and Mac platforms
* Introduced a health check endpoint for monitoring
### Fixes
* Improved Windows USB printing by attempting multiple printer paths


## v1.15.0 (2026-03-09)

### Features
* Added support for USB printing on Windows and macOS
* Improved buffer handling for printer commands
### Fixes
* Enhanced error handling for printer connections


## v1.14.0 (2026-03-09)

### Features
* Refactored dashboard service to provide separate streams for orders count, active tables count, daily volume, and low stock count
* Improved code organization and readability


## v1.13.1 (2026-03-08)

- Simplified UI styling and layout for better performance and readability
- Removed unused print styling
- Improved performance by reducing backdrop-blur usage


## v1.13.0 (2026-03-08)

### Features
* Added order history reprint functionality
* Improved POS screen with real-time updates and optimized performance
* Display app version in the dashboard
### Fixes
* Resolved issues with order item loading and caching


## v1.12.0 (2026-03-01)


### Features
* Added EZ-Dine management schema with plans, subscriptions, and invoices tables
* Implemented Row-Level Security (RLS) policies for secure data access
* Included sample plans for testing purposes
### Fixes
* None


## v1.11.0 (2026-03-01)


### Features
* Added keyboard shortcuts for quick fill, payment method selection, and confirmation
* Improved input handling for payment amounts
* Added a toggle for keyboard and keypad input



## v1.10.0 (2026-03-01)

- Introduced a numeric keypad for easy payment entry in the payment modal
- Improved payment handling to prevent overpayment and enhance user experience


## v1.9.0 (2026-03-01)

### Features
* Added real-time order status tracking on the success screen
* Introduced toast notifications for order status changes
* Updated order status display on the success screen to reflect real-time changes


## v1.8.1 (2026-03-01)

### Fixes
* Corrected add to cart and update quantity buttons functionality
* Updated button icons to match the correct functionality


## v1.8.0 (2026-03-01)


### Features
* Enhanced menu item card design with improved layout and visuals
* Updated search bar with new icon and styling
* Added update quantity feature to menu item card
* Improved category buttons with new styling and layout

### Fixes
* None


## v1.7.0 (2026-03-01)

- Added missing functions and policies for settings table
- Enabled Row Level Security (RLS) for settings table
- Created user role tables for restaurant and branch roles
- Updated iOS configuration for better performance and Bluetooth connectivity


## v1.6.0 (2026-02-28)

- Implemented dual-login system with password and OTP login methods
- Added forgot password flow with 3-step recovery process
- Ensured App Store compliance with legal links and mobile implementation
- Implemented branding across mobile and web applications
- Configured Supabase email templates for OTP and password reset


## v1.5.1 (2026-02-18)

### Fixes
* Refactored metadata and viewport settings in the layout component for improved organization and readability


## v1.5.0 (2026-02-18)

### Features
* Added customer management screen
* Added menu management screen
### Fixes
* Updated order item status query in KDS screen


## v1.4.0 (2026-02-18)

### Features
* Introduced a new `BrandingFooter` component to standardize the branding across the application
* Replaced the existing global branding with the new `BrandingFooter` component


## v1.3.0 (2026-02-18)

### Features
   * Added global branding to the login and qr order pages
   * Introduced a consistent 'Powered by EZBillify' footer across the application
   * Updated the sidebar to include the EZBillify branding and improve version display


## v1.2.1 (2026-02-18)

- **Fixes**: conditionally render online payment button based on razorpay_enabled flag


## v1.2.0 (2026-02-18)

### Features
* Introduced dine-in and takeaway order types with a toggle button
* Added a live orders sidebar for easy tracking
* Enhanced printing functionality for kitchen and billing

### Fixes
* Improved error handling for printing and order processing


## v1.1.8 (2026-02-16)

✨ **New Features** 🚀
- Release v1.1.7, v1.1.6, v0.1.5, v0.1.4, v0.1.3, v0.1.2, and v0.1.1.

🐛 **Bug Fixes** 🚫
- Fixed a zero payable bug and added a smart payment modal with auto-fill and shortcuts.
- Strictly hide all unpaid QR orders.
- Use Service Role Key for payment verification to bypass RLS and resolve a function-related issue.

⚡️ **Improvements** ⚡️
- Releases of various version (v1.1.7, v1.1.6, v0.1.5, v0.1.4, v0.1.3, v0.1.2, and v0.1.1)


## v1.1.7 (2026-02-13)

### 🚀 Release Notes v1.1.6

#### ✨ New Features

* Introduced smart payment modal with auto-fill and shortcuts for seamless transactions

#### 🐛 Bug Fixes

* Resolved zero payable bug
* Strictly hide unpaid QR orders
* Fixed payment verification issue by using Service Role Key
* Enabled POS real-time for order items
* Added connection debug logs for improved troubleshooting

#### ⚡️ Improvements

* Multiple release notes for v0.1.x to v1.1.6 👀


## v1.1.6 (2026-02-13)

### ✨ New Features
- No new features were added in these commits.

### 🐛 Fixes
- **Smart Payment Modal**: resolve zero payable bug and add auto-fill and shortcuts to the smart payment modal [f4f1500]
- **POS Realtime**: enable POS realtime for order items and add connection debug logs [823592d]
- **Payment Verification**: use Service Role Key for payment verification to bypass RLS [dfa7c5f]
- **KDS Unpaid Orders**: strictly hide all unpaid QR orders from KDS [d610729]
- **KDS Online Orders**: hide unpaid online orders from KDS and add debug logs for payment verification [5016390]

### ⚡️ Improvements
- No improvements were added in these commits.

### 🚀 Release Notes
- Releases v0.1.5, v0.1.4, v0.1.3, v0.1.2, and v0.1.1.


## v0.1.5 (2026-02-13)

**🚀 Release Notes**

### ✨ New Features

- **Enhanced POS**: Now supports split payments, KDS realtime, and Razorpay edge function verification

### 🐛 Bug Fixes

- Resolved zero payable bug and added smart payment modal with auto-fill and shortcuts
- Strictly hide all unpaid QR orders
- Fixed issue with Service Role Key for payment verification to bypass RLS
- Enabled POS realtime for order items and added connection debug logs
- Fixed KDS to hide unpaid online orders and added debug logs for payment verification

### ⚡️ Improvements

- Released version 0.1.4, 0.1.3, 0.1.2, and 0.1.1


## v0.1.4 (2026-02-13)

**What's New in 0.1.4 🚀**

### ✨ Features

* **Split Payments**: Seamlessly split payments with our POS, perfect for multiple users 📈
* **KDS Realtime**: Get real-time updates on orders, no delays! ⏱️
* **Razorpay Verification**: Our edge function verifies payments for extra security 🔒

### 🐛 Fixes

* **Payment Bug Fix**: No more zero payable bugs, auto-fill and shortcuts for smart payments 🛍️
* **QR Order Hiding**: Unpaid QR orders are now hidden from view 🔒
* **Payment Verification**: Use Service Role Key for secure payment verification 🔑
* **POS Realtime**: Get real-time updates on order items, plus connection debug logs 📊
* **KDS Unpaid Orders**: Hide unpaid online orders, and get debug logs for payment verification 🔍

### ⚡️ Improvements

* **Release Updates**: We've released v0.1.3, v0.1.2, and v0.1.1 to keep you on the bleeding edge 🚀


## v0.1.3 (2026-02-13)

**Changelog 📚**

### ✨ Features

* Enhanced POS with split payments, KDS realtime, and Razorpay edge function verification [bc6ce23]
* Implemented split payments and fixed zero amount bug [20bc80f]

### 🐛 Fixes

* Resolved zero payable bug and added smart payment modal with auto-fill and shortcuts [f4f1500]
* Strictly hid all unpaid QR orders [d610729]
* Enabled POS realtime for order items and added connection debug logs [823592d]
* Fixed KDS hiding unpaid online orders and added debug logs for payment verification [5016390]
* Fixed POS realtime auto-refresh and sound notification [83d0d9c]
* Used Service Role Key for payment verification to bypass RLS [dfa7c5f]

### ⚡️ Improvements

* Released v0.1.2 [60b843c]
* Released v0.1.1 [5f2be06]


## v0.1.2 (2026-02-13)

**Changelog 📣**
===============

**✨ New Features 🎉**
-------------------

* Enhance POS with split payments, KDS realtime, and Razorpay edge function verification 📈
* Implement split payments with zero amount bug fix 🤑

**🐛 Bug Fixes 🐜**
-------------------

* Resolve zero payable bug and add smart payment modal with auto-fill and shortcuts 📊
* Enable POS realtime for order items and add connection debug logs 🔍
* KDS hides unpaid QR orders and add debug logs for payment verification 🔒
* Fix POS Quick Bill button logic and active order payment 📝
* Fix POS realtime auto-refresh and sound notification 📣
* Use Service Role Key for payment verification to bypass RLS 🔑

**⚡️ Improvements 🔌**
----------------------

* Release v0.1.1 🚀


## v0.1.1 (2026-02-13)

### 🚀 New Release: Enhanced POS Experience 🎉

**✨ New Features:**

* **Split Payments**: Simplify transactions with split payments in POS 💸
* **Razorpay Edge Function Verification**: Secure payments with edge function verification 🔒
* **KDS Realtime**: Receive updates instantly with KDS realtime 📰
* **Smart Payment Modal**: Effortlessly fill payment details with auto-fill and shortcuts 📊

**🐛 Fixes:**

* Resolve zero payable bug and improve payment verification 🚫
* Hide unpaid QR orders and online orders in KDS 🔒
* Enable POS realtime for order items and add connection debug logs 📊
* Add debug logs for payment verification and fix KDS unpaid online orders 🔍
* Fix POS Quick Bill button logic and active order payment 📝
* Fix POS finalization button visibility and JSX cleanup 🛠️

**⚡️ Improvements:**

* Auto-refresh POS realtime and add sound notification for updates 📣
