-- Purchase and Vendor Management Module
-- Tables for tracking raw material procurement

-- Vendors / Suppliers
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  gst_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vendors_restaurant_id_idx on vendors(restaurant_id);

-- Purchase Orders / Invoices
create type purchase_status as enum ('draft', 'ordered', 'received', 'cancelled');

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  vendor_id uuid not null references vendors(id),
  order_number text not null,
  invoice_number text,
  status purchase_status not null default 'draft',
  total_amount numeric(10,2) not null default 0,
  notes text,
  order_date date not null default current_date,
  received_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, order_number)
);
create index if not exists purchase_orders_branch_id_idx on purchase_orders(branch_id);

-- Purchase Order Items
create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity numeric(10,2) not null default 0,
  unit_price numeric(10,2) not null default 0,
  total_price numeric(10,2) not null default 0
);
create index if not exists purchase_items_order_id_idx on purchase_items(purchase_order_id);

-- Trigger to update inventory stock when purchase is 'received'
create or replace function handle_purchase_received()
returns trigger as $$
begin
  if (NEW.status = 'received' and (OLD.status is null or OLD.status != 'received')) then
    -- Loop through items and update stock
    insert into stock_movements (restaurant_id, branch_id, inventory_item_id, change_qty, reason)
    select 
      NEW.restaurant_id, 
      NEW.branch_id, 
      inventory_item_id, 
      quantity, 
      'Purchase Order: ' || NEW.order_number
    from purchase_items
    where purchase_order_id = NEW.id;

    -- Update inventory_items current_stock
    update inventory_items
    set current_stock = current_stock + items.quantity
    from (
      select inventory_item_id, quantity
      from purchase_items
      where purchase_order_id = NEW.id
    ) as items
    where id = items.inventory_item_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger on_purchase_received
  after update on purchase_orders
  for each row
  execute function handle_purchase_received();

-- RLS Policies (Simplistic for now, similar to others)
alter table vendors enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_items enable row level security;

-- Vendors: Same as customers
create policy "Vendors are viewable by restaurant members"
  on vendors for select
  using ( restaurant_id in (select active_restaurant_id from user_profiles where id = auth.uid()) );

create policy "Vendors are manageable by managers/owners"
  on vendors for all
  using ( restaurant_id in (select active_restaurant_id from user_profiles where id = auth.uid()) );

-- Purchase Orders: Same as orders
create policy "Purchase orders viewable by branch members"
  on purchase_orders for select
  using ( branch_id in (select active_branch_id from user_profiles where id = auth.uid()) );

create policy "Purchase orders manageable by managers/owners"
  on purchase_orders for all
  using ( branch_id in (select active_branch_id from user_profiles where id = auth.uid()) );

-- Purchase Items: Joint
create policy "Purchase items viewable by branch members"
  on purchase_items for select
  using ( purchase_order_id in (select id from purchase_orders) );

create policy "Purchase items manageable by branch members"
  on purchase_items for all
  using ( purchase_order_id in (select id from purchase_orders) );
