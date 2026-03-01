-- Quick Setup for EZDine Printing System
-- Run this in your Supabase SQL Editor

-- 1. Create basic restaurant/branch structure (if not exists)
CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo text,
  owner_user_id uuid,
  legal_name text,
  gst_number text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  gstin text,
  fssai_no text,
  is_active boolean NOT NULL DEFAULT true,
  razorpay_key text,
  razorpay_secret text,
  razorpay_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create user profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  active_restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  active_branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create role types (if not exists)
DO $$ BEGIN
  CREATE TYPE restaurant_role_type AS ENUM ('owner', 'manager');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE branch_role_type AS ENUM ('manager', 'cashier', 'waiter', 'kitchen');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Create role tables
CREATE TABLE IF NOT EXISTS user_restaurant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role restaurant_role_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);

CREATE TABLE IF NOT EXISTS user_branch_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  role branch_role_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

-- 5. Create helper functions
CREATE OR REPLACE FUNCTION has_restaurant_role(rid uuid, roles restaurant_role_type[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $
  SELECT EXISTS (
    SELECT 1
    FROM user_restaurant_roles urr
    WHERE urr.restaurant_id = rid
      AND urr.user_id = auth.uid()
      AND urr.role = ANY(roles)
  ) OR EXISTS (
    SELECT 1
    FROM restaurants r
    WHERE r.id = rid
      AND r.owner_user_id = auth.uid()
  );
$;

CREATE OR REPLACE FUNCTION has_branch_role(bid uuid, roles branch_role_type[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $
  SELECT EXISTS (
    SELECT 1
    FROM user_branch_roles ubr
    WHERE ubr.branch_id = bid
      AND ubr.user_id = auth.uid()
      AND ubr.role = ANY(roles)
  );
$;

CREATE OR REPLACE FUNCTION can_access_branch(bid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $
  SELECT EXISTS (
    SELECT 1
    FROM branches b
    WHERE b.id = bid
      AND (
        has_restaurant_role(b.restaurant_id, array['owner','manager']::restaurant_role_type[])
        OR has_branch_role(bid, array['manager','cashier','waiter','kitchen']::branch_role_type[])
      )
  );
$;

-- 6. Create the settings table (CRITICAL FOR PRINTING)
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

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS settings_restaurant_id_idx ON settings(restaurant_id);
CREATE INDEX IF NOT EXISTS settings_branch_id_idx ON settings(branch_id);

-- 8. Enable RLS
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restaurant_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS policies for settings table
CREATE POLICY "settings_select" ON settings
FOR SELECT USING (can_access_branch(branch_id));

CREATE POLICY "settings_insert" ON settings
FOR INSERT WITH CHECK (can_access_branch(branch_id));

CREATE POLICY "settings_update" ON settings
FOR UPDATE USING (can_access_branch(branch_id));

CREATE POLICY "settings_delete" ON settings
FOR DELETE USING (has_restaurant_role(restaurant_id, array['owner','manager']::restaurant_role_type[]));

-- 10. Create basic RLS policies for other tables
CREATE POLICY "restaurants_select" ON restaurants
FOR SELECT USING (has_restaurant_role(id, array['owner','manager']::restaurant_role_type[]));

CREATE POLICY "branches_select" ON branches
FOR SELECT USING (can_access_branch(id));

CREATE POLICY "user_profiles_select" ON user_profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE USING (id = auth.uid());

-- 11. Create updated timestamp trigger for settings
CREATE OR REPLACE FUNCTION set_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS settings_set_updated_at ON settings;
CREATE TRIGGER settings_set_updated_at
BEFORE UPDATE ON settings
FOR EACH ROW EXECUTE PROCEDURE set_settings_updated_at();

-- 12. Insert a sample restaurant and branch (optional)
-- Uncomment and modify these if you want sample data
/*
INSERT INTO restaurants (name, owner_user_id) 
VALUES ('Sample Restaurant', auth.uid()) 
ON CONFLICT DO NOTHING;

INSERT INTO branches (restaurant_id, name) 
SELECT id, 'Main Branch' 
FROM restaurants 
WHERE name = 'Sample Restaurant' 
ON CONFLICT DO NOTHING;
*/

-- Verification queries (run these to check setup)
-- SELECT 'Settings table created' as status WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings');
-- SELECT 'Functions created' as status WHERE EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'can_access_branch');
-- SELECT COUNT(*) as restaurant_count FROM restaurants;
-- SELECT COUNT(*) as branch_count FROM branches;