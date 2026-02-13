-- Update profile RLS to use new restaurant role table
-- Run after 09_user_profiles_email.sql

DO $$
BEGIN
  PERFORM 1 FROM pg_policies WHERE policyname = 'profiles_select';
  IF FOUND THEN EXECUTE 'DROP POLICY "profiles_select" ON user_profiles'; END IF;
END
$$;

CREATE POLICY "profiles_select" ON user_profiles
FOR SELECT USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_restaurant_roles urr
    WHERE urr.user_id = auth.uid()
      AND urr.role IN ('owner','manager')
  )
  OR EXISTS (
    SELECT 1 FROM user_restaurants ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('owner','manager')
  )
);
