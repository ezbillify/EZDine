-- Settings table for per-restaurant/branch configuration (printing etc.)
-- Run after 11_indexes_profiles.sql

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, branch_id, key)
);

CREATE INDEX IF NOT EXISTS settings_restaurant_id_idx ON settings(restaurant_id);
CREATE INDEX IF NOT EXISTS settings_branch_id_idx ON settings(branch_id);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select" ON settings
FOR SELECT USING (can_access_branch(branch_id));

CREATE POLICY "settings_insert" ON settings
FOR INSERT WITH CHECK (can_access_branch(branch_id));

CREATE POLICY "settings_update" ON settings
FOR UPDATE USING (can_access_branch(branch_id));

CREATE POLICY "settings_delete" ON settings
FOR DELETE USING (has_restaurant_role(restaurant_id, array['owner','manager']::restaurant_role_type[]));

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION set_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS settings_set_updated_at ON settings;
CREATE TRIGGER settings_set_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE PROCEDURE set_settings_updated_at();
