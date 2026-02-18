-- Add is_egg to menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_egg BOOLEAN NOT NULL DEFAULT false;
