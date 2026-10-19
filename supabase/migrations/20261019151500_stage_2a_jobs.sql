-- Stage 2A only. Apply to an isolated development DB, never the Stage 1 candidate DB.
-- No client can write game state; authenticated RPCs derive identity and use DB time.
alter table public.players drop constraint players_level_check, drop constraint players_xp_check;
alter table public.players add constraint players_xp_check check (xp between 0 and 1000000000),
  add constraint players_level_check check (level = least(25,1+xp/100));
alter table public.wallets drop constraint wallets_balance_subunits_check;
alter table public.wallets add constraint wallets_balance_subunits_check check (balance_subunits between 0 and 9007199254740991);
alter table private.ledger_transactions drop constraint ledger_transactions_player_id_key, drop constraint ledger_transactions_purpose_check;
alter table private.ledger_transactions add constraint ledger_transactions_purpose_check check (purpose in ('founding_grant','npc_job'));
create unique index one_founding_grant on private.ledger_transactions(player_id) where purpose='founding_grant';
alter table private.ledger_entries drop constraint ledger_entries_amount_subunits_check;
alter table private.ledger_entries add constraint ledger_entries_amount_subunits_check check (amount_subunits <> 0 and amount_subunits between -9007199254740991 and 9007199254740991);

create table public.job_catalog (
  id text primary key, title text not null, npc_name text not null, description text not null,
  min_level integer not null check (min_level between 1 and 25),
  duration_seconds integer not null check (duration_seconds between 10 and 3600),
  cooldown_seconds integer not null check (cooldown_seconds between 10 and 3600),
  reward_subunits integer not null check (reward_subunits between 1 and 10000),
  reward_xp integer not null check (reward_xp between 1 and 100),
  enabled boolean not null default true
);
insert into public.job_catalog values
 ('welcome-delivery','Welcome delivery','Mara · District host','Bring welcome packs to the founders on Fountain Square.',1,10,10,125,25,true),
 ('stockroom-sort','Stockroom sort','Ivo · Shopkeeper','Help put a neighborhood shop’s stockroom in order.',2,30,20,350,40,true),
 ('park-inventory','Park inventory','Nia · Park steward','Count supplies for the riverside community gardens.',3,60,30,600,60,true);
create table public.job_runs (
  id uuid primary key default gen_random_uuid(), player_id uuid not null references public.players(id),
  request_key uuid not null, job_id text not null references public.job_catalog(id),
  started_at timestamptz not null, ready_at timestamptz not null,
  cooldown_seconds integer not null check(cooldown_seconds between 10 and 3600),
  reward_subunits integer not null check(reward_subunits between 1 and 10000),
  reward_xp integer not null check(reward_xp between 1 and 100),
  unique(player_id,request_key), unique(id,player_id),
  check(ready_at >= started_at + interval '10 seconds' and ready_at <= started_at + interval '1 hour')
);
create index job_runs_owner_time on public.job_runs(player_id,started_at desc);
create table public.job_claims (
  run_id uuid primary key, player_id uuid not null,
  claimed_at timestamptz not null, cooldown_until timestamptz not null,
  reward_subunits integer not null, reward_xp integer not null,
  foreign key(run_id,player_id) references public.job_runs(id,player_id),
  check(cooldown_until >= claimed_at + interval '10 seconds')
);
create index job_claims_owner_cooldown on public.job_claims(player_id,cooldown_until desc);
alter table private.ledger_transactions add column job_run_id uuid unique references public.job_claims(run_id),
  add constraint ledger_transaction_source check ((purpose='founding_grant' and job_run_id is null) or (purpose='npc_job' and job_run_id is not null));

alter table public.job_catalog enable row level security;
alter table public.job_runs enable row level security;
alter table public.job_claims enable row level security;
revoke all on public.job_catalog, public.job_runs, public.job_claims from public,anon,authenticated;
grant select on public.job_catalog, public.job_runs, public.job_claims to authenticated;
create policy readable_catalog on public.job_catalog for select to authenticated using (true);
create policy own_runs on public.job_runs for select to authenticated using (player_id=(select auth.uid()));
create policy own_claims on public.job_claims for select to authenticated using (player_id=(select auth.uid()));
create trigger immutable_runs before update or delete on public.job_runs for each row execute function private.prevent_mutation();
create trigger immutable_claims before update or delete on public.job_claims for each row execute function private.prevent_mutation();
-- Preserve profile identity/reputation and prevent deletes. Derived values are checked at commit.
drop trigger immutable_player on public.players;
drop trigger immutable_wallet on public.wallets;
create function private.protect_profile() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Permanent record' using errcode='42501'; end if;
 if tg_table_name='players' and (to_jsonb(new)-'xp'-'level') is distinct from (to_jsonb(old)-'xp'-'level') then
   raise exception 'Permanent founder identity' using errcode='42501';
 end if;
 if tg_table_name='wallets' then
  if new.player_id is distinct from old.player_id then raise exception 'Permanent wallet owner' using errcode='42501'; end if;
 end if;
 return new;
