-- ============================================
-- SIMPLE NOTES - SUPABASE SCHEMA
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================

-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ─────────────────────────────────────────────
-- PROFILES (extends auth.users)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_emoji text default '🧑',
  theme        text default 'auto' check (theme in ('auto','light','dark')),
  auto_save    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─────────────────────────────────────────────
-- FOLDERS
-- ─────────────────────────────────────────────
create table if not exists public.folders (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text default '#007AFF',
  icon       text default '📁',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists folders_user_id_idx on public.folders(user_id);


-- ─────────────────────────────────────────────
-- NOTES
-- ─────────────────────────────────────────────
create table if not exists public.notes (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  folder_id     uuid references public.folders(id) on delete set null,
  title         text not null default 'Untitled Note',
  content       text default '',
  tags          text[] default '{}',
  encrypted     boolean default false,
  line_spacing  text default '1.6',
  time_spent    integer default 0,       -- seconds
  word_count    integer default 0,
  is_deleted    boolean default false,   -- soft-delete (trash)
  deleted_at    timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists notes_user_id_idx      on public.notes(user_id);
create index if not exists notes_folder_id_idx    on public.notes(folder_id);
create index if not exists notes_is_deleted_idx   on public.notes(is_deleted);
create index if not exists notes_updated_at_idx   on public.notes(updated_at desc);


-- ─────────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at  before update on public.profiles  for each row execute procedure public.set_updated_at();
create trigger set_folders_updated_at   before update on public.folders   for each row execute procedure public.set_updated_at();
create trigger set_notes_updated_at     before update on public.notes     for each row execute procedure public.set_updated_at();


-- ─────────────────────────────────────────────
-- AUTO-PURGE TRASH (30 days)
-- ─────────────────────────────────────────────
create or replace function public.purge_old_trash()
returns void language plpgsql security definer as $$
begin
  delete from public.notes
  where is_deleted = true
    and deleted_at < now() - interval '30 days';
end;
$$;
-- Wire up via pg_cron (Supabase Pro) or call manually from app:
-- select cron.schedule('purge-trash', '0 3 * * *', 'select public.purge_old_trash()');


-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

-- Profiles: users can only read/update their own
alter table public.profiles enable row level security;

create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- Folders: users own their folders
alter table public.folders enable row level security;

create policy "folders: own all" on public.folders
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Notes: users own their notes
alter table public.notes enable row level security;

create policy "notes: own all" on public.notes
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ─────────────────────────────────────────────
-- REALTIME (optional live-sync across tabs)
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.folders;
