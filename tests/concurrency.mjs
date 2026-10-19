import pg from 'pg';
import assert from 'node:assert/strict';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 12 });
const id = '20000000-0000-4000-8000-000000000001';
try {
  await pool.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())',[id,'concurrent@example.invalid']);
  await Promise.all(Array.from({length:12},async () => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);
      await client.query("select public.bootstrap_player('ConcurrentFounder','cedar')");
      await client.query('commit');
    } catch(error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
  }));
  const {rows:[result]} = await pool.query(`select (select count(*)::int from private.ledger_transactions where player_id=$1) grants, (select balance_subunits::int from public.wallets where player_id=$1) balance, (select sum(e.amount_subunits)::int from private.ledger_entries e join private.ledger_transactions t on t.id=e.transaction_id where t.player_id=$1) net`,[id]);
  assert.deepEqual(result,{grants:1,balance:50000,net:0});
  console.log('PASS: 12 concurrent bootstrap requests produce one balanced 500 EC grant');
} finally { await pool.end(); }
