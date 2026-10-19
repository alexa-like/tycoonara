# Stage 2A: NPC Job Center

Stacked on reviewed Stage 1 `60334bae1f83f700331d2d37720d202a1d8ef58f` (PR #2). Stage 1 remains unmerged; this branch targets that foundation, not production.

## Play

Open Job Center from its map hotspot or Buildings. Mara's welcome delivery takes 10 seconds and pays 1.25 EC + 25 XP; after claiming, take a 10-second break. Level 2 adds Ivo's 30-second stockroom job (3.50 EC, 40 XP, 20-second break). Level 3 adds Nia's 60-second park inventory (6 EC, 60 XP, 30-second break). These are conservative first-playable tuning defaults, not a paid economy. Every 100 XP adds a level up to 25. Other buildings remain previews, even when their level gate is reached.

Start one job, close the panel or sign out, return later and claim. There is no automatic payout, job stacking, offline multiplier, cancellation, transfer, trading, real money or pay-to-win. The recent five immutable receipts appear in the panel. The original grant remains 500 EC exactly once.

## Authority and invariants

- Clients submit a catalog ID and UUID request key to start, or a run UUID to claim. Never an amount, XP value, duration, timestamp, level or player ID.
- Database checks confirmed auth identity and existing founder; shared per-founder advisory lock serializes bootstrap/start/claim. Clock is sampled after acquiring the lock. Catalog/reward/timer snapshots are server-owned and runs are immutable.
- One unfinished job globally per founder; a global cooldown begins at claim, so leaving a completed job idle cannot bank cooldown time. Start replays return the same run, conflicting request reuse fails. Claim replays return the original receipt, even after another job starts.
- Claim inserts its unique receipt and unique-source ledger transaction, exactly two opposite integer-hundredths entries, wallet credit and XP/derived level in one transaction. Failures roll back everything. Deferred checks verify receipt timing, owner, reward snapshot, balanced issuance, ledger/wallet agreement and total XP from receipts.
- Accounts, runs, receipts, ledger transactions and entries reject updates/deletes. Founder identity/reputation stay permanent. Public writes have no grants/policies; own-run/receipt/profile/wallet reads use RLS. Catalog is authenticated read-only. Private ledger has deny-all RLS and no table privileges for API users. SECURITY DEFINER functions have empty search paths; only narrow wrappers are exposed. No service key is used.
- Integer balance is capped at JavaScript's safe integer limit; XP is bounded at 1 billion. Caps fail atomically. Rewards are deterministic and bounded, with no external payments.
- Server-side flag is defense in depth, not database authorization. Direct RPCs remain secure when enabled. Existing auth and modal/dock behavior are preserved.

## Isolated development setup

Do not apply this migration to the hosted Stage 1 release candidate database. No hosted schema or environment has been changed by this PR. No paid database or branch was provisioned.

Use a disposable local Supabase instance (`npx supabase@2.75.0 start`, `db reset --local --no-seed`) and its public URL/key; set server-only `TYCOONARA_JOBS_ENABLED=true` there. The default is false. Existing hosted previews therefore show a clear unavailable message without invoking earnings RPCs against Stage 1. Production remains guarded.

A hosted playable preview requires a separate isolated database or approved branch, cost verification, matching preview-only envs, the jobs migration and hosted auth smoke checks. Existing project credentials must not be repointed to a new schema behind the Stage 1 candidate. Do not enable the flag on the Stage 1 database. Vercel project inspection is currently denied for the owning team; restoring scope access is required before configuring a safe hosted preview.

Migration CLI execution was attempted but unavailable in the disconnected workspace (uncached Supabase CLI); the SQL migration is committed and executed in isolated CI. CI installs the pinned CLI and resets local Supabase. Do not run destructive reset commands on hosted databases.

## Verification

CI runs Stage 1 security/bootstrap races on the original schema, snapshots a populated founder, upgrades that same DB and asserts profile/balance preservation. It reruns security tests and exercises 12-way start/claim races, conflicting/late replays, unknown/locked jobs, extra forged arguments, early claims, direct timer/reward/wallet/XP writes, foreign/unverified identity, cooldowns, immutable records, atomic totals and actual level unlocks. Timers use real database time; no test bypass is deployed.

Real local Supabase browser tests cover signup/resend/confirmation/onboarding, job start → close/reload → recover timer → claim → updated HUD/receipt/cooldown, sign-out/recovery/re-login/persistence, both themes and desktop/mobile, with Axe and screenshots. Existing 320–430px, landscape, keyboard/focus/modal, all 11 buildings and floating dock regressions remain in CI. Hosted smoke coverage remains separately blocked and is not implied by local results.
