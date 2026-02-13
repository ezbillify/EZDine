-- RLS for core module tables
-- Run after 03_core_tables.sql

alter table tables enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table menu_item_variants enable row level security;
alter table menu_addons enable row level security;
alter table menu_item_addons enable row level security;
alter table menu_item_availability enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table bills enable row level security;
alter table payments enable row level security;
alter table customers enable row level security;
alter table inventory_items enable row level security;
alter table recipes enable row level security;
alter table recipe_items enable row level security;
alter table stock_movements enable row level security;
alter table expenses enable row level security;
alter table report_snapshots enable row level security;
alter table audit_logs enable row level security;

-- Helper: branch access
create or replace function can_access_branch(bid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from branches b
    where b.id = bid
      and (
        has_restaurant_role(b.restaurant_id, array['owner','manager']::role_type[])
        or has_branch_role(bid, array['owner','manager','cashier','waiter','kitchen']::role_type[])
      )
  );
$$;

-- Tables
create policy "tables_select" on tables
for select using (can_access_branch(branch_id));

create policy "tables_insert" on tables
for insert with check (can_access_branch(branch_id));

create policy "tables_update" on tables
for update using (can_access_branch(branch_id));

create policy "tables_delete" on tables
for delete using (can_access_branch(branch_id));

-- Menu (restaurant scope)
create policy "menu_categories_select" on menu_categories
for select using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "menu_categories_insert" on menu_categories
for insert with check (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "menu_categories_update" on menu_categories
for update using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "menu_categories_delete" on menu_categories
for delete using (has_restaurant_role(restaurant_id, array['owner']::role_type[]));

create policy "menu_items_select" on menu_items
for select using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "menu_items_insert" on menu_items
for insert with check (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "menu_items_update" on menu_items
for update using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "menu_items_delete" on menu_items
for delete using (has_restaurant_role(restaurant_id, array['owner']::role_type[]));

create policy "menu_item_variants_select" on menu_item_variants
for select using (
  exists (
    select 1 from menu_items mi
    where mi.id = item_id
      and has_restaurant_role(mi.restaurant_id, array['owner','manager']::role_type[])
  )
);

create policy "menu_item_variants_insert" on menu_item_variants
for insert with check (
  exists (
    select 1 from menu_items mi
    where mi.id = item_id
      and has_restaurant_role(mi.restaurant_id, array['owner','manager']::role_type[])
  )
);

create policy "menu_item_variants_update" on menu_item_variants
for update using (
  exists (
    select 1 from menu_items mi
    where mi.id = item_id
      and has_restaurant_role(mi.restaurant_id, array['owner','manager']::role_type[])
  )
);

create policy "menu_item_variants_delete" on menu_item_variants
for delete using (
  exists (
    select 1 from menu_items mi
    where mi.id = item_id
      and has_restaurant_role(mi.restaurant_id, array['owner']::role_type[])
  )
);

create policy "menu_addons_select" on menu_addons
for select using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "menu_addons_insert" on menu_addons
for insert with check (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "menu_addons_update" on menu_addons
for update using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "menu_addons_delete" on menu_addons
for delete using (has_restaurant_role(restaurant_id, array['owner']::role_type[]));

create policy "menu_item_addons_select" on menu_item_addons
for select using (
  exists (
    select 1 from menu_items mi
    where mi.id = item_id
      and has_restaurant_role(mi.restaurant_id, array['owner','manager']::role_type[])
  )
);

create policy "menu_item_addons_insert" on menu_item_addons
for insert with check (
  exists (
    select 1 from menu_items mi
    where mi.id = item_id
      and has_restaurant_role(mi.restaurant_id, array['owner','manager']::role_type[])
  )
);

create policy "menu_item_addons_delete" on menu_item_addons
for delete using (
  exists (
    select 1 from menu_items mi
    where mi.id = item_id
      and has_restaurant_role(mi.restaurant_id, array['owner','manager']::role_type[])
  )
);

create policy "menu_item_availability_select" on menu_item_availability
for select using (can_access_branch(branch_id));

create policy "menu_item_availability_insert" on menu_item_availability
for insert with check (can_access_branch(branch_id));

create policy "menu_item_availability_update" on menu_item_availability
for update using (can_access_branch(branch_id));

create policy "menu_item_availability_delete" on menu_item_availability
for delete using (can_access_branch(branch_id));

-- Orders
create policy "orders_select" on orders
for select using (can_access_branch(branch_id));

create policy "orders_insert" on orders
for insert with check (can_access_branch(branch_id));

create policy "orders_update" on orders
for update using (can_access_branch(branch_id));

create policy "orders_delete" on orders
for delete using (has_restaurant_role(restaurant_id, array['owner']::role_type[]));

create policy "order_items_select" on order_items
for select using (
  exists (select 1 from orders o where o.id = order_id and can_access_branch(o.branch_id))
);

create policy "order_items_insert" on order_items
for insert with check (
  exists (select 1 from orders o where o.id = order_id and can_access_branch(o.branch_id))
);

create policy "order_items_update" on order_items
for update using (
  exists (select 1 from orders o where o.id = order_id and can_access_branch(o.branch_id))
);

create policy "order_items_delete" on order_items
for delete using (
  exists (select 1 from orders o where o.id = order_id and can_access_branch(o.branch_id))
);

-- Bills + payments
create policy "bills_select" on bills
for select using (can_access_branch(branch_id));

create policy "bills_insert" on bills
for insert with check (can_access_branch(branch_id));

create policy "bills_update" on bills
for update using (can_access_branch(branch_id));

create policy "bills_delete" on bills
for delete using (has_restaurant_role(restaurant_id, array['owner']::role_type[]));

create policy "payments_select" on payments
for select using (
  exists (select 1 from bills b where b.id = bill_id and can_access_branch(b.branch_id))
);

create policy "payments_insert" on payments
for insert with check (
  exists (select 1 from bills b where b.id = bill_id and can_access_branch(b.branch_id))
);

create policy "payments_update" on payments
for update using (
  exists (select 1 from bills b where b.id = bill_id and can_access_branch(b.branch_id))
);

create policy "payments_delete" on payments
for delete using (
  exists (select 1 from bills b where b.id = bill_id and can_access_branch(b.branch_id))
);

-- Customers (restaurant scope)
create policy "customers_select" on customers
for select using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "customers_insert" on customers
for insert with check (has_restaurant_role(restaurant_id, array['owner','manager','cashier']::role_type[]));

create policy "customers_update" on customers
for update using (has_restaurant_role(restaurant_id, array['owner','manager','cashier']::role_type[]));

create policy "customers_delete" on customers
for delete using (has_restaurant_role(restaurant_id, array['owner']::role_type[]));

-- Inventory + recipes
create policy "inventory_items_select" on inventory_items
for select using (can_access_branch(branch_id));

create policy "inventory_items_insert" on inventory_items
for insert with check (can_access_branch(branch_id));

create policy "inventory_items_update" on inventory_items
for update using (can_access_branch(branch_id));

create policy "inventory_items_delete" on inventory_items
for delete using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "recipes_select" on recipes
for select using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "recipes_insert" on recipes
for insert with check (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "recipes_update" on recipes
for update using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "recipes_delete" on recipes
for delete using (has_restaurant_role(restaurant_id, array['owner']::role_type[]));

create policy "recipe_items_select" on recipe_items
for select using (
  exists (
    select 1 from recipes r
    where r.id = recipe_id
      and has_restaurant_role(r.restaurant_id, array['owner','manager']::role_type[])
  )
);

create policy "recipe_items_insert" on recipe_items
for insert with check (
  exists (
    select 1 from recipes r
    where r.id = recipe_id
      and has_restaurant_role(r.restaurant_id, array['owner','manager']::role_type[])
  )
);

create policy "recipe_items_update" on recipe_items
for update using (
  exists (
    select 1 from recipes r
    where r.id = recipe_id
      and has_restaurant_role(r.restaurant_id, array['owner','manager']::role_type[])
  )
);

create policy "recipe_items_delete" on recipe_items
for delete using (
  exists (
    select 1 from recipes r
    where r.id = recipe_id
      and has_restaurant_role(r.restaurant_id, array['owner']::role_type[])
  )
);

create policy "stock_movements_select" on stock_movements
for select using (can_access_branch(branch_id));

create policy "stock_movements_insert" on stock_movements
for insert with check (can_access_branch(branch_id));

create policy "stock_movements_delete" on stock_movements
for delete using (has_restaurant_role(restaurant_id, array['owner']::role_type[]));

-- Expenses
create policy "expenses_select" on expenses
for select using (can_access_branch(branch_id));

create policy "expenses_insert" on expenses
for insert with check (can_access_branch(branch_id));

create policy "expenses_update" on expenses
for update using (can_access_branch(branch_id));

create policy "expenses_delete" on expenses
for delete using (has_restaurant_role(restaurant_id, array['owner']::role_type[]));

-- Reports snapshots
create policy "report_snapshots_select" on report_snapshots
for select using (can_access_branch(branch_id));

create policy "report_snapshots_insert" on report_snapshots
for insert with check (can_access_branch(branch_id));

create policy "report_snapshots_update" on report_snapshots
for update using (can_access_branch(branch_id));

-- Audit logs (owners/managers only)
create policy "audit_logs_select" on audit_logs
for select using (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));

create policy "audit_logs_insert" on audit_logs
for insert with check (has_restaurant_role(restaurant_id, array['owner','manager']::role_type[]));
