-- POS Token System and QR Ordering Updates
-- Run after 25_customer_branch_link.sql

-- 1. Update orders table with metadata for tokens and sources
DO $$ 
BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS token_number integer;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text DEFAULT 'pos' CHECK (source IN ('pos', 'table', 'qr'));
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'counter_pending'));
END $$;

-- 2. Index for token lookups (especially for today's tokens)
CREATE INDEX IF NOT EXISTS orders_branch_token_idx ON orders (branch_id, token_number, created_at);

-- 3. Token Generation Function (Daily reset per branch)
CREATE OR REPLACE FUNCTION next_token_number(p_branch_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today timestamp with time zone := date_trunc('day', now());
    v_next_token integer;
BEGIN
    -- Get the max token for today at this branch and increment
    -- Using range comparison to avoid IMMUTABLE issues with index
    SELECT COALESCE(MAX(token_number), 0) + 1 INTO v_next_token
    FROM orders
    WHERE branch_id = p_branch_id
      AND created_at >= v_today;

    -- Optional: Cyclic reset if it hits 999 or similar, but daily is usually enough
    IF v_next_token > 9999 THEN
        v_next_token := 1;
    END IF;

    RETURN v_next_token;
END;
$$;

-- 4. Grant access
GRANT EXECUTE ON FUNCTION next_token_number(uuid) TO authenticated;

-- 5. Add Comment for documentation
COMMENT ON COLUMN orders.token_number IS 'Daily resetting sequence number for easy kitchen/customer calling';
COMMENT ON COLUMN orders.source IS 'Where the order originated: POS, QR at table, or QR general';
COMMENT ON COLUMN orders.payment_status IS 'Tracks if a QR order is paid online or pending cashier settlement';
