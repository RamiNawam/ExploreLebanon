-- Lebanon Adventure — shared pin storage.
-- Paste this whole file into the Supabase dashboard → SQL Editor → Run.
--
-- NOTE ON ACCESS: this is a fully open map, by design. Anyone who has the site
-- URL can add, edit and delete any pin, and photo uploads are unauthenticated.
-- That is what makes it a no-sign-in collab; it also means a stranger who finds
-- the link could wipe the map. Keep the URL among friends.

create extension if not exists "pgcrypto";

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

drop policy if exists "pins are public"       on public.pins;
drop policy if exists "anyone can add"        on public.pins;
drop policy if exists "anyone can edit"       on public.pins;
drop policy if exists "anyone can delete"     on public.pins;

create policy "pins are public"   on public.pins for select using (true);
create policy "anyone can add"    on public.pins for insert with check (true);
create policy "anyone can edit"   on public.pins for update using (true) with check (true);
create policy "anyone can delete" on public.pins for delete using (true);

-- Live updates, so a pin added on someone's phone appears on everyone's map.
-- (Safe to re-run: adding a table twice would otherwise error.)
do $$
begin
  alter publication supabase_realtime add table public.pins;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Picture storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('pin-photos', 'pin-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "photos are public"        on storage.objects;
drop policy if exists "anyone can upload photos" on storage.objects;
drop policy if exists "anyone can delete photos" on storage.objects;

create policy "photos are public"
  on storage.objects for select
  using (bucket_id = 'pin-photos');

create policy "anyone can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'pin-photos');

create policy "anyone can delete photos"
  on storage.objects for delete
  using (bucket_id = 'pin-photos');
