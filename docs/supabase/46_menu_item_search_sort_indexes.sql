-- Indexes to optimize search and sorting by name and price
CREATE INDEX IF NOT EXISTS menu_items_name_idx ON menu_items (name);
CREATE INDEX IF NOT EXISTS menu_items_base_price_idx ON menu_items (base_price);
