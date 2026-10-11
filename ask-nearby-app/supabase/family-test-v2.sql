-- Additive migration. Review and apply to a preview Supabase project first.
begin;
-- The live project predates the push tables in schema.sql.
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,p256dh text not null,auth text not null,
 lat double precision,lng double precision,radius_miles double precision not null default 3,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for select to authenticated using(user_id=(select auth.uid()));
-- Explicit privileges also support projects without automatic Data API grants.
grant select on public.questions,public.answers to anon,authenticated;
grant select on public.questions,public.answers to service_role;
grant insert on public.questions to authenticated;
grant select on public.push_subscriptions to authenticated;
grant select,insert,update,delete on public.push_subscriptions to service_role;
alter table if exists public.profiles enable row level security;
alter table if exists public.ratings enable row level security;
alter table if exists public.reports enable row level security;
alter table public.questions add column if not exists status text not null default 'open';
alter table public.questions add column if not exists reward_cents integer not null default 0;
alter table public.questions add column if not exists fee_cents integer not null default 0;
alter table public.questions add column if not exists expires_at timestamptz;
alter table public.questions add column if not exists claim_user_id uuid references auth.users(id);
alter table public.questions add column if not exists claim_expires_at timestamptz;
alter table public.questions add column if not exists photo_required boolean not null default false;
alter table public.answers add column if not exists photo_url text;
alter table public.answers add column if not exists verified_photo boolean not null default false;
alter table public.answers add column if not exists pending_until timestamptz;
alter table public.answers add column if not exists payout_status text not null default 'pending';
create table if not exists public.disputes(id uuid primary key default gen_random_uuid(), question_id uuid references public.questions(id), answer_id uuid references public.answers(id), reporter_id uuid references auth.users(id), reason text not null, created_at timestamptz default now());
alter table public.disputes enable row level security;
grant select on public.disputes to authenticated;
drop policy if exists "family disputes own read" on public.disputes;
create policy "family disputes own read" on public.disputes for select to authenticated using (reporter_id=auth.uid());
-- Mutations go through atomic RPCs, not arbitrary client updates.
-- Existing deployments use multiple policy names. Permissive policies combine
-- with OR, so keeping one legacy write policy would bypass the family checks.
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('questions','answers','disputes') and cmd in ('INSERT','UPDATE','DELETE','ALL') loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
revoke insert,update,delete on public.answers,public.disputes from anon,authenticated;
revoke update,delete on public.questions from anon,authenticated;
revoke insert on public.questions from anon;
create policy "insert own questions" on public.questions for insert to authenticated with check(auth.uid()=user_id and status='open' and reward_cents in (100,200,300,500) and fee_cents=case reward_cents when 100 then 29 when 200 then 49 when 300 then 59 when 500 then 79 end and claim_user_id is null and claim_expires_at is null and expires_at between now()+interval '4 minutes' and now()+interval '61 minutes' and lat between -90 and 90 and lng between -180 and 180);
create or replace function public.claim_question_family(p_question_id uuid,p_claim_minutes integer default 5) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 update questions set status='claimed',claim_user_id=auth.uid(),claim_expires_at=now()+make_interval(mins=>least(5,greatest(2,p_claim_minutes))) where id=p_question_id and user_id<>auth.uid() and expires_at>now() and (status='open' or (status='claimed' and claim_expires_at+interval '1 minute'<now()));
 return found;
