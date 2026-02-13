-- Guest Management: Reservations & Waitlist (Line Tokens)

-- Safe Enum Creation
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE reservation_status AS ENUM ('confirmed', 'seated', 'cancelled', 'no_show');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waitlist_status') THEN
        CREATE TYPE waitlist_status AS ENUM ('waiting', 'notified', 'seated', 'cancelled');
    END IF;
END$$;

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  table_id uuid references tables(id) on delete set null,
  customer_name text not null,
  phone text not null,
  party_size integer not null default 2,
  reservation_time timestamptz not null,
  status reservation_status not null default 'confirmed',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reservations_branch_time_idx on reservations(branch_id, reservation_time);

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  customer_name text not null,
  phone text not null,
  party_size integer not null default 2,
  token_number integer not null,
  status waitlist_status not null default 'waiting',
  notes text,
  estimated_wait_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists waitlist_branch_status_idx on waitlist(branch_id, status);

-- Function to get next token number for waitlist (Resets at Midnight IST)
create or replace function next_waitlist_token(p_branch_id uuid)
returns integer as $$
declare
  v_token integer;
  v_today date;
begin
  -- Calculate today's date in IST
  v_today := (timezone('Asia/Kolkata', now()))::date;

  select coalesce(max(token_number), 0) + 1 into v_token
  from waitlist
  where branch_id = p_branch_id
    and (timezone('Asia/Kolkata', created_at))::date = v_today;
    
  return v_token;
end;
$$ language plpgsql;

-- RLS
alter table reservations enable row level security;
alter table waitlist enable row level security;

-- Using can_access_branch helper for robust security
drop policy if exists "reservations_select" on reservations;
create policy "reservations_select" on reservations
for select using (can_access_branch(branch_id));

drop policy if exists "reservations_all" on reservations;
create policy "reservations_all" on reservations
for all using (can_access_branch(branch_id));

drop policy if exists "waitlist_select" on waitlist;
create policy "waitlist_select" on waitlist
for select using (can_access_branch(branch_id));

drop policy if exists "waitlist_all" on waitlist;
create policy "waitlist_all" on waitlist
for all using (can_access_branch(branch_id));
