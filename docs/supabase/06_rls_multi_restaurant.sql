-- RLS updates for multi-restaurant roles
-- Run after 05_multi_restaurant.sql

ALTER TABLE user_restaurant_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_roles ENABLE ROW LEVEL SECURITY;

-- Replace restaurant policies
DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE policyname = 'restaurants_select';
  IF FOUND THEN EXECUTE 'DROP POLICY "restaurants_select" ON restaurants'; END IF;
  PERFORM 1 FROM pg_policies WHERE policyname = 'restaurants_insert';
  IF FOUND THEN EXECUTE 'DROP POLICY "restaurants_insert" ON restaurants'; END IF;
  PERFORM 1 FROM pg_policies WHERE policyname = 'restaurants_update';
  IF FOUND THEN EXECUTE 'DROP POLICY "restaurants_update" ON restaurants'; END IF;
  PERFORM 1 FROM pg_policies WHERE policyname = 'restaurants_delete';
  IF FOUND THEN EXECUTE 'DROP POLICY "restaurants_delete" ON restaurants'; END IF;
END
$$;

CREATE POLICY "restaurants_select" ON restaurants
FOR SELECT USING (
  has_restaurant_role(id, array['owner','manager','viewer']::restaurant_role_type[])
  OR EXISTS (
    SELECT 1 FROM branches b
    JOIN user_branch_roles ubr ON ubr.branch_id = b.id
    WHERE b.restaurant_id = restaurants.id
      AND ubr.user_id = auth.uid()
  )
);

CREATE POLICY "restaurants_insert" ON restaurants
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "restaurants_update" ON restaurants
FOR UPDATE USING (
  has_restaurant_role(id, array['owner','manager']::restaurant_role_type[])
);

CREATE POLICY "restaurants_delete" ON restaurants
FOR DELETE USING (
  has_restaurant_role(id, array['owner']::restaurant_role_type[])
);

-- Replace branches policies
DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE policyname = 'branches_select';
  IF FOUND THEN EXECUTE 'DROP POLICY "branches_select" ON branches'; END IF;
  PERFORM 1 FROM pg_policies WHERE policyname = 'branches_insert';
  IF FOUND THEN EXECUTE 'DROP POLICY "branches_insert" ON branches'; END IF;
  PERFORM 1 FROM pg_policies WHERE policyname = 'branches_update';
  IF FOUND THEN EXECUTE 'DROP POLICY "branches_update" ON branches'; END IF;
  PERFORM 1 FROM pg_policies WHERE policyname = 'branches_delete';
  IF FOUND THEN EXECUTE 'DROP POLICY "branches_delete" ON branches'; END IF;
END
$$;

CREATE POLICY "branches_select" ON branches
FOR SELECT USING (
  has_restaurant_role(restaurant_id, array['owner','manager','viewer']::restaurant_role_type[])
  OR has_branch_role(id, array['manager','cashier','waiter','kitchen']::branch_role_type[])
);

CREATE POLICY "branches_insert" ON branches
FOR INSERT WITH CHECK (
  has_restaurant_role(restaurant_id, array['owner','manager']::restaurant_role_type[])
);

CREATE POLICY "branches_update" ON branches
FOR UPDATE USING (
  has_restaurant_role(restaurant_id, array['owner','manager']::restaurant_role_type[])
);

CREATE POLICY "branches_delete" ON branches
FOR DELETE USING (
  has_restaurant_role(restaurant_id, array['owner']::restaurant_role_type[])
);

-- Profiles select/update already exist; add insert policy if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'profiles_insert'
  ) THEN
    CREATE POLICY "profiles_insert" ON user_profiles
    FOR INSERT WITH CHECK (id = auth.uid());
  END IF;
END
$$;

-- User restaurant roles
CREATE POLICY "user_restaurant_roles_select" ON user_restaurant_roles
FOR SELECT USING (
  user_id = auth.uid()
  OR has_restaurant_role(restaurant_id, array['owner','manager']::restaurant_role_type[])
);

CREATE POLICY "user_restaurant_roles_insert" ON user_restaurant_roles
FOR INSERT WITH CHECK (
  has_restaurant_role(restaurant_id, array['owner']::restaurant_role_type[])
);

CREATE POLICY "user_restaurant_roles_update" ON user_restaurant_roles
FOR UPDATE USING (
  has_restaurant_role(restaurant_id, array['owner']::restaurant_role_type[])
);

CREATE POLICY "user_restaurant_roles_delete" ON user_restaurant_roles
FOR DELETE USING (
  has_restaurant_role(restaurant_id, array['owner']::restaurant_role_type[])
);

-- User branch roles
CREATE POLICY "user_branch_roles_select" ON user_branch_roles
FOR SELECT USING (
  user_id = auth.uid()
  OR has_restaurant_role(
    (SELECT b.restaurant_id FROM branches b WHERE b.id = branch_id),
    array['owner','manager']::restaurant_role_type[]
  )
);

CREATE POLICY "user_branch_roles_insert" ON user_branch_roles
FOR INSERT WITH CHECK (
  has_restaurant_role(
    (SELECT b.restaurant_id FROM branches b WHERE b.id = branch_id),
    array['owner','manager']::restaurant_role_type[]
  )
);

CREATE POLICY "user_branch_roles_update" ON user_branch_roles
FOR UPDATE USING (
  has_restaurant_role(
    (SELECT b.restaurant_id FROM branches b WHERE b.id = branch_id),
    array['owner','manager']::restaurant_role_type[]
  )
);

CREATE POLICY "user_branch_roles_delete" ON user_branch_roles
FOR DELETE USING (
  has_restaurant_role(
    (SELECT b.restaurant_id FROM branches b WHERE b.id = branch_id),
    array['owner','manager']::restaurant_role_type[]
  )
);
