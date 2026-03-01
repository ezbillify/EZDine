# Supabase Schema Setup for EZDine Printing System

## Issue
The web printing system is failing with "Failed to save settings: {}" because the required Supabase tables and functions are not set up.

## Required Schema Files

You need to run these SQL files in your Supabase SQL editor in the correct order:

### Core Setup (Required)
1. `docs/supabase/00_schema.sql` - Basic schema
2. `docs/supabase/01_rls.sql` - Row Level Security setup
3. `docs/supabase/02_bootstrap.sql` - Bootstrap data
4. `docs/supabase/03_core_tables.sql` - Core tables (restaurants, branches, etc.)
5. `docs/supabase/04_rls_core.sql` - Core RLS policies + `can_access_branch` function
6. `docs/supabase/05_multi_restaurant.sql` - Multi-restaurant support + updated `can_access_branch`

### Settings Table (Critical for Printing)
7. `docs/supabase/12_settings_printing.sql` - **THIS IS THE KEY FILE FOR PRINTING**

### User Profiles (Required for Context)
8. `docs/supabase/09_user_profiles_email.sql` - User profiles
9. `docs/supabase/10_profiles_rls.sql` - Profile RLS
10. `docs/supabase/11_indexes_profiles.sql` - Profile indexes

## Quick Setup Instructions

### Option 1: Run Individual Files
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste each file content in the order listed above
4. Run each query

### Option 2: Key Files Only (Minimum Setup)
If you want to get printing working quickly, run these essential files:

```sql
-- 1. First, ensure you have the basic restaurant/branch structure
-- Run: 03_core_tables.sql

-- 2. Set up the access control function
-- Run: 04_rls_core.sql (contains can_access_branch function)

-- 3. Set up user profiles
-- Run: 09_user_profiles_email.sql

-- 4. Set up the settings table (CRITICAL)
-- Run: 12_settings_printing.sql
```

## Verify Setup

After running the schema, verify with these queries:

```sql
-- Check if settings table exists
SELECT * FROM information_schema.tables WHERE table_name = 'settings';

-- Check if can_access_branch function exists
SELECT * FROM information_schema.routines WHERE routine_name = 'can_access_branch';

-- Check if user_profiles table exists
SELECT * FROM information_schema.tables WHERE table_name = 'user_profiles';

-- Test settings table structure
\d settings;
```

## Expected Settings Table Structure

```sql
CREATE TABLE settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, branch_id, key)
);
```

## User Profile Requirements

The printing system requires users to have:
1. An active restaurant selected (`active_restaurant_id`)
2. An active branch selected (`active_branch_id`)

These are set in the `user_profiles` table.

## Troubleshooting

### Error: "No restaurant selected"
- User needs to select a restaurant in their profile
- Check: `SELECT * FROM user_profiles WHERE id = 'user-id';`

### Error: "No branch selected"  
- User needs to select a branch in their profile
- The branch must belong to the selected restaurant

### Error: "Failed to save settings"
- Verify the `settings` table exists
- Verify the `can_access_branch` function exists
- Check RLS policies are properly set up

### Error: "Function can_access_branch does not exist"
- Run `04_rls_core.sql` and `05_multi_restaurant.sql`

## Next Steps After Setup

1. **Create a Restaurant**: Use the restaurant manager in the web app
2. **Create a Branch**: Use the branch manager in the web app  
3. **Set Active Restaurant/Branch**: In user profile settings
4. **Configure Printer Settings**: Go to Settings > Printing Setup
5. **Test Printing**: Use the "Test Server" and "Test Print" buttons

## Files Location
All SQL files are in the `docs/supabase/` directory of your project.