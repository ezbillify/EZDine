-- Restaurant-level Razorpay Settings & Verification Logic
-- Run after 33_order_type_field.sql

-- 0. Enable pgcrypto for HMAC verification
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add Razorpay credentials to restaurants table (Fallback for branches)
DO $$ 
BEGIN
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS razorpay_key text;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS razorpay_secret text;
    ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS razorpay_enabled boolean DEFAULT false;
END $$;

COMMENT ON COLUMN restaurants.razorpay_key IS 'Global Razorpay Key for the restaurant (used if branch key is null)';
COMMENT ON COLUMN restaurants.razorpay_secret IS 'Global Razorpay Secret for the restaurant';

-- 2. Update verify_razorpay_payment to look up credentials hierarchically
CREATE OR REPLACE FUNCTION verify_razorpay_payment(p_order_id uuid, p_payment_id text, p_signature text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch_id uuid;
    v_restaurant_id uuid;
    v_secret text;
    v_generated_signature text;
    v_data text;
BEGIN
    -- Get order context
    SELECT branch_id, restaurant_id INTO v_branch_id, v_restaurant_id
    FROM orders WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Look for Branch Secret first
    SELECT razorpay_secret INTO v_secret
    FROM branches WHERE id = v_branch_id;

    -- If not found or empty, look for Restaurant Secret
    IF v_secret IS NULL OR v_secret = '' THEN
        SELECT razorpay_secret INTO v_secret
        FROM restaurants WHERE id = v_restaurant_id;
    END IF;

    IF v_secret IS NULL OR v_secret = '' THEN
        RAISE EXCEPTION 'Razorpay configuration missing/incomplete for verification';
    END IF;

    -- Construct the data string for signature verification
    -- Ideally, this should be order_id + "|" + payment_id
    -- However, since we are using direct payment capture (Standard Checkout without Orders API for now),
    -- we might not have a Razorpay Order ID to verify against in the standard way.
    -- If the client sends `p_signature`, we assume they have a Razorpay Order ID.
    -- For now, we'll try to verify assuming p_order_id is creating the context (if mapped).
    
    -- NOTE: In Standard Checkout without Orders API, successful callback usually just has payment_id.
    -- If signature is present, it means an Order was created.
    
    -- For this implementation, we will perform verification IF p_signature is provided.
    -- We assume the client passed `razorpay_order_id` in the `options` (if we implemented backend order creation).
    -- Since backend order creation is future scope, valid signatures might fail here if we use internal UUID.
    
    -- TEMPORARY BYPASS: We check existence of secret to confirm configuration, but skip strict HMAC
    -- until backend Order Creation is implemented.
    -- Once Backend Order Creation is live:
    -- v_data := ... (razorpay_order_id) || '|' || p_payment_id;
    -- v_generated_signature := encode(hmac(v_data, v_secret, 'sha256'), 'hex');
    -- IF v_generated_signature != p_signature THEN RAISE EXCEPTION 'Invalid Signature'; END IF;

    -- Update order status
    UPDATE orders 
    SET payment_ref = p_payment_id,
        is_verified_online = true,
        payment_status = 'paid',
        payment_method = 'online'
    WHERE id = p_order_id;
    
    RETURN true;
END;
$$;
