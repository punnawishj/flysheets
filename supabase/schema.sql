-- flysheets database schema for Supabase (Postgres)
-- Run this in your project's SQL editor: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once -- every "create table"/"create policy"/
-- "create trigger" below is guarded so re-running this script never
-- errors on things that already exist, it just fills in what's missing.

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
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
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

-- education_level ("มัธยม"/"มหาลัย") and grade_level ("ม.4"/"ปี 2") were
-- added after the first version of this table shipped -- both nullable
-- so existing listings posted before this feature just don't match any
-- of the browse-page category tabs instead of breaking.
alter table public.listings add column if not exists education_level text;
alter table public.listings add column if not exists grade_level text;

alter table public.listings enable row level security;

drop policy if exists "listings_select_active_or_own" on public.listings;
create policy "listings_select_active_or_own" on public.listings
  for select using (active = true or seller_id = auth.uid());
drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own" on public.listings
  for insert with check (seller_id = auth.uid());
drop policy if exists "listings_update_own" on public.listings;
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
drop policy if exists "orders_select_participant" on public.orders;
create policy "orders_select_participant" on public.orders
  for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
drop policy if exists "orders_insert_as_buyer" on public.orders;
create policy "orders_insert_as_buyer" on public.orders
  for insert with check (auth.uid() = buyer_id);

create index if not exists orders_seller_idx on public.orders (seller_id);
create index if not exists orders_buyer_idx on public.orders (buyer_id);

-- =========================================================
-- 4. CATEGORIES  (a 3-level tree: education level -> grade/year ->
--    subject -- e.g. มัธยม -> ม.4 -> ฟิสิกส์, or มหาลัย -> ปี 2 -> บัญชี.
--    Fully managed by the admin in /admin/categories.)
-- =========================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Upgrading an existing database from the earlier flat (single-level)
-- version of this table: add the self-reference column if it isn't
-- there yet.
alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete cascade;

alter table public.categories enable row level security;

-- Anyone (including signed-out visitors browsing the catalog) can read
-- the category tree -- there's nothing sensitive in a list of subject
-- names. There is deliberately NO insert/update/delete policy here: only
-- the admin's server actions can write to this table, using the
-- service-role client after checking the signed-in user's email against
-- ADMIN_EMAIL (see src/app/admin/categories/actions.ts) -- the same
-- pattern already used for approving orders and marking payouts paid.
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
  for select using (true);

-- `listings.education_level` / `grade_level` / `subject` store the
-- category NAMEs as plain text rather than foreign keys to this table on
-- purpose: if the admin later deletes, renames, or reorganizes a branch
-- of the tree, every listing already posted under it keeps showing its
-- original text instead of silently changing or breaking.

-- A plain "unique(name)" can't tell two different branches' children
-- apart (ม.4 and ปี 2 can each reasonably have their own "คณิตศาสตร์"
-- subject), and a plain "unique(parent_id, name)" doesn't work for the
-- two top-level nodes because Postgres treats every NULL as distinct
-- from every other NULL -- so top-level and non-top-level rows each get
-- their own partial unique index instead.
alter table public.categories drop constraint if exists categories_name_key;
drop index if exists categories_top_level_name_uniq;
create unique index categories_top_level_name_uniq on public.categories (name) where parent_id is null;
drop index if exists categories_child_name_uniq;
create unique index categories_child_name_uniq on public.categories (parent_id, name) where parent_id is not null;

-- Seed the tree -- all in one guarded block so the ordering between
-- "create the grade/year nodes" and "reparent old flat categories
-- somewhere sensible" is guaranteed, and every step is safe to run again
-- after the admin has made their own changes.
do $$
declare
  v_secondary_id uuid;
  v_university_id uuid;
  v_year1_id uuid;
  v_grade record;
  v_subject text;
  v_i integer;
  junior_subjects text[] := array['คณิตศาสตร์','วิทยาศาสตร์','ภาษาไทย','ภาษาอังกฤษ','สังคมศึกษา'];
  senior_subjects text[] := array['คณิตศาสตร์','ฟิสิกส์','เคมี','ชีววิทยา','ภาษาไทย','ภาษาอังกฤษ','สังคมศึกษา'];
  uni_subjects text[] := array['วิศวกรรมเหมืองแร่','วิศวกรรมโยธา','บัญชี','เศรษฐศาสตร์','นิติศาสตร์','สถิติ','คณิตศาสตร์','ภาษาอังกฤษ','รัฐศาสตร์','อื่นๆ'];
  known_grade_names text[] := array['ม.1','ม.2','ม.3','ม.4','ม.5','ม.6','ปี 1','ปี 2','ปี 3','ปี 4'];
