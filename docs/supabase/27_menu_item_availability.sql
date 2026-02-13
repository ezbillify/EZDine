-- Menu Item Availability (Out of Stock)
-- Run after 26_pos_token_system.sql

-- 1. Add is_available column to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;

-- 2. Index for filtering active/available items
CREATE INDEX IF NOT EXISTS menu_items_branch_available_idx ON menu_items (branch_id, is_active, is_available);

-- 3. Comment for documentation
COMMENT ON COLUMN menu_items.is_available IS 'Toggle to mark items as out of stock/unavailable for ordering';
