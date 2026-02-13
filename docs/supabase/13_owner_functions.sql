-- Owner functions for creating new restaurants with role assignment
-- Run after 12_settings_printing.sql

CREATE OR REPLACE FUNCTION create_restaurant_with_owner(
  restaurant_name text,
  logo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_restaurant_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO restaurants (name, logo, owner_user_id)
  VALUES (restaurant_name, logo_url, auth.uid())
  RETURNING id INTO new_restaurant_id;

  INSERT INTO user_restaurant_roles (user_id, restaurant_id, role)
  VALUES (auth.uid(), new_restaurant_id, 'owner');

  RETURN new_restaurant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_restaurant_with_owner(text, text) TO authenticated;
