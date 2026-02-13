-- Performance indexes for restaurant_id and branch_id
-- Run after 07_migrate_existing.sql

CREATE INDEX IF NOT EXISTS orders_restaurant_id_idx ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS orders_branch_id_idx ON orders(branch_id);

CREATE INDEX IF NOT EXISTS bills_restaurant_id_idx ON bills(restaurant_id);
CREATE INDEX IF NOT EXISTS bills_branch_id_idx ON bills(branch_id);

CREATE INDEX IF NOT EXISTS inventory_items_restaurant_id_idx ON inventory_items(restaurant_id);
CREATE INDEX IF NOT EXISTS inventory_items_branch_id_idx ON inventory_items(branch_id);

CREATE INDEX IF NOT EXISTS expenses_restaurant_id_idx ON expenses(restaurant_id);
CREATE INDEX IF NOT EXISTS expenses_branch_id_idx ON expenses(branch_id);

CREATE INDEX IF NOT EXISTS report_snapshots_restaurant_id_idx ON report_snapshots(restaurant_id);
CREATE INDEX IF NOT EXISTS report_snapshots_branch_id_idx ON report_snapshots(branch_id);

CREATE INDEX IF NOT EXISTS customers_restaurant_id_idx ON customers(restaurant_id);

CREATE INDEX IF NOT EXISTS tables_restaurant_id_idx ON tables(restaurant_id);
CREATE INDEX IF NOT EXISTS tables_branch_id_idx ON tables(branch_id);
