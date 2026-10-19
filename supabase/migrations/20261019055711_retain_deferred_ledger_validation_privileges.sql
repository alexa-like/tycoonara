-- Deferred triggers must retain ledger access at authenticated commit.
create or replace function private.check_grant() returns trigger language plpgsql security definer set search_path = '' as $$
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
revoke all on function private.check_grant() from public, anon, authenticated;
