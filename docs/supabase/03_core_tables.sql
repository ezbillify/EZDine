-- Core module tables for EZDine
-- Run after 02_bootstrap.sql

-- Tables / seating
create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  capacity integer not null default 4,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists tables_branch_id_idx on tables(branch_id);

-- Menu
create table if not exists menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists menu_categories_restaurant_id_idx on menu_categories(restaurant_id);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  base_price numeric(10,2) not null default 0,
  gst_rate integer not null default 5,
  is_veg boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists menu_items_restaurant_id_idx on menu_items(restaurant_id);
create index if not exists menu_items_category_id_idx on menu_items(category_id);

create table if not exists menu_item_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  is_active boolean not null default true
);
create index if not exists menu_item_variants_item_id_idx on menu_item_variants(item_id);

create table if not exists menu_addons (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  is_active boolean not null default true
);
create index if not exists menu_addons_restaurant_id_idx on menu_addons(restaurant_id);

create table if not exists menu_item_addons (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items(id) on delete cascade,
  addon_id uuid not null references menu_addons(id) on delete cascade
);
create index if not exists menu_item_addons_item_id_idx on menu_item_addons(item_id);

create table if not exists menu_item_availability (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  is_available boolean not null default true
);
create index if not exists menu_item_availability_branch_id_idx on menu_item_availability(branch_id);

-- Orders
create type order_status as enum ('pending','preparing','ready','served','cancelled');

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  table_id uuid references tables(id) on delete set null,
  status order_status not null default 'pending',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_branch_id_idx on orders(branch_id);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_id uuid not null references menu_items(id),
  variant_id uuid references menu_item_variants(id),
  quantity integer not null default 1,
  price numeric(10,2) not null default 0,
  notes text
);
create index if not exists order_items_order_id_idx on order_items(order_id);

-- Billing
create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  tax numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists bills_branch_id_idx on bills(branch_id);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  mode text not null,
  amount numeric(10,2) not null default 0,
  reference text,
  created_at timestamptz not null default now()
);
create index if not exists payments_bill_id_idx on payments(bill_id);

-- Customers
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  phone text,
  name text,
  email text,
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now(),
  unique (restaurant_id, phone)
);
create index if not exists customers_restaurant_id_idx on customers(restaurant_id);

-- Inventory
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  name text not null,
  unit text not null,
  current_stock numeric(10,2) not null default 0,
  reorder_level numeric(10,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists inventory_items_branch_id_idx on inventory_items(branch_id);

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  item_id uuid not null references menu_items(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists recipes_restaurant_id_idx on recipes(restaurant_id);

create table if not exists recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity numeric(10,2) not null default 0
);
create index if not exists recipe_items_recipe_id_idx on recipe_items(recipe_id);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  change_qty numeric(10,2) not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_branch_id_idx on stock_movements(branch_id);

-- Expenses
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  category text not null,
  amount numeric(10,2) not null default 0,
  note text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists expenses_branch_id_idx on expenses(branch_id);

-- Reports snapshot
create table if not exists report_snapshots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  report_date date not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists report_snapshots_branch_id_idx on report_snapshots(branch_id);

-- Audit logs
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid references branches(id) on delete set null,
  actor_id uuid references auth.users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_restaurant_id_idx on audit_logs(restaurant_id);
