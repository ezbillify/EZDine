-- Add branch_id to menu categories and items for branch-level management
-- This aligns Menu management with Tables management

ALTER TABLE menu_categories
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE CASCADE;

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS menu_categories_branch_id_idx ON menu_categories(branch_id);
CREATE INDEX IF NOT EXISTS menu_items_branch_id_idx ON menu_items(branch_id);

-- Using can_access_branch helper for robust security
DROP POLICY IF EXISTS "menu_categories_select" ON menu_categories;
DROP POLICY IF EXISTS "menu_categories_all" ON menu_categories;
CREATE POLICY "menu_categories_all" ON menu_categories
FOR ALL USING (can_access_branch(branch_id));

DROP POLICY IF EXISTS "menu_items_select" ON menu_items;
DROP POLICY IF EXISTS "menu_items_all" ON menu_items;
CREATE POLICY "menu_items_all" ON menu_items
FOR ALL USING (can_access_branch(branch_id));
