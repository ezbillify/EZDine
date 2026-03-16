-- Add is_featured column to menu_items table
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Add index for is_featured to optimize sorting/filtering
CREATE INDEX IF NOT EXISTS idx_menu_items_is_featured ON menu_items (is_featured) WHERE is_featured = true;

-- Optional: Mark some items as featured for testing (Replace UUIDs with real ones)
-- UPDATE menu_items SET is_featured = true WHERE id IN ('uuid1', 'uuid2');

COMMENT ON COLUMN menu_items.is_featured IS 'Whether the item is featured or frequently bought, to be displayed at the top of the POS menu.';
