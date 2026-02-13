-- Fix: allow profile insert for new users (OTP signup)

-- Policy for insert on user_profiles (self)
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

-- Ensure trigger function has explicit search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
