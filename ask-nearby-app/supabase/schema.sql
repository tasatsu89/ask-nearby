create extension if not exists pgcrypto;
create extension if not exists postgis;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  place text,
  lat double precision,
  lng double precision,
  location geography(point,4326),
  helpful_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists questions_location_gix on public.questions using gist(location);
create index if not exists questions_created_at_idx on public.questions(created_at desc);

create or replace function public.set_question_location()
returns trigger
language plpgsql
as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := ST_SetSRID(ST_MakePoint(new.lng,new.lat),4326)::geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;

drop trigger if exists questions_set_location on public.questions;
create trigger questions_set_location
before insert or update of lat,lng on public.questions
for each row execute function public.set_question_location();

alter table public.questions enable row level security;
alter table public.answers enable row level security;

drop policy if exists "read questions" on public.questions;
create policy "read questions" on public.questions
for select using (true);

drop policy if exists "insert own questions" on public.questions;
create policy "insert own questions" on public.questions
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "update own questions" on public.questions;
create policy "update own questions" on public.questions
for update to authenticated
using (auth.uid() = user_id);

drop policy if exists "read answers" on public.answers;
create policy "read answers" on public.answers
for select using (true);

drop policy if exists "insert own answers" on public.answers;
create policy "insert own answers" on public.answers
for insert to authenticated
with check (auth.uid() = user_id);

create or replace function public.nearby_questions(
  user_lat double precision,
  user_lng double precision,
  radius_meters integer default 4828
)
returns table (
  id uuid,
  user_id uuid,
  body text,
  place text,
  lat double precision,
  lng double precision,
  helpful_count integer,
  created_at timestamptz,
  distance_meters double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id, q.user_id, q.body, q.place, q.lat, q.lng,
    q.helpful_count, q.created_at,
    ST_Distance(
      q.location,
      ST_SetSRID(ST_MakePoint(user_lng,user_lat),4326)::geography
    ) as distance_meters
  from public.questions q
  where q.location is not null
    and ST_DWithin(
      q.location,
      ST_SetSRID(ST_MakePoint(user_lng,user_lat),4326)::geography,
      radius_meters
    )
  order by q.created_at desc
  limit 100;
$$;

grant execute on function public.nearby_questions(double precision,double precision,integer) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename='questions'
  ) then
    alter publication supabase_realtime add table public.questions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename='answers'
  ) then
    alter publication supabase_realtime add table public.answers;
  end if;
end $$;


create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  lat double precision,
  lng double precision,
  radius_miles double precision not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions
for select to authenticated
using (auth.uid() = user_id);


-- Marketplace v5 additions (safe to run after the base schema)
alter table public.questions add column if not exists bounty_cents integer not null default 0;
alter table public.questions add column if not exists status text not null default 'open';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Near By user',
  bio text,
  avatar_url text,
  helper_rating numeric(3,2) not null default 0,
  requester_rating numeric(3,2) not null default 0,
  completed_answers integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  rater_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  role text not null check (role in ('helper','requester')),
  stars integer not null check (stars between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  question_id uuid references public.questions(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);
