-- Enable realtime for orders and order_items
begin;
  -- Add tables to publication if not already added
  -- This is idempotent usually but good to be explicit
  alter publication supabase_realtime add table orders;
  alter publication supabase_realtime add table order_items;
commit;
