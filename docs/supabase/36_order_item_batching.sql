-- Add batch_id to order_items for KDS separation
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS batch_id uuid DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS order_items_batch_id_idx ON order_items(batch_id);

-- Update existing items to have a batch_id if they don't (though default gen_random_uuid() handles new inserts)
-- For existing rows, we might want to group them by order_id if we were doing a big migration, 
-- but for now the default is fine for new data.