end $$;
create or replace function public.submit_answer_family(p_question_id uuid,p_body text,p_photo_url text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare q questions; aid uuid;
begin
 select * into q from questions where id=p_question_id for update;
 if auth.uid() is null or q.claim_user_id is distinct from auth.uid() or q.status<>'claimed' or q.claim_expires_at+interval '1 minute'<now() or q.expires_at<now() then raise exception 'Claim is not valid'; end if;
 if length(trim(p_body))<8 or length(p_body)>500 then raise exception 'Provide a specific answer (8–500 characters)'; end if;
 if p_photo_url is not null and not exists(select 1 from storage.objects where bucket_id='nearby-photos' and name like 'answers/'||auth.uid()::text||'/'||q.id::text||'-%' and p_photo_url like '%/storage/v1/object/public/nearby-photos/'||name) then raise exception 'Photo must belong to this answer'; end if;
 if q.photo_required and p_photo_url is null then raise exception 'Photo required'; end if;
 insert into answers(question_id,user_id,body,photo_url,pending_until,payout_status) values(q.id,auth.uid(),trim(p_body),p_photo_url,now()+interval '10 minutes','pending') returning id into aid;
 update questions set status='answered' where id=q.id;return aid;
end $$;
create or replace function public.release_reward_family(p_question_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare q questions;
begin
 select * into q from questions where id=p_question_id for update;
 if auth.uid() is null or q.user_id is distinct from auth.uid() or q.status<>'answered' then raise exception 'Only the question owner may release a pending reward'; end if;
 update answers set payout_status='released',pending_until=now() where question_id=q.id and payout_status='pending';
 if found then update questions set status='completed' where id=q.id; end if;
end $$;
create or replace function public.dispute_answer_family(p_question_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare q questions; a answers;
begin
 select * into q from questions where id=p_question_id for update;
 if auth.uid() is null or q.user_id is distinct from auth.uid() or q.status<>'answered' then raise exception 'Only the question owner may dispute'; end if;
 select * into a from answers where question_id=q.id and payout_status='pending' for update;
 if a.id is null or length(trim(p_reason)) not between 1 and 500 then raise exception 'No pending answer or invalid reason'; end if;
 insert into disputes(question_id,answer_id,reporter_id,reason) values(q.id,a.id,auth.uid(),p_reason);
 update answers set payout_status='disputed' where id=a.id;
end $$;
create or replace function public.settle_rewards_family() returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then return; end if;
 -- Lock questions in the same order as release/dispute, so settlement cannot bypass a dispute.
 perform 1 from questions q where q.status='answered' and exists(select 1 from answers a where a.question_id=q.id and a.payout_status='pending' and a.pending_until<=now()) order by q.id for update;
 update answers set payout_status='released' where payout_status='pending' and pending_until<=now();
 update questions q set status='completed' where status='answered' and exists(select 1 from answers a where a.question_id=q.id and a.payout_status='released');
end $$;
revoke all on function public.claim_question_family(uuid,integer),public.submit_answer_family(uuid,text,text),public.release_reward_family(uuid),public.dispute_answer_family(uuid,text),public.settle_rewards_family() from public,anon;
grant execute on function public.claim_question_family(uuid,integer),public.submit_answer_family(uuid,text,text),public.release_reward_family(uuid),public.dispute_answer_family(uuid,text),public.settle_rewards_family() to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('nearby-photos','nearby-photos',true,5242880,array['image/jpeg','image/png','image/webp','image/heic']) on conflict(id) do nothing;
drop policy if exists "family photo upload" on storage.objects;
create policy "family photo upload" on storage.objects for insert to authenticated with check(bucket_id='nearby-photos' and (storage.foldername(name))[1]='answers' and (storage.foldername(name))[2]=auth.uid()::text);
drop policy if exists "family photo read" on storage.objects;
create policy "family photo read" on storage.objects for select using(bucket_id='nearby-photos');
create table if not exists public.push_events_family(event_key text primary key,created_at timestamptz not null default now());
alter table public.push_events_family enable row level security;
grant select,insert,update,delete on public.push_events_family to service_role;
create index if not exists family_answers_question_idx on public.answers(question_id);
create index if not exists family_answers_pending_idx on public.answers(pending_until,question_id) where payout_status='pending';
-- Realtime publication is absent on some older installations.
do $$ begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  create publication supabase_realtime;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='questions') then
  alter publication supabase_realtime add table public.questions;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='answers') then
  alter publication supabase_realtime add table public.answers;
 end if;
end $$;
commit;
