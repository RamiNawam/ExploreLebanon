-- Lebanon Adventure — shared pin storage.
-- Paste this whole file into the Supabase dashboard → SQL Editor → Run.
-- Safe to re-run.
--
-- ACCESS: the map is private to the accounts you create in
-- Authentication → Users. Reading and writing pins both require a signed-in
-- session, enforced here by Postgres — not by the app — so the rules hold even
-- if someone calls the API directly with the publishable key.
--
-- One deliberate exception: the photo bucket stays public-readable, so <img>
-- tags work without minting signed URLs. Filenames are random UUIDs, so a
-- picture is only reachable by someone who already has its exact URL. Uploads
-- and deletes still require a session.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Pins
-- ---------------------------------------------------------------------------

create table if not exists public.pins (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('adventure', 'todo')),
  name         text not null,
  description  text not null default '',
  date         date,
  lat          double precision not null,
  lng          double precision not null,
  governorate  text not null default '',
  cover        jsonb,
  photos       jsonb not null default '[]'::jsonb,
  done         boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists pins_created_at_idx on public.pins (created_at desc);

alter table public.pins enable row level security;

-- Drop the old open-to-the-world policies if this database ever had them.
drop policy if exists "pins are public"      on public.pins;
drop policy if exists "anyone can add"       on public.pins;
drop policy if exists "anyone can edit"      on public.pins;
drop policy if exists "anyone can delete"    on public.pins;
drop policy if exists "signed in can read"   on public.pins;
drop policy if exists "signed in can add"    on public.pins;
drop policy if exists "signed in can edit"   on public.pins;
drop policy if exists "signed in can delete" on public.pins;

-- Everyone with an account shares one map, so any signed-in user may edit any
-- pin. Anonymous requests match no policy at all and see nothing.
create policy "signed in can read"   on public.pins for select to authenticated using (true);
create policy "signed in can add"    on public.pins for insert to authenticated with check (true);
create policy "signed in can edit"   on public.pins for update to authenticated
  using (true) with check (true);
create policy "signed in can delete" on public.pins for delete to authenticated using (true);

-- Live updates, so a pin added on someone's phone appears on everyone's map.
do $$
begin
  alter publication supabase_realtime add table public.pins;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Trusted devices
--
-- Each browser generates an id on first sign-in and records itself here, which
-- is what makes the device list meaningful. The session itself is what keeps
-- you signed in; this table is the visible, revocable record of it.
-- ---------------------------------------------------------------------------

create table if not exists public.devices (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  label      text not null default '',
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);

create index if not exists devices_user_idx on public.devices (user_id, last_seen desc);

alter table public.devices enable row level security;

drop policy if exists "own devices only" on public.devices;

-- A user sees and revokes only their own devices.
create policy "own devices only" on public.devices for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Picture storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('pin-photos', 'pin-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "photos are public"           on storage.objects;
drop policy if exists "anyone can upload photos"    on storage.objects;
drop policy if exists "anyone can delete photos"    on storage.objects;
drop policy if exists "signed in can upload photos" on storage.objects;
drop policy if exists "signed in can delete photos" on storage.objects;

create policy "photos are public"
  on storage.objects for select
  using (bucket_id = 'pin-photos');

create policy "signed in can upload photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'pin-photos');

create policy "signed in can delete photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'pin-photos');
