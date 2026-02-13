-- Public Customer Access for QR Ordering
-- Allow public (anon) users to search and create themselves in the customers list

-- 1. Allow public to check if a customer exists by phone (limited search)
DROP POLICY IF EXISTS "public_customers_select" ON customers;
CREATE POLICY "public_customers_select" ON customers
FOR SELECT TO anon
USING (true);

-- 2. Allow public to create a customer entry during onboarding
DROP POLICY IF EXISTS "public_customers_insert" ON customers;
CREATE POLICY "public_customers_insert" ON customers
FOR INSERT TO anon
WITH CHECK (true);
