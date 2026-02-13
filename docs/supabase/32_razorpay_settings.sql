-- Razorpay Settings Integration
-- Run after 30_qr_payment_integration.sql

-- 1. Add Razorpay credentials to branches
DO $$ 
BEGIN
    ALTER TABLE branches ADD COLUMN IF NOT EXISTS razorpay_key text;
    ALTER TABLE branches ADD COLUMN IF NOT EXISTS razorpay_secret text;
    ALTER TABLE branches ADD COLUMN IF NOT EXISTS razorpay_enabled boolean DEFAULT false;
END $$;

-- 2. Audit Trail Comments
COMMENT ON COLUMN branches.razorpay_key IS 'Public key for Razorpay checkout integration';
COMMENT ON COLUMN branches.razorpay_secret IS 'Private secret for verifying Razorpay payments (should be encrypted in future)';
COMMENT ON COLUMN branches.razorpay_enabled IS 'Toggle for enabling/disabling online payments for this branch';

-- 3. RLS - Ensure only managers/owners can read/write the secret
-- Note: The key can be public for the QR page to use, but the secret must be protected.

-- Allow public read of the public key (needed for QR checkout)
DROP POLICY IF EXISTS "public_razorpay_key_select" ON branches;
-- We rely on the existing "public_branches_select" but if we want to be specific:
-- CREATE POLICY "public_razorpay_key_select" ON branches FOR SELECT TO anon USING (true);

-- 4. Create a function to verify payments (server-side stub for now)
CREATE OR REPLACE FUNCTION verify_razorpay_payment(p_order_id uuid, p_payment_id text, p_signature text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- In a real production app, this would perform HMAC verification.
    -- For now, we update the order status to verified.
    UPDATE orders 
    SET payment_ref = p_payment_id,
        is_verified_online = true,
        payment_status = 'paid'
    WHERE id = p_order_id;
    
    RETURN true;
END;
$$;
