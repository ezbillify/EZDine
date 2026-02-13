-- Fix stack depth recursion by bypassing RLS inside role check functions
-- Run after 15_audit_logs_role_changes.sql

CREATE OR REPLACE FUNCTION has_restaurant_role(rid uuid, roles restaurant_role_type[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
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
END;
$$;

CREATE OR REPLACE FUNCTION has_restaurant_role(rid uuid, roles role_type[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN has_restaurant_role(
    rid,
    ARRAY(SELECT unnest(roles)::text::restaurant_role_type)
  );
END;
$$;

CREATE OR REPLACE FUNCTION has_branch_role(bid uuid, roles branch_role_type[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN EXISTS (
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
END;
$$;

CREATE OR REPLACE FUNCTION has_branch_role(bid uuid, roles role_type[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = off
AS $$
BEGIN
  RETURN has_branch_role(
    bid,
    ARRAY(SELECT unnest(roles)::text::branch_role_type)
  );
END;
$$;