end $$;
create trigger protect_player before update or delete on public.players for each row execute function private.protect_profile();
create trigger protect_wallet before update or delete on public.wallets for each row execute function private.protect_profile();

-- Deferred checks run as owner, including when the API caller commits as authenticated.
create function private.check_player_totals() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid; actual numeric; earned bigint;
begin
 if tg_table_name='players' then uid:=new.id; else uid:=new.player_id; end if;
 select coalesce(sum(e.amount_subunits),0) into actual from private.ledger_entries e
 join private.ledger_accounts a on a.id=e.account_id where a.player_id=uid;
 select coalesce(sum(reward_xp),0) into earned from public.job_claims where player_id=uid;
 if not exists(select 1 from public.wallets where player_id=uid and balance_subunits=actual)
 or not exists(select 1 from public.players where id=uid and xp=earned and level=least(25,1+earned/100)) then
  raise exception 'Ledger, wallet or progression mismatch' using errcode='23514';
 end if;
 return null;
end $$;
create constraint trigger wallet_totals after insert or update on public.wallets deferrable initially deferred for each row execute function private.check_player_totals();
create constraint trigger player_totals after insert or update on public.players deferrable initially deferred for each row execute function private.check_player_totals();
create constraint trigger claim_totals after insert on public.job_claims deferrable initially deferred for each row execute function private.check_player_totals();

create or replace function private.check_grant() returns trigger language plpgsql security definer set search_path='' as $$
declare tx uuid; t private.ledger_transactions; r public.job_runs; c public.job_claims;
 n integer; net numeric; issuance numeric; credit numeric; expected bigint;
begin
 if tg_table_name='ledger_transactions' then tx:=new.id; else tx:=new.transaction_id; end if;
 select * into strict t from private.ledger_transactions where id=tx;
 expected:=50000;
 if t.purpose='npc_job' then
  select * into strict r from public.job_runs where id=t.job_run_id;
  select * into strict c from public.job_claims where run_id=r.id;
  if r.player_id<>t.player_id or c.player_id<>t.player_id or c.claimed_at<r.ready_at
    or c.cooldown_until<>c.claimed_at+make_interval(secs=>r.cooldown_seconds)
    or c.reward_subunits<>r.reward_subunits or c.reward_xp<>r.reward_xp then
   raise exception 'Invalid job receipt' using errcode='23514';
  end if;
  expected:=r.reward_subunits;
 end if;
 select count(*),coalesce(sum(e.amount_subunits),0),
 coalesce(sum(e.amount_subunits) filter(where a.kind='issuance'),0),
 coalesce(sum(e.amount_subunits) filter(where a.kind='player' and a.player_id=t.player_id),0)
 into n,net,issuance,credit from private.ledger_entries e join private.ledger_accounts a on a.id=e.account_id where e.transaction_id=tx;
 if n<>2 or net<>0 or issuance<>-expected or credit<>expected then
  raise exception 'Invalid balanced issuance' using errcode='23514';
 end if;
 if not exists(select 1 from public.wallets w where w.player_id=t.player_id and w.balance_subunits=(select sum(e.amount_subunits) from private.ledger_entries e join private.ledger_accounts a on a.id=e.account_id where a.player_id=t.player_id)) then
  raise exception 'Wallet and ledger disagree' using errcode='23514';
 end if;
 return null;
end $$;
-- Every receipt must have its own balanced transaction; no orphan XP/claim record.
create function private.check_receipt() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.ledger_transactions where job_run_id=new.run_id and purpose='npc_job' and player_id=new.player_id) then
  raise exception 'Missing job transaction' using errcode='23514';
 end if;
 return null;
end $$;
create constraint trigger receipt_transaction after insert on public.job_claims deferrable initially deferred for each row execute function private.check_receipt();

create function private.job_identity() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null)
 or not exists(select 1 from public.players where id=uid) then
  raise exception 'Verified founder required' using errcode='42501';
 end if;
 -- Same lock domain as Stage 1 bootstrap; acquire before sampling clock or reading state.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 return uid;
