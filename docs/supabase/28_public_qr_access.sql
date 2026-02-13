-- Public Access for QR Ordering
-- Allow unauthenticated (anon) users to read menu and branding data

-- 1. Restaurants: Allow public read-only access for branding info
DROP POLICY IF EXISTS "public_restaurants_select" ON restaurants;
CREATE POLICY "public_restaurants_select" ON restaurants
FOR SELECT TO anon
USING (true);

-- 2. Branches: Allow public read-only access for branch contact/branding info
DROP POLICY IF EXISTS "public_branches_select" ON branches;
CREATE POLICY "public_branches_select" ON branches
FOR SELECT TO anon
USING (true);

-- 3. Menu Categories: Allow public read-only access
DROP POLICY IF EXISTS "public_menu_categories_select" ON menu_categories;
CREATE POLICY "public_menu_categories_select" ON menu_categories
FOR SELECT TO anon
USING (true);

-- 4. Menu Items: Allow public read-only access
DROP POLICY IF EXISTS "public_menu_items_select" ON menu_items;
CREATE POLICY "public_menu_items_select" ON menu_items
FOR SELECT TO anon
USING (true);

-- 5. Orders: Allow public order creation (needed for QR checkout)
DROP POLICY IF EXISTS "public_orders_insert" ON orders;
CREATE POLICY "public_orders_insert" ON orders
FOR INSERT TO anon
WITH CHECK (true);

-- 6. Orders: Allow public order reading (needed for the success screen/token)
DROP POLICY IF EXISTS "public_orders_select" ON orders;
CREATE POLICY "public_orders_select" ON orders
FOR SELECT TO anon
USING (true);

-- 7. Order Items: Allow public creation and reading
DROP POLICY IF EXISTS "public_order_items_insert" ON order_items;
CREATE POLICY "public_order_items_insert" ON order_items
FOR INSERT TO anon
WITH CHECK (true);

DROP POLICY IF EXISTS "public_order_items_select" ON order_items;
CREATE POLICY "public_order_items_select" ON order_items
FOR SELECT TO anon
USING (true);
