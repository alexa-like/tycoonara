-- Stage 1 only. All EC amounts are signed integer hundredths.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.players (
  id uuid primary key references auth.users(id) on delete restrict,
  username text not null check (username ~ '^[A-Za-z][A-Za-z0-9_]{2,19}$'),
  avatar text not null check (avatar in ('cedar','marigold','tide','orchid')),
  level integer not null default 1 check (level = 1),
  xp integer not null default 0 check (xp = 0),
  reputation integer not null default 50 check (reputation = 50),
  created_at timestamptz not null default now()
);
create unique index players_username_casefold on public.players (lower(username));
create table public.wallets (
  player_id uuid primary key references public.players(id) on delete restrict,
  balance_subunits bigint not null check (balance_subunits = 50000)
);
create table private.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid unique references public.players(id) on delete restrict,
  kind text not null check (kind in ('issuance','player')),
  check ((kind = 'issuance' and player_id is null) or (kind = 'player' and player_id is not null))
);
create unique index single_issuance_account on private.ledger_accounts (kind) where kind = 'issuance';
insert into private.ledger_accounts(kind) values ('issuance');
create table private.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players(id) on delete restrict,
  purpose text not null default 'founding_grant' check (purpose = 'founding_grant'),
  created_at timestamptz not null default now()
);
create table private.ledger_entries (
  transaction_id uuid not null references private.ledger_transactions(id) on delete restrict,
  account_id uuid not null references private.ledger_accounts(id) on delete restrict,
  amount_subunits bigint not null check (amount_subunits in (-50000,50000)),
  primary key(transaction_id, account_id)
);
create index ledger_entries_account on private.ledger_entries(account_id);

alter table public.players enable row level security;
alter table public.wallets enable row level security;
alter table private.ledger_accounts enable row level security;
alter table private.ledger_transactions enable row level security;
alter table private.ledger_entries enable row level security;
revoke all on public.players, public.wallets from public, anon, authenticated;
grant select on public.players, public.wallets to authenticated;
create policy own_player on public.players for select to authenticated using (id = (select auth.uid()));
create policy own_wallet on public.wallets for select to authenticated using (player_id = (select auth.uid()));
revoke all on all tables in schema private from public, anon, authenticated;

create function private.prevent_mutation() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Stage 1 records are immutable' using errcode = '42501'; end;
$$;
create trigger immutable_player before update or delete on public.players for each row execute function private.prevent_mutation();
create trigger immutable_wallet before update or delete on public.wallets for each row execute function private.prevent_mutation();
create trigger immutable_accounts before update or delete on private.ledger_accounts for each row execute function private.prevent_mutation();
create trigger immutable_transactions before update or delete on private.ledger_transactions for each row execute function private.prevent_mutation();
create trigger immutable_entries before update or delete on private.ledger_entries for each row execute function private.prevent_mutation();

create function private.check_grant() returns trigger language plpgsql set search_path = '' as $$
declare tx uuid; owner_id uuid; entry_count integer; net bigint; issuance_total bigint; player_total bigint;
begin
  if tg_table_name = 'ledger_transactions' then tx := new.id; else tx := new.transaction_id; end if;
  select player_id into owner_id from private.ledger_transactions where id = tx;
  select count(*), coalesce(sum(e.amount_subunits),0),
    coalesce(sum(e.amount_subunits) filter (where a.kind = 'issuance'),0),
    coalesce(sum(e.amount_subunits) filter (where a.kind = 'player' and a.player_id = owner_id),0)
  into entry_count, net, issuance_total, player_total
  from private.ledger_entries e join private.ledger_accounts a on a.id = e.account_id where e.transaction_id = tx;
  if entry_count <> 2 or net <> 0 or issuance_total <> -50000 or player_total <> 50000 then
    raise exception 'Unbalanced or invalid founding grant' using errcode = '23514';
  end if;
  if not exists (select 1 from public.wallets where player_id = owner_id and balance_subunits = player_total) then
    raise exception 'Wallet and ledger disagree' using errcode = '23514';
  end if;
  return null;
end;
$$;
create constraint trigger balanced_transaction after insert on private.ledger_transactions deferrable initially deferred for each row execute function private.check_grant();
create constraint trigger balanced_entries after insert on private.ledger_entries deferrable initially deferred for each row execute function private.check_grant();

-- This is the only privileged operation reachable by authenticated users.
-- It accepts neither a user ID nor an amount, checks auth identity AND email verification,
-- and serializes concurrent requests for the same user before inspecting durable state.
create function private.bootstrap_player(chosen_username text, chosen_avatar text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); acct uuid; issuance uuid; tx uuid;
begin
  if uid is null or not exists (select 1 from auth.users where id = uid and email_confirmed_at is not null) then
    raise exception 'Verified sign-in required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 1));
  if exists (select 1 from public.players where id = uid) then return uid; end if;
  if chosen_username is null or chosen_username !~ '^[A-Za-z][A-Za-z0-9_]{2,19}$'
    or chosen_avatar is null or chosen_avatar not in ('cedar','marigold','tide','orchid') then
    raise exception 'Invalid founder profile' using errcode = '22023';
  end if;
  insert into public.players(id,username,avatar) values (uid,chosen_username,chosen_avatar);
  insert into public.wallets(player_id,balance_subunits) values (uid,50000);
  insert into private.ledger_accounts(player_id,kind) values (uid,'player') returning id into acct;
  select id into issuance from private.ledger_accounts where kind = 'issuance';
  insert into private.ledger_transactions(player_id) values (uid) returning id into tx;
  insert into private.ledger_entries(transaction_id,account_id,amount_subunits) values (tx,issuance,-50000),(tx,acct,50000);
  return uid;
end;
$$;
revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.bootstrap_player(text,text) to authenticated;
-- The exposed RPC runs as the caller. Privilege is isolated in the non-exposed schema.
create function public.bootstrap_player(chosen_username text, chosen_avatar text) returns uuid
language sql security invoker set search_path = '' as $$ select private.bootstrap_player(chosen_username,chosen_avatar); $$;
revoke all on function public.bootstrap_player(text,text) from public, anon;
grant execute on function public.bootstrap_player(text,text) to authenticated;
