-- Missing Functions and Policies for Settings Table
-- Run this after creating the settings table

-- 1. Create the updated timestamp function (if not exists)
CREATE OR REPLACE FUNCTION set_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Create role types (if not exists)
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

-- 3. Create helper functions for role checking
CREATE OR REPLACE FUNCTION has_restaurant_role(rid uuid, roles restaurant_role_type[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
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
$$;

CREATE OR REPLACE FUNCTION has_branch_role(bid uuid, roles branch_role_type[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_branch_roles ubr
    WHERE ubr.branch_id = bid
      AND ubr.user_id = auth.uid()
      AND ubr.role = ANY(roles)
  );
$$;

-- 4. Create the critical can_access_branch function
CREATE OR REPLACE FUNCTION can_access_branch(bid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM branches b
    WHERE b.id = bid
      AND (
        has_restaurant_role(b.restaurant_id, array['owner','manager']::restaurant_role_type[])
        OR has_branch_role(bid, array['manager','cashier','waiter','kitchen']::branch_role_type[])
      )
  );
$$;

-- 5. Enable RLS on settings table
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for settings table
DROP POLICY IF EXISTS "settings_select" ON settings;
CREATE POLICY "settings_select" ON settings
FOR SELECT USING (can_access_branch(branch_id));

DROP POLICY IF EXISTS "settings_insert" ON settings;
CREATE POLICY "settings_insert" ON settings
FOR INSERT WITH CHECK (can_access_branch(branch_id));

DROP POLICY IF EXISTS "settings_update" ON settings;
CREATE POLICY "settings_update" ON settings
FOR UPDATE USING (can_access_branch(branch_id));

DROP POLICY IF EXISTS "settings_delete" ON settings;
CREATE POLICY "settings_delete" ON settings
FOR DELETE USING (has_restaurant_role(restaurant_id, array['owner','manager']::restaurant_role_type[]));

-- 7. Create user role tables (if they don't exist)
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

-- 8. Ensure user_profiles table exists with required columns
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

-- 9. Enable RLS on user tables
ALTER TABLE user_restaurant_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 10. Create basic policies for user tables
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles
FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles
FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
CREATE POLICY "user_profiles_insert" ON user_profiles
FOR INSERT WITH CHECK (id = auth.uid());

-- 11. Verification queries
SELECT 'Settings table exists' as status 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings');

SELECT 'can_access_branch function exists' as status 
WHERE EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'can_access_branch');

SELECT 'user_profiles table exists' as status 
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles');

-- Check if you have any restaurants
SELECT COUNT(*) as restaurant_count FROM restaurants;

-- Check if you have any branches  
SELECT COUNT(*) as branch_count FROM branches;