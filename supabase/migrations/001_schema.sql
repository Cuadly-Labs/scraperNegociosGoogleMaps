-- ============================================================
-- ScrapCRM — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Profiles (extends auth.users) ────────────────────────────────────────────
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text,
  full_name   text,
  plan        text default 'free' check (plan in ('free', 'pro', 'business')),
  scrapes_used int default 0,
  scrapes_limit int default 500,
  created_at  timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Scrape Jobs ───────────────────────────────────────────────────────────────
create table public.scrape_jobs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  query       text not null,
  zone        text,
  mode        text default 'simple' check (mode in ('simple', 'grid')),
  cell_km     float default 8,
  max_results int default 50,
  max_total   int default 1000,
  status      text default 'pending' check (status in ('pending','running','done','error','cancelled')),
  progress    int default 0,
  total       int default 0,
  phase       text default '',
  businesses_found int default 0,
  error_msg   text,
  started_at  timestamptz,
  finished_at timestamptz,
  created_at  timestamptz default now()
);

alter table public.scrape_jobs enable row level security;
create policy "Users manage own jobs" on public.scrape_jobs for all using (auth.uid() = user_id);

-- ── Businesses ────────────────────────────────────────────────────────────────
create table public.businesses (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  job_id        uuid references public.scrape_jobs(id) on delete set null,

  -- Core data
  name          text not null,
  category      text,
  address       text,
  city          text,
  province      text,
  postal_code   text,
  phone         text,
  website       text,
  email         text,
  rating        float,
  reviews_count int,
  hours         text,
  price_range   text,
  description   text,
  google_maps_url text,
  plus_code     text,

  -- CRM fields
  status        text default 'not_contacted' check (status in (
    'not_contacted','contacted','no_response','rejected','interested','client'
  )),
  notes         text,
  tags          text[] default '{}',
  assigned_to   text,
  last_contact  timestamptz,
  next_followup timestamptz,

  -- Meta
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),

  -- Dedup per user
  unique (user_id, name, address)
);

alter table public.businesses enable row level security;
create policy "Users manage own businesses" on public.businesses for all using (auth.uid() = user_id);

-- Auto update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger businesses_updated_at before update on public.businesses
  for each row execute procedure update_updated_at();

-- ── Client Follow-ups ─────────────────────────────────────────────────────────
create table public.followups (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  business_id   uuid references public.businesses(id) on delete cascade not null,
  type          text check (type in ('call','email','meeting','note','whatsapp')),
  content       text,
  outcome       text,
  scheduled_at  timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz default now()
);

alter table public.followups enable row level security;
create policy "Users manage own followups" on public.followups for all using (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index on public.businesses (user_id, status);
create index on public.businesses (user_id, created_at desc);
create index on public.businesses (user_id, rating desc);
create index on public.businesses (user_id, city);
create index on public.scrape_jobs (user_id, created_at desc);
create index on public.followups (business_id, created_at desc);
