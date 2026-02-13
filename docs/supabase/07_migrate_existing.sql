-- Migrate existing single-restaurant data into new role tables
-- Run after 06_rls_multi_restaurant.sql

-- Copy restaurant roles from old table
INSERT INTO user_restaurant_roles (user_id, restaurant_id, role)
SELECT
  user_id,
  restaurant_id,
  CASE
    WHEN role::text = 'owner' THEN 'owner'::restaurant_role_type
    WHEN role::text = 'manager' THEN 'manager'::restaurant_role_type
    ELSE 'viewer'::restaurant_role_type
  END
FROM user_restaurants
ON CONFLICT (user_id, restaurant_id) DO NOTHING;

-- Copy branch roles from old table
INSERT INTO user_branch_roles (user_id, branch_id, role)
SELECT
  user_id,
  branch_id,
  CASE
    WHEN role::text = 'manager' THEN 'manager'::branch_role_type
    WHEN role::text = 'cashier' THEN 'cashier'::branch_role_type
    WHEN role::text = 'waiter' THEN 'waiter'::branch_role_type
    ELSE 'kitchen'::branch_role_type
  END
FROM user_branches
ON CONFLICT (user_id, branch_id) DO NOTHING;

-- Set active restaurant for users
UPDATE user_profiles up
SET active_restaurant_id = ur.restaurant_id
FROM user_restaurants ur
WHERE up.id = ur.user_id
  AND up.active_restaurant_id IS NULL;

-- Set owner_user_id for restaurants
UPDATE restaurants r
SET owner_user_id = ur.user_id
FROM user_restaurants ur
WHERE ur.restaurant_id = r.id
  AND ur.role::text = 'owner'
  AND r.owner_user_id IS NULL;
