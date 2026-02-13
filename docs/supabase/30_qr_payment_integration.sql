-- QR Payment Integration and POS Enhancements
-- Run after 28_public_qr_access.sql

-- 1. Update orders table with payment and delivery metadata
DO $$ 
BEGIN
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash', 'online'));
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref text;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_verified_online boolean DEFAULT false;
END $$;

-- 2. Index for quicker lookup of verified orders
CREATE INDEX IF NOT EXISTS orders_verification_idx ON orders (branch_id, is_verified_online, created_at);

-- 3. Update RLS policies to allow public orders to set these fields
-- We need to ensure the INSERT policy allows these new columns (already does via 'CHECK (true)')
-- But for clarity and future-proofing, we ensure the anon user can see and set them.

-- 4. Audit Trail / Tracking for payment changes
COMMENT ON COLUMN orders.payment_method IS 'Customer choice: cash at counter or online payment';
COMMENT ON COLUMN orders.payment_ref IS 'Reference/Transaction ID for online payments';
COMMENT ON COLUMN orders.is_verified_online IS 'Flag for online payments that have been confirmed by the system';