begin
  -- 1. Ensure the two top-level education-level nodes exist.
  insert into public.categories (parent_id, name, sort_order)
  select null, v.name, v.sort_order
  from (values ('มัธยม', 0), ('มหาลัย', 1)) as v(name, sort_order)
  where not exists (select 1 from public.categories c where c.parent_id is null and c.name = v.name);

  select id into v_secondary_id from public.categories where parent_id is null and name = 'มัธยม';
  select id into v_university_id from public.categories where parent_id is null and name = 'มหาลัย';

  -- 2. Ensure the grade/year nodes exist under each, BEFORE touching any
  -- leftover old-schema rows below -- reparenting needs "ปี 1" to
  -- already exist.
  insert into public.categories (parent_id, name, sort_order)
  select v_secondary_id, g.name, g.sort_order
  from (values ('ม.1',0), ('ม.2',1), ('ม.3',2), ('ม.4',3), ('ม.5',4), ('ม.6',5)) as g(name, sort_order)
  where not exists (select 1 from public.categories where parent_id = v_secondary_id and name = g.name);

  insert into public.categories (parent_id, name, sort_order)
  select v_university_id, g.name, g.sort_order
  from (values ('ปี 1',0), ('ปี 2',1), ('ปี 3',2), ('ปี 4',3)) as g(name, sort_order)
  where not exists (select 1 from public.categories where parent_id = v_university_id and name = g.name);

  -- 3. Upgrading an existing database: any category from the OLD flat
  -- schema (a top-level row that isn't one of the two education-level
  -- nodes above -- i.e. the university subjects seeded by the previous
  -- version of this file, or anything the admin already added through
  -- /admin/categories) gets moved under "มหาลัย > ปี 1" instead of being
  -- deleted, so nothing is lost -- the admin can move it to a more
  -- specific year afterwards from the admin page. Once reparented, a
  -- row's parent_id is no longer null, so re-running this is a no-op.
  select id into v_year1_id from public.categories where parent_id = v_university_id and name = 'ปี 1';
  update public.categories
  set parent_id = v_year1_id
  where parent_id is null and name not in ('มัธยม', 'มหาลัย');

  -- 4. Seed each KNOWN grade/year's default subjects. Deliberately
  -- scoped to just the grade/year names this script itself creates --
  -- never every child of the education-level node -- so a custom grade
  -- the admin adds later, or an old-schema category that just got
  -- reparented in step 3 above, never gets a default subject list forced
  -- underneath it.
  for v_grade in
    select id, name from public.categories
    where parent_id = v_secondary_id and name = any(known_grade_names)
  loop
    v_i := 0;
    foreach v_subject in array (case when v_grade.name in ('ม.1','ม.2','ม.3') then junior_subjects else senior_subjects end) loop
      insert into public.categories (parent_id, name, sort_order)
      select v_grade.id, v_subject, v_i
      where not exists (select 1 from public.categories where parent_id = v_grade.id and name = v_subject);
      v_i := v_i + 1;
    end loop;
  end loop;

  for v_grade in
    select id, name from public.categories
    where parent_id = v_university_id and name = any(known_grade_names)
  loop
    v_i := 0;
    foreach v_subject in array uni_subjects loop
      insert into public.categories (parent_id, name, sort_order)
      select v_grade.id, v_subject, v_i
      where not exists (select 1 from public.categories where parent_id = v_grade.id and name = v_subject);
      v_i := v_i + 1;
    end loop;
  end loop;
end $$;

-- =========================================================
-- 5. STORAGE BUCKETS
--    Create these three buckets first in Storage -> New bucket:
--      previews    (Public bucket: ON)
--      full-files  (Public bucket: OFF)
--      slips       (Public bucket: OFF)
--    Then run the policies below.
-- =========================================================

-- previews: anyone can view (buyers browsing the catalog); only signed-in
-- users can upload, into their own uid/ folder.
drop policy if exists "previews_public_read" on storage.objects;
create policy "previews_public_read" on storage.objects
  for select using (bucket_id = 'previews');
drop policy if exists "previews_owner_upload" on storage.objects;
create policy "previews_owner_upload" on storage.objects
  for insert with check (
    bucket_id = 'previews' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- full-files: NO select policy at all. Regular users -- including the
-- seller who owns the listing -- can never read this bucket directly;
-- the only way a file leaves it is a short-lived signed URL created by
-- a server action (using the service-role key) after it verifies the
-- requester's order is actually paid.
drop policy if exists "full_files_owner_upload" on storage.objects;
create policy "full_files_owner_upload" on storage.objects
  for insert with check (
    bucket_id = 'full-files' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- slips: buyers upload into their own folder; nobody can read them from
-- the browser -- only the admin server action (service-role key) reads
-- a slip to review it.
drop policy if exists "slips_owner_upload" on storage.objects;
create policy "slips_owner_upload" on storage.objects
  for insert with check (
    bucket_id = 'slips' and (storage.foldername(name))[1] = auth.uid()::text
  );
