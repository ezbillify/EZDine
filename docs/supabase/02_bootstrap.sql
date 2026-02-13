-- Bootstrap function to create first restaurant + branch + owner assignment
-- Run this after 01_rls.sql

create or replace function bootstrap_restaurant(
  restaurant_name text,
  branch_name text,
  city text default null,
  state text default null
)
returns table (restaurant_id uuid, branch_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_restaurant_id uuid;
  new_branch_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into restaurants (name, owner_user_id)
  values (restaurant_name, auth.uid())
  returning id into new_restaurant_id;

  insert into branches (restaurant_id, name, city, state)
  values (new_restaurant_id, branch_name, city, state)
  returning id into new_branch_id;

  insert into user_restaurants (user_id, restaurant_id, role)
  values (auth.uid(), new_restaurant_id, 'owner');

  insert into user_branches (user_id, branch_id, role)
  values (auth.uid(), new_branch_id, 'owner');

  insert into user_restaurant_roles (user_id, restaurant_id, role)
  values (auth.uid(), new_restaurant_id, 'owner');

  insert into user_branch_roles (user_id, branch_id, role)
  values (auth.uid(), new_branch_id, 'manager');

  update user_profiles
  set active_restaurant_id = new_restaurant_id,
      active_branch_id = new_branch_id
  where id = auth.uid();

  restaurant_id := new_restaurant_id;
  branch_id := new_branch_id;
  return next;
end;
$$;

grant execute on function bootstrap_restaurant(text, text, text, text) to authenticated;
