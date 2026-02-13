-- Transfer restaurant ownership
-- Run after 13_owner_functions.sql

CREATE OR REPLACE FUNCTION transfer_restaurant_owner(
  restaurant_id uuid,
  new_owner_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  current_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT has_restaurant_role(restaurant_id, array['owner']::restaurant_role_type[]) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT owner_user_id INTO current_owner FROM restaurants WHERE id = restaurant_id;

  UPDATE restaurants
  SET owner_user_id = new_owner_user_id
  WHERE id = restaurant_id;

  -- Demote all current owners to manager
  UPDATE user_restaurant_roles
  SET role = 'manager'
  WHERE restaurant_id = transfer_restaurant_owner.restaurant_id
    AND role = 'owner';

  -- Promote new owner
  INSERT INTO user_restaurant_roles (user_id, restaurant_id, role)
  VALUES (new_owner_user_id, transfer_restaurant_owner.restaurant_id, 'owner')
  ON CONFLICT (user_id, restaurant_id)
  DO UPDATE SET role = 'owner';

  -- Legacy table update for backward compatibility
  UPDATE user_restaurants
  SET role = 'manager'
  WHERE restaurant_id = transfer_restaurant_owner.restaurant_id
    AND role::text = 'owner';

  INSERT INTO user_restaurants (user_id, restaurant_id, role)
  VALUES (new_owner_user_id, transfer_restaurant_owner.restaurant_id, 'owner')
  ON CONFLICT (user_id, restaurant_id)
  DO UPDATE SET role = 'owner';
END;
$$;

GRANT EXECUTE ON FUNCTION transfer_restaurant_owner(uuid, uuid) TO authenticated;
