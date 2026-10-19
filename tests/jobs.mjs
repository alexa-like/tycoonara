// Runs only against disposable CI databases. Never point DATABASE_URL at hosted data.
import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:12});
const uid=randomUUID(),other=randomUUID(),unverified=randomUUID();
async function asUser(id,sql,params=[]) {
 const c=await pool.connect();
 try{await c.query('begin');await c.query('set local role authenticated');await c.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role:'authenticated'})]);const r=await c.query(sql,params);await c.query('commit');return r.rows;}
 catch(e){await c.query('rollback');throw e;}finally{c.release();}
}
async function denied(id,sql,params=[],code='42501'){await assert.rejects(asUser(id,sql,params),e=>e.code===code);}
async function corrupt(sql,params=[],code='23514') {
 const c=await pool.connect();try{await c.query('begin');await assert.rejects(async()=>{await c.query(sql,params);await c.query('set constraints all immediate');},e=>e.code===code);}finally{await c.query('rollback');c.release();}
}
async function board(){return (await asUser(uid,'select public.job_board() b'))[0].b;}
async function start(key=randomUUID(),job='welcome-delivery'){return (await asUser(uid,'select public.start_job($1,$2) id',[job,key]))[0].id;}
async function claim(id){return (await asUser(uid,'select (public.claim_job($1)).*',[id]))[0];}
async function waitUntil(time){await delay(Math.max(0,Date.parse(time)-Date.now())+100);}
try {
 await pool.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now()),($3,$4,now()),($5,$6,null)',[uid,`${uid}@example.invalid`,other,`${other}@example.invalid`,unverified,`${unverified}@example.invalid`]);
 for(const id of [uid,other])await asUser(id,'select public.bootstrap_player($1,$2)',[`J_${id.slice(0,12).replaceAll('-','')}`,'cedar']);
 const initial=(await pool.query('select id,username,avatar,reputation,created_at from public.players where id=$1',[uid])).rows[0];
 for(const op of ["select public.job_board()","select public.start_job('welcome-delivery',gen_random_uuid())","select public.claim_job(gen_random_uuid())"]) {
  await denied(unverified,op);await denied(null,op);
 }
 for(const table of ['job_catalog','job_runs','job_claims','players','wallets']) {
  await denied(uid,`delete from public.${table}`);
 }
 await denied(uid,'update public.job_catalog set reward_subunits=9999');
 await denied(uid,'insert into public.job_runs(player_id) values ($1)',[uid]);
 await denied(uid,'insert into public.job_claims(player_id) values ($1)',[uid]);
 await denied(uid,'select * from private.ledger_entries');
 await denied(uid,'update public.players set xp=100000,level=25');
 await denied(uid,'update public.wallets set balance_subunits=900000');
 await denied(uid,"select public.start_job('stockroom-sort',gen_random_uuid())",[],'22023');
 await denied(uid,"select public.start_job('invented',gen_random_uuid())",[],'22023');
 await denied(uid,"select public.start_job('welcome-delivery',null)",[],'22023');
 await denied(uid,"select public.start_job('welcome-delivery','invalid')",[],'22P02');
 await denied(uid,"select public.start_job('welcome-delivery',gen_random_uuid(),9999)",[],'42883');
 const key=randomUUID();
 const starts=await Promise.all(Array.from({length:12},()=>start(key)));
 const run=starts[0];assert(starts.every(x=>x===run),'same-key starts must return same run');
 await denied(uid,'select public.start_job($1,$2)',['stockroom-sort',key],'22023');
 await denied(uid,"select public.start_job('welcome-delivery',gen_random_uuid())",[],'P0001');
 await denied(other,'select public.claim_job($1)',[run],'22023');
 assert.equal((await asUser(other,'select * from public.job_runs where id=$1',[run])).length,0);
 await denied(uid,'select public.claim_job($1)',[run],'P0001');
 await denied(uid,'update public.job_runs set ready_at=now(),reward_subunits=10000 where id=$1',[run]);
 let b=await board();assert.equal(b.active.id,run);assert.equal(b.active.reward_subunits,125);
 assert(Date.parse(b.active.ready_at)-Date.parse(b.active.started_at)===10000);
 // Independent refreshes recover the durable timer, not a new job.
 assert.equal((await board()).active.ready_at,b.active.ready_at);
 await waitUntil(b.active.ready_at);
 const claims=await Promise.all(Array.from({length:12},()=>claim(run)));
 for(const receipt of claims)assert.deepEqual(receipt,claims[0]);
 let receipt=claims[0];assert.equal(receipt.reward_subunits,125);assert.equal(receipt.reward_xp,25);
 assert.equal(Date.parse(receipt.cooldown_until)-Date.parse(receipt.claimed_at),10000);
 assert.equal(await start(key),run,'late start replay must remain idempotent');
 await denied(uid,"select public.start_job('welcome-delivery',gen_random_uuid())",[],'P0001');
 assert.equal((await asUser(other,'select * from public.job_claims where run_id=$1',[run])).length,0);
 for(const [table,column] of [['job_runs','id'],['job_claims','run_id']]) {
  await corrupt(`update public.${table} set ${column}=${column} where ${column}=$1`,[run],'42501');
  await corrupt(`delete from public.${table} where ${column}=$1`,[run],'42501');
 }
 await corrupt('update public.wallets set balance_subunits=balance_subunits+1 where player_id=$1',[uid]);
 await corrupt('update public.players set xp=100,level=2 where id=$1',[uid]);
 await corrupt('update public.players set reputation=51 where id=$1',[uid],'42501');
 await corrupt('update private.ledger_entries set amount_subunits=amount_subunits',[],'42501');
 await corrupt('delete from private.ledger_transactions',[],'42501');
 // Orphan receipts, duplicate founding grants and malformed balanced transactions fail atomically.
 await corrupt("insert into private.ledger_transactions(player_id) values ($1)",[uid],'23505');
 await corrupt("insert into private.ledger_transactions(player_id,purpose) values ($1,'npc_job')",[uid]);
 // Earn 100 XP honestly with server time; race different request keys on the next start.
 for(let i=1;i<4;i++) {
  await waitUntil(receipt.cooldown_until);
  const raced=await Promise.allSettled(Array.from({length:12},()=>start()));
  const wins=raced.filter(x=>x.status==='fulfilled');assert.equal(wins.length,1);
  for(const x of raced.filter(x=>x.status==='rejected'))assert.equal(x.reason.code,'P0001');
  const id=wins[0].value;b=await board();assert.equal(b.active.id,id);
  // Replaying an older reward while a new job exists cannot affect or clear it.
  assert.deepEqual(await claim(run),claims[0]);assert.equal((await board()).active.id,id);
  await waitUntil(b.active.ready_at);receipt=await claim(id);assert.deepEqual(await claim(id),receipt);
 }
 const {rows:[totals]}=await pool.query(`select w.balance_subunits::text balance,p.xp,p.level,
 (select count(*)::int from private.ledger_transactions where player_id=$1 and purpose='founding_grant') grants,
 (select count(*)::int from private.ledger_transactions where player_id=$1 and purpose='npc_job') jobs
 from public.wallets w join public.players p on p.id=w.player_id where p.id=$1`,[uid]);
 assert.deepEqual(totals,{balance:'50500',xp:100,level:2,grants:1,jobs:4});
 assert.deepEqual((await pool.query('select id,username,avatar,reputation,created_at from public.players where id=$1',[uid])).rows[0],initial);
 assert.equal((await pool.query(`select t.id from private.ledger_transactions t join private.ledger_entries e on e.transaction_id=t.id group by t.id having sum(e.amount_subunits)<>0 or count(*)<>2`)).rowCount,0);
 await asUser(uid,'select public.bootstrap_player($1,$2)',['IgnoredRename','tide']);
 assert.equal((await board()).active,null);assert.equal((await board()).recent.length,4);
 await waitUntil(receipt.cooldown_until);
 const locked=await start(randomUUID(),'stockroom-sort');assert.equal((await board()).active.id,locked);
 console.log('PASS: 12-way start/claim races, conflicting keys, replays, forged amounts/times, cooldown, RLS, unverified access, immutability, atomic totals, level unlock and preserved Stage 1 grant');
} finally { await pool.end(); }
