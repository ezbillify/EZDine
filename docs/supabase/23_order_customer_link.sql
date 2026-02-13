-- Add customer_id to orders table
alter table orders 
  add column if not exists customer_id uuid references customers(id) on delete set null;

create index if not exists orders_customer_id_idx on orders(customer_id);
