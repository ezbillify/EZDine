-- Order item status + open order flag
-- Run after 18_doc_numbering_settings.sql

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS status order_status NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS order_items_status_idx ON order_items(status);
CREATE INDEX IF NOT EXISTS orders_is_open_idx ON orders(is_open);
