-- EZDine Supabase Schema (Part 2)
-- Run this first.

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Core enums
create type role_type as enum ('owner', 'manager', 'cashier', 'waiter', 'kitchen');
create type role_scope as enum ('restaurant', 'branch');

-- Restaurants and branches
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  gst_number text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  code text,
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists branches_restaurant_id_idx on branches(restaurant_id);

-- User profile linked to auth.users
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  is_active boolean not null default true,
  active_branch_id uuid references branches(id),
  created_at timestamptz not null default now()
);

-- Membership at restaurant scope (owner/admin/manager can see all branches)
create table if not exists user_restaurants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  role role_type not null,
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

create index if not exists user_restaurants_user_id_idx on user_restaurants(user_id);
create index if not exists user_restaurants_restaurant_id_idx on user_restaurants(restaurant_id);

-- Membership at branch scope (cashier/waiter/kitchen limited to a branch)
create table if not exists user_branches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  role role_type not null,
  created_at timestamptz not null default now(),
  unique (user_id, branch_id)
);

create index if not exists user_branches_user_id_idx on user_branches(user_id);
create index if not exists user_branches_branch_id_idx on user_branches(branch_id);

-- Helper view for branch membership
create or replace view user_branch_access as
select
  ub.user_id,
  b.restaurant_id,
  ub.branch_id,
  ub.role
from user_branches ub
join branches b on b.id = ub.branch_id;

-- Functions for RLS checks
create or replace function has_restaurant_role(rid uuid, roles role_type[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from user_restaurants ur
    where ur.user_id = auth.uid()
      and ur.restaurant_id = rid
      and ur.role = any (roles)
  );
$$;

create or replace function has_branch_role(bid uuid, roles role_type[])
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from user_branches ub
    where ub.user_id = auth.uid()
      and ub.branch_id = bid
      and ub.role = any (roles)
  );
$$;

-- Upsert profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into user_profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute procedure handle_new_user();
