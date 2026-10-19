-- Runs inside one rollback-only transaction: no users or ledger data are retained.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','stage1-a@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000002','stage1-b@example.invalid',now()),
 ('10000000-0000-4000-8000-000000000003','stage1-unverified@example.invalid',null);
set local role anon;
do $$ begin
  begin perform public.bootstrap_player('AnonFounder','cedar'); raise exception 'FAIL anonymous bootstrap'; exception when insufficient_privilege then null; end;
  begin perform * from public.players; raise exception 'FAIL anonymous read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
  begin perform public.bootstrap_player('Unverified','cedar'); raise exception 'FAIL unverified bootstrap'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.bootstrap_player('Founder_A','cedar');
select public.bootstrap_player('AnotherName','tide');
do $$ begin
  if (select count(*) from public.players) <> 1 then raise exception 'FAIL owner SELECT'; end if;
  if (select username from public.players) <> 'Founder_A' then raise exception 'FAIL immutable onboarding'; end if;
  if (select balance_subunits from public.wallets) <> 50000 then raise exception 'FAIL balance'; end if;
  begin update public.players set xp = 10; raise exception 'FAIL player write'; exception when insufficient_privilege then null; end;
  begin update public.wallets set balance_subunits = 60000; raise exception 'FAIL wallet write'; exception when insufficient_privilege then null; end;
  begin insert into public.wallets values ('10000000-0000-4000-8000-000000000001',50000); raise exception 'FAIL wallet insert'; exception when insufficient_privilege then null; end;
  begin perform * from private.ledger_entries; raise exception 'FAIL private ledger access'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
  if exists (select 1 from public.players) or exists (select 1 from public.wallets) then raise exception 'FAIL cross-user RLS'; end if;
  begin perform public.bootstrap_player('fOUNDER_a','orchid'); raise exception 'FAIL case insensitive uniqueness'; exception when unique_violation then null; end;
  begin perform public.bootstrap_player('bad name','orchid'); raise exception 'FAIL username validation'; exception when invalid_parameter_value then null; end;
  begin perform public.bootstrap_player('ValidName','arbitrary'); raise exception 'FAIL avatar validation'; exception when invalid_parameter_value then null; end;
end $$;
select public.bootstrap_player('Founder_B','marigold');
reset role;
set constraints all immediate;
do $$ begin
  if (select count(*) from private.ledger_transactions where player_id = '10000000-0000-4000-8000-000000000001') <> 1 then raise exception 'FAIL duplicate grant'; end if;
  if exists (select transaction_id from private.ledger_entries group by transaction_id having sum(amount_subunits) <> 0 or count(*) <> 2) then raise exception 'FAIL ledger balance'; end if;
  begin update private.ledger_entries set amount_subunits = amount_subunits; raise exception 'FAIL ledger mutation'; exception when insufficient_privilege then null; end;
  begin delete from private.ledger_transactions; raise exception 'FAIL ledger deletion'; exception when insufficient_privilege then null; end;
  begin
    insert into public.players(id,username,avatar) values ('10000000-0000-4000-8000-000000000003','BrokenGrant','cedar');
    insert into private.ledger_transactions(player_id) values ('10000000-0000-4000-8000-000000000003');
    raise exception 'FAIL empty transaction accepted';
  exception when check_violation then null; end;
end $$;
select 'PASS: anonymous, unverified, RLS, privileges, uniqueness, idempotence, ledger balance and immutability' as result;
rollback;
