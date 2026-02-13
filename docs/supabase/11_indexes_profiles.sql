-- Add indexes for user_profiles email
-- Run after 10_profiles_rls.sql

CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles(email);
