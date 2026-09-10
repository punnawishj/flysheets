-- flysheets database schema for Supabase (Postgres)
-- Run this once in your project's SQL editor: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.

-- =========================================================
-- 1. PROFILES  (one row per signed-in user, extends auth.users)
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  is_seller boolean not null default false,
  bank_name text,
  bank_account_number text,
  bank_account_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone can read/update ONLY their own row. Bank details never leak to
-- other users this way -- listings/orders below store a copy of the
-- seller's display name so the UI never needs to query someone else's
-- profile row.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row the moment someone signs in with Google for
-- the first time, so the app never has to do it manually.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- 2. LISTINGS  (one PDF study sheet for sale)
-- =========================================================
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  seller_name text not null,
  title text not null,
  subject text not null default 'อื่นๆ',
  description text not null default '',
  price integer not null check (price >= 0),
  preview_path text,      -- storage path in the "previews" bucket (public)
  full_path text not null,-- storage path in the "full-files" bucket (private)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.listings enable row level security;

create policy "listings_select_active_or_own" on public.listings
  for select using (active = true or seller_id = auth.uid());
create policy "listings_insert_own" on public.listings
  for insert with check (seller_id = auth.uid());
create policy "listings_update_own" on public.listings
  for update using (seller_id = auth.uid());

-- =========================================================
-- 3. ORDERS  (one purchase; commission math is frozen at purchase time
--    so a later price change on the listing never rewrites history)
-- =========================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  listing_title text not null,
  full_path text not null,
  buyer_id uuid not null references public.profiles(id),
  buyer_name text not null,
  seller_id uuid not null references public.profiles(id),
  seller_name text not null,
  price integer not null,
  commission integer not null,       -- platform's 20% cut, in THB
  seller_amount integer not null,    -- seller's 80% cut, in THB
  status text not null default 'pending_payment'
    check (status in ('pending_payment','verifying','paid','rejected')),
  slip_path text,
  payout_status text not null default 'unpaid'
    check (payout_status in ('unpaid','paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  payout_at timestamptz
);

alter table public.orders enable row level security;

-- Buyers and sellers can each see the orders they're part of. Everything
-- past "insert" (uploading a slip, approving payment, marking a payout
-- paid) is deliberately NOT covered by an update policy here -- those
-- writes only happen inside server actions that re-check identity and
-- then use the service-role key. That keeps every state transition in
-- one auditable place instead of trusting the browser.
create policy "orders_select_participant" on public.orders
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "orders_insert_as_buyer" on public.orders
  for insert with check (auth.uid() = buyer_id);

create index if not exists orders_seller_idx on public.orders (seller_id);
create index if not exists orders_buyer_idx on public.orders (buyer_id);

-- =========================================================
-- 4. STORAGE BUCKETS
--    Create these three buckets first in Storage -> New bucket:
--      previews    (Public bucket: ON)
--      full-files  (Public bucket: OFF)
--      slips       (Public bucket: OFF)
--    Then run the policies below.
-- =========================================================

-- previews: anyone can view (buyers browsing the catalog); only signed-in
-- users can upload, into their own uid/ folder.
create policy "previews_public_read" on storage.objects
  for select using (bucket_id = 'previews');
create policy "previews_owner_upload" on storage.objects
  for insert with check (
    bucket_id = 'previews' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- full-files: NO select policy at all. Regular users -- including the
-- seller who owns the listing -- can never read this bucket directly;
-- the only way a file leaves it is a short-lived signed URL created by
-- a server action (using the service-role key) after it verifies the
-- requester's order is actually paid.
create policy "full_files_owner_upload" on storage.objects
  for insert with check (
    bucket_id = 'full-files' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- slips: buyers upload into their own folder; nobody can read them from
-- the browser -- only the admin server action (service-role key) reads
-- a slip to review it.
create policy "slips_owner_upload" on storage.objects
  for insert with check (
    bucket_id = 'slips' and (storage.foldername(name))[1] = auth.uid()::text
  );
