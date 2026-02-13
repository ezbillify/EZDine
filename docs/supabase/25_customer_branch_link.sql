-- Revert to restaurant-wide access for customers
-- We keep the column for potential future use but relax the RLS policy.
-- Improved Policy: allow access if the user is a MEMBER of the restaurant,
-- rather than relying on the prone-to-desync 'active_restaurant_id' field.

DROP POLICY IF EXISTS "customers_all" ON customers;

CREATE POLICY "customers_all" ON customers
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_restaurants ur
    WHERE ur.user_id = auth.uid()
    AND ur.restaurant_id = customers.restaurant_id
  )
  OR
  -- Fallback for branch-only users (staff) who might not be in user_restaurants directly
  EXISTS (
    SELECT 1 FROM user_branches ub
    JOIN branches b ON b.id = ub.branch_id
    WHERE ub.user_id = auth.uid()
    AND b.restaurant_id = customers.restaurant_id
  )
);
