import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Disposable PostgreSQL fixture. Never connects to a hosted Supabase project.
const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const helper = '00000000-0000-4000-8000-000000000002';
const other = '00000000-0000-4000-8000-000000000003';
const question = '00000000-0000-4000-8000-000000000004';
await db.exec(`
 create role anon; create role authenticated; create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as
 $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth,storage to anon,authenticated;
 create table public.questions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),body text not null,place text,lat double precision,lng double precision,status text not null default 'open');
 create table public.answers(id uuid primary key default gen_random_uuid(),question_id uuid references questions(id),user_id uuid references auth.users(id),body text not null);
 create table public.profiles(id uuid); create table public.ratings(id uuid);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
 alter table questions enable row level security; alter table answers enable row level security;
 grant all on questions,answers to anon,authenticated;
 create policy "questions create" on questions for insert with check (auth.uid()=user_id);
 create policy "owners update questions" on questions for update using(auth.uid()=user_id);
 create policy "answers create" on answers for insert with check(auth.uid()=user_id);
 create policy "users update own answers" on answers for update using(auth.uid()=user_id);
 create policy "read questions" on questions for select using(true);
 create policy "read answers" on answers for select using(true);
 insert into auth.users values('${owner}'),('${helper}'),('${other}');
`);
const migration = await readFile(new URL('../supabase/family-test-v2.sql', import.meta.url), 'utf8');
await db.exec(migration);
await db.exec(migration); // Repeat rollout must also succeed.
let checks = 2;
async function asUser(user, sql, params = []) {
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 await db.exec('set role authenticated');
 try { return await db.query(sql,params); } finally { await db.exec('reset role'); }
}
async function denied(user, sql, params=[]) {
 await assert.rejects(asUser(user,sql,params)); checks++;
}
await denied(owner,"insert into questions(user_id,body,lat,lng,reward_cents,fee_cents,expires_at) values($1,'Bad reward',33,-84,999,0,now()+interval '15 minutes')",[owner]);
await asUser(owner,"insert into questions(id,user_id,body,lat,lng,reward_cents,fee_cents,expires_at,photo_required) values($1,$2,'Is the cafe open?',33,-84,100,29,now()+interval '15 minutes',true)",[question,owner]);checks++;
assert.equal((await asUser(owner,'select claim_question_family($1,5) as claimed',[question])).rows[0].claimed,false);checks++;
assert.equal((await asUser(helper,'select claim_question_family($1,1000) as claimed',[question])).rows[0].claimed,true);checks++;
assert.equal((await asUser(other,'select claim_question_family($1,5) as claimed',[question])).rows[0].claimed,false);checks++;
await denied(helper,'update questions set reward_cents=100000 where id=$1',[question]);
await denied(helper,"insert into answers(question_id,user_id,body) values($1,$2,'Bypass answer')",[question,helper]);
await denied(other,"select submit_answer_family($1,'The cafe is open.',null)",[question]);
await denied(helper,"select submit_answer_family($1,'The cafe is open.',null)",[question]);
await denied(helper,"select submit_answer_family($1,'The cafe is open.','https://example.com/unrelated.png')",[question]);
const photo = `answers/${helper}/${question}-photo.png`;
await db.query("insert into storage.objects(bucket_id,name) values('nearby-photos',$1)",[photo]);
const answer=(await asUser(helper,"select submit_answer_family($1,'The cafe is open.',$2) as id",[question,`https://fixture.supabase.co/storage/v1/object/public/nearby-photos/${photo}`])).rows[0].id;checks++;
await denied(helper,"update answers set payout_status='released' where id=$1",[answer]);
await denied(helper,'select release_reward_family($1)',[question]);
await asUser(owner,"select dispute_answer_family($1,'The posted hours are incorrect.')",[question]);checks++;
await db.query("update answers set pending_until=now()-interval '1 minute' where id=$1",[answer]);
await asUser(other,'select settle_rewards_family()');
assert.equal((await db.query('select payout_status from answers where id=$1',[answer])).rows[0].payout_status,'disputed');checks++;
assert.equal((await asUser(helper,'select * from disputes')).rows.length,0);checks++;
assert.equal((await asUser(owner,'select * from disputes')).rows.length,1);checks++;
await denied(owner,"insert into disputes(question_id,reporter_id,reason) values($1,$2,'Direct bypass')",[question,owner]);
const second='00000000-0000-4000-8000-000000000005';
await asUser(owner,"insert into questions(id,user_id,body,lat,lng,reward_cents,fee_cents,expires_at) values($1,$2,'Is the park open?',33,-84,200,49,now()+interval '15 minutes')",[second,owner]);
await asUser(helper,'select claim_question_family($1,5)',[second]);
await asUser(helper,"select submit_answer_family($1,'Yes, the gates are open.',null)",[second]);
await asUser(owner,'select release_reward_family($1)',[second]);
assert.equal((await db.query('select status from questions where id=$1',[second])).rows[0].status,'completed');checks++;
await denied(owner,'select release_reward_family($1)',[second]);
assert.equal((await db.query('select count(*)::int as n from answers where question_id=$1',[second])).rows[0].n,1);checks++;
const pub=(await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename")).rows.map(x=>x.tablename);
assert.deepEqual(pub,['answers','questions']);checks++;
await db.close();
console.log(`Family SQL: ${checks} checks passed (migration, legacy policies, claims, photos, virtual rewards, disputes, Realtime publication).`);
