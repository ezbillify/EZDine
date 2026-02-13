-- Fix RLS for customers: allow anyone with branch access to manage customers
-- This fixes the "invalid input value for enum cashier" error by using the correct helpers

drop policy if exists "customers_select" on customers;
create policy "customers_select" on customers
for select using (
  exists (
    select 1 from branches b
    where b.restaurant_id = customers.restaurant_id
      and can_access_branch(b.id)
  )
);

drop policy if exists "customers_insert" on customers;
create policy "customers_insert" on customers
for insert with check (
  exists (
    select 1 from branches b
    where b.restaurant_id = customers.restaurant_id
      and can_access_branch(b.id)
  )
);

drop policy if exists "customers_update" on customers;
create policy "customers_update" on customers
for update using (
  exists (
    select 1 from branches b
    where b.restaurant_id = customers.restaurant_id
      and can_access_branch(b.id)
  )
);

drop policy if exists "customers_delete" on customers;
create policy "customers_delete" on customers
for delete using (
  exists (
    select 1 from branches b
    where b.restaurant_id = customers.restaurant_id
      and has_restaurant_role(b.restaurant_id, array['owner','manager']::restaurant_role_type[])
  )
);
