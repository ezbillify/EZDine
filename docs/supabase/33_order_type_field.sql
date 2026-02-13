-- Add order_type column to orders table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_type_new') THEN
        CREATE TYPE order_type_new AS ENUM ('dine_in', 'takeaway');
    END IF;
    
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type text DEFAULT 'dine_in';
END $$;

COMMENT ON COLUMN orders.order_type IS 'Explicitly track if the order is Dine-in or Takeaway';