end $$;
create function private.start_job(chosen_job text, request_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.job_identity(); old_run public.job_runs; job public.job_catalog; ts timestamptz; result uuid;
begin
 if request_key is null then raise exception 'Request key required' using errcode='22023'; end if;
 select * into old_run from public.job_runs r where r.player_id=uid and r.request_key=start_job.request_key;
 if found then
  if old_run.job_id is distinct from chosen_job then raise exception 'Request key conflict' using errcode='22023'; end if;
  return old_run.id;
 end if;
 ts:=clock_timestamp();
 if exists(select 1 from public.job_runs r where r.player_id=uid and not exists(select 1 from public.job_claims c where c.run_id=r.id)) then
  raise exception 'Finish your current job first' using errcode='P0001';
 end if;
 if exists(select 1 from public.job_claims where player_id=uid and cooldown_until>ts) then
  raise exception 'Take a short break before another job' using errcode='P0001';
 end if;
 select * into job from public.job_catalog where id=chosen_job and enabled;
 if not found or (select level from public.players where id=uid)<job.min_level then
  raise exception 'Job unavailable at your level' using errcode='22023';
 end if;
 insert into public.job_runs(player_id,request_key,job_id,started_at,ready_at,cooldown_seconds,reward_subunits,reward_xp)
 values(uid,request_key,job.id,ts,ts+make_interval(secs=>job.duration_seconds),job.cooldown_seconds,job.reward_subunits,job.reward_xp) returning id into result;
 return result;
end $$;
create function private.claim_job(chosen_run uuid) returns public.job_claims language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.job_identity(); r public.job_runs; receipt public.job_claims; ts timestamptz; tx uuid; acct uuid; issuance uuid;
begin
 select * into r from public.job_runs where id=chosen_run and player_id=uid;
 if not found then raise exception 'Job not found' using errcode='22023'; end if;
 select * into receipt from public.job_claims where run_id=r.id;
 if found then return receipt; end if;
 ts:=clock_timestamp();
 if ts<r.ready_at then raise exception 'Job is still in progress' using errcode='P0001'; end if;
 insert into public.job_claims(run_id,player_id,claimed_at,cooldown_until,reward_subunits,reward_xp)
 values(r.id,uid,ts,ts+make_interval(secs=>r.cooldown_seconds),r.reward_subunits,r.reward_xp) returning * into receipt;
 insert into private.ledger_transactions(player_id,purpose,job_run_id) values(uid,'npc_job',r.id) returning id into tx;
 select id into acct from private.ledger_accounts where player_id=uid;
 select id into issuance from private.ledger_accounts where kind='issuance';
 insert into private.ledger_entries values(tx,issuance,-r.reward_subunits),(tx,acct,r.reward_subunits);
 update public.wallets set balance_subunits=balance_subunits+r.reward_subunits where player_id=uid;
 update public.players set xp=xp+r.reward_xp,level=least(25,1+(xp+r.reward_xp)/100) where id=uid;
 return receipt;
end $$;
create function public.start_job(chosen_job text,request_key uuid) returns uuid language sql security invoker set search_path='' as $$ select private.start_job(chosen_job,request_key); $$;
create function public.claim_job(chosen_run uuid) returns public.job_claims language sql security invoker set search_path='' as $$ select private.claim_job(chosen_run); $$;
-- A read-only snapshot avoids client clock trust and bounds the query size.
create function private.job_board() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.job_identity();
begin return jsonb_build_object(
 'server_now',clock_timestamp(),
 'catalog',(select coalesce(jsonb_agg(to_jsonb(j) order by j.min_level,j.id),'[]') from public.job_catalog j where enabled),
 'active',(select to_jsonb(r) from public.job_runs r where r.player_id=uid and not exists(select 1 from public.job_claims c where c.run_id=r.id) order by started_at desc limit 1),
 'recent',(select coalesce(jsonb_agg(to_jsonb(c) order by c.claimed_at desc),'[]') from (select * from public.job_claims where player_id=uid order by claimed_at desc limit 5)c)
 ); end $$;
create function public.job_board() returns jsonb language sql security invoker set search_path='' as $$ select private.job_board(); $$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.bootstrap_player(text,text),private.start_job(text,uuid),private.claim_job(uuid),private.job_board() to authenticated;
revoke all on function public.start_job(text,uuid),public.claim_job(uuid),public.job_board() from public,anon;
grant execute on function public.start_job(text,uuid),public.claim_job(uuid),public.job_board() to authenticated;
