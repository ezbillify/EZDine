-- Multi-restaurant + multi-branch ownership model
-- Run after 04_rls_core.sql

-- New role enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'restaurant_role_type') THEN
    CREATE TYPE restaurant_role_type AS ENUM ('owner','manager','viewer');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'branch_role_type') THEN
    CREATE TYPE branch_role_type AS ENUM ('cashier','waiter','kitchen','manager');
  END IF;
END
$$;

-- Restaurants updates
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS logo text,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Branches updates
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- User profiles: active restaurant
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS active_restaurant_id uuid REFERENCES restaurants(id);

-- New role tables
CREATE TABLE IF NOT EXISTS user_restaurant_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  role restaurant_role_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id)
);

CREATE INDEX IF NOT EXISTS user_restaurant_roles_user_id_idx ON user_restaurant_roles(user_id);
CREATE INDEX IF NOT EXISTS user_restaurant_roles_restaurant_id_idx ON user_restaurant_roles(restaurant_id);

CREATE TABLE IF NOT EXISTS user_branch_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  role branch_role_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS user_branch_roles_user_id_idx ON user_branch_roles(user_id);
CREATE INDEX IF NOT EXISTS user_branch_roles_branch_id_idx ON user_branch_roles(branch_id);

-- Helper views
CREATE OR REPLACE VIEW user_restaurant_access AS
SELECT
  urr.user_id,
  r.id AS restaurant_id,
  urr.role,
  r.name,
  r.logo
FROM user_restaurant_roles urr
JOIN restaurants r ON r.id = urr.restaurant_id;

CREATE OR REPLACE VIEW user_branch_access_v2 AS
SELECT
  ubr.user_id,
  b.restaurant_id,
  ubr.branch_id,
  ubr.role
FROM user_branch_roles ubr
JOIN branches b ON b.id = ubr.branch_id;

-- Updated helper functions with backward compatibility
CREATE OR REPLACE FUNCTION has_restaurant_role(rid uuid, roles restaurant_role_type[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_restaurant_roles urr
    WHERE urr.user_id = auth.uid()
      AND urr.restaurant_id = rid
      AND urr.role = ANY (roles)
  )
  OR EXISTS (
    SELECT 1 FROM user_restaurants ur
    WHERE ur.user_id = auth.uid()
      AND ur.restaurant_id = rid
      AND ur.role::text = ANY (SELECT unnest(roles)::text)
  );
$$;

-- Backward compatibility overload for existing policies using role_type[]
CREATE OR REPLACE FUNCTION has_restaurant_role(rid uuid, roles role_type[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT has_restaurant_role(
    rid,
    ARRAY(SELECT unnest(roles)::text::restaurant_role_type)
  );
$$;

CREATE OR REPLACE FUNCTION has_branch_role(bid uuid, roles branch_role_type[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_branch_roles ubr
    WHERE ubr.user_id = auth.uid()
      AND ubr.branch_id = bid
      AND ubr.role = ANY (roles)
  )
  OR EXISTS (
    SELECT 1 FROM user_branches ub
    WHERE ub.user_id = auth.uid()
      AND ub.branch_id = bid
      AND ub.role::text = ANY (SELECT unnest(roles)::text)
  );
$$;

-- Backward compatibility overload for existing policies using role_type[]
CREATE OR REPLACE FUNCTION has_branch_role(bid uuid, roles role_type[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT has_branch_role(
    bid,
    ARRAY(SELECT unnest(roles)::text::branch_role_type)
  );
$$;

-- Updated can_access_branch helper
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

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restaurants_set_updated_at ON restaurants;
CREATE TRIGGER restaurants_set_updated_at
BEFORE UPDATE ON restaurants
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS branches_set_updated_at ON branches;
CREATE TRIGGER branches_set_updated_at
BEFORE UPDATE ON branches
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
