-- EZDine RLS Policies (Part 2)
-- Run this after 00_schema.sql

-- Enable RLS
alter table restaurants enable row level security;
alter table branches enable row level security;
alter table user_profiles enable row level security;
alter table user_restaurants enable row level security;
alter table user_branches enable row level security;

-- Restaurants: owners/managers at restaurant scope can read/write
create policy "restaurants_select" on restaurants
for select using (
  has_restaurant_role(id, array['owner','manager']::role_type[])
);

create policy "restaurants_insert" on restaurants
for insert with check (
  auth.role() = 'authenticated'
);

create policy "restaurants_update" on restaurants
for update using (
  has_restaurant_role(id, array['owner','manager']::role_type[])
);

create policy "restaurants_delete" on restaurants
for delete using (
  has_restaurant_role(id, array['owner']::role_type[])
);

-- Branches: restaurant-level roles can see all branches; branch roles can see their branch
create policy "branches_select" on branches
for select using (
  has_restaurant_role(restaurant_id, array['owner','manager']::role_type[])
  or has_branch_role(id, array['cashier','waiter','kitchen','manager','owner']::role_type[])
);

create policy "branches_insert" on branches
for insert with check (
  has_restaurant_role(restaurant_id, array['owner','manager']::role_type[])
);

create policy "branches_update" on branches
for update using (
  has_restaurant_role(restaurant_id, array['owner','manager']::role_type[])
);

create policy "branches_delete" on branches
for delete using (
  has_restaurant_role(restaurant_id, array['owner']::role_type[])
);

-- User profiles: users can read/update themselves; owners/managers can read staff
create policy "profiles_select" on user_profiles
for select using (
  id = auth.uid()
  or exists (
    select 1
    from user_restaurants ur
    where ur.user_id = auth.uid()
      and ur.role in ('owner','manager')
  )
);

create policy "profiles_update" on user_profiles
for update using (
  id = auth.uid()
);

-- User_restaurants: only owners can manage, managers can read
create policy "user_restaurants_select" on user_restaurants
for select using (
  has_restaurant_role(restaurant_id, array['owner','manager']::role_type[])
);

create policy "user_restaurants_insert" on user_restaurants
for insert with check (
  has_restaurant_role(restaurant_id, array['owner']::role_type[])
);

create policy "user_restaurants_update" on user_restaurants
for update using (
  has_restaurant_role(restaurant_id, array['owner']::role_type[])
);

create policy "user_restaurants_delete" on user_restaurants
for delete using (
  has_restaurant_role(restaurant_id, array['owner']::role_type[])
);

-- User_branches: restaurant owners/managers can manage; users can read own membership
create policy "user_branches_select" on user_branches
for select using (
  user_id = auth.uid()
  or has_restaurant_role(
    (select b.restaurant_id from branches b where b.id = branch_id),
    array['owner','manager']::role_type[]
  )
);

create policy "user_branches_insert" on user_branches
for insert with check (
  has_restaurant_role(
    (select b.restaurant_id from branches b where b.id = branch_id),
    array['owner','manager']::role_type[]
  )
);

create policy "user_branches_update" on user_branches
for update using (
  has_restaurant_role(
    (select b.restaurant_id from branches b where b.id = branch_id),
    array['owner','manager']::role_type[]
  )
);

create policy "user_branches_delete" on user_branches
for delete using (
  has_restaurant_role(
    (select b.restaurant_id from branches b where b.id = branch_id),
    array['owner','manager']::role_type[]
  )
);
