# Tycoonara · Stage 1

An original 2D browser business RPG foundation built with Next.js App Router, React, TypeScript, Tailwind and Supabase. Issue #1 defines the scope. Jobs, transfers, marketplace gameplay, manufacturing, corporations, chat and payments are deliberately absent.

## Existing infrastructure

- Repository: `alexa-like/tycoonara`
- Supabase: **Tycoonara**, project `zxnmhjlpbvkgkxhkjyfc`, `eu-west-1`
- Vercel: **tycoonara**, project `prj_O0QCZZHMCZlXrIGE9dI88N92SNie`

Reuse these projects. Do not create replacements. Vercel already has the public Supabase URL and publishable key stored as encrypted variables for development, preview and production. No service-role key is needed by this application.

## Local development

Use Node 24 and Docker. Use `npm ci` with the committed dependency lockfile. All direct dependency versions are pinned in package.json.

```sh
npm ci
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase@2.75.0 start
npx supabase@2.75.0 db reset --local --no-seed
cp .env.example .env.local
# Copy the local API URL and anon/publishable key from `supabase status` into .env.local.
# Never copy a service-role key into NEXT_PUBLIC_* variables.
npm run dev
```

Required names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `NEXT_PUBLIC_SITE_URL` is the canonical origin for locally generated email links. Vercel preview deployments use `VERCEL_URL`; production defaults to `VERCEL_PROJECT_PRODUCTION_URL` unless a canonical site origin is explicitly set. Public API keys identify the project; authorization is enforced by the database. Never commit `.env.local`, `.vercel` files, service-role keys or email tokens.

## Auth and email provider settings

Email/password only; no OAuth providers are used. Enable email confirmation, enforce a minimum 12-character password, and keep Supabase Auth rate limits enabled. The application uses server actions (with Next.js origin protection), Supabase's provider rate limits, current SSR cookie handling, `getUser()` server validation and database verification of the confirmed email. Bootstrap accepts no user ID or money amount. It is idempotent and bounded by per-user transaction locking and unique constraints.

In Supabase Dashboard → Authentication → URL Configuration:

1. Set Site URL to the verified production origin once a production release is approved.
2. Allow the exact preview origin under Redirect URLs, including `/auth/callback`, `/auth/confirm` and `/auth/update-password`. For repeatable previews, allow only the project's scoped Vercel hostname pattern, not all Vercel sites.
3. For cross-device email confirmation, use an explicit token-hash template link, e.g. `https://YOUR_ORIGIN/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. For recovery use `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. Replace YOUR_ORIGIN with the intended deployment origin; use separate templates/settings for preview versus production when testing.
4. The default `{{ .ConfirmationURL }}` templates also work through `/auth/callback` using PKCE **in the browser that initiated the request**. Both routes are supported, invalid/expired links return to sign-in, and `next` is an allowlist.
5. Configure a production SMTP provider before a public launch. Supabase's built-in mail provider restricts recipients and send volume. Test with an authorized recipient; do not claim delivered email or public signup is verified until it actually is.

CI uses the supported Docker Hub image registry to avoid anonymous ECR throttling. In local development the Mailpit email capture UI is http://127.0.0.1:54324. CI uses the real local Supabase Auth service with confirmed email enabled and captures links only from that isolated local inbox. No external email is sent during tests.

## Database and audit model

The Stage 1 migrations in `supabase/migrations/` have been applied to the dedicated Tycoonara project. For another fresh local database use `supabase db reset`; to apply reviewed migrations to the existing linked remote use `supabase link --project-ref zxnmhjlpbvkgkxhkjyfc`, inspect `supabase migration list`, then `supabase db push` (do not replay an already-applied migration).

`players` and `wallets` allow authenticated SELECT of one's own records only. They have no client INSERT/UPDATE/DELETE grants. Stage 1 levels, XP, reputation and balance also have exact-value CHECK constraints. Every public table has RLS. Authoritative data lives behind a narrowly scoped RPC: its public wrapper is SECURITY INVOKER; the privileged transaction is in the non-exposed `private` schema, with an empty search path, explicit `auth.uid()` and confirmed-email checks, no user_metadata authorization, and explicit EXECUTE grants.

The initial grant is **50000 integer subunits = 500.00 EC**. Each account gets one transaction with two entries: issuance **−50000**, player **+50000**. Unique player/transaction records and a transaction-scoped advisory lock serialize repeated and simultaneous bootstrap calls. Deferred constraint triggers require exactly two matching entries, zero net issuance, the correct player, and a matching immutable wallet. Failed onboarding rolls back atomically. Ledger entries, accounts, transactions, players and wallets reject UPDATE/DELETE even from privileged callers. Auth account deletion is restricted to retain the audit trail; an eventual erasure/anonymization policy requires a reviewed future migration. No gameplay mutation endpoints exist.

Security advisor informational notices for private ledger tables having RLS but no policies are expected: these tables intentionally deny direct access. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy .

## Tests

```sh
npm run lint
npm run typecheck
npm test
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node tests/concurrency.mjs
npm run build
npx playwright install chromium
npm run test:e2e
```

The SQL security suite is rollback-only and may also run on the dedicated remote project through its SQL tool. The concurrency suite creates local fixtures and is **local/CI only**. `local-auth.sql` is an optional stub for experimenting on an empty standalone Postgres instance, never for hosted Supabase. Normal CI uses actual local Supabase Auth instead.

Browser acceptance tests use desktop Chromium and a mobile touch viewport: landing/light/dark persistence, unauthorized protected routes, invalid email redirects, signup → captured verification email → username/avatar → map → building states → refresh/persistence → sign-out → recovery → password update → sign-in. Axe WCAG checks run on landing, auth, onboarding, map and building dialogs. CI runs independent quality, ledger and auth-e2e jobs: installation, lint, full dependency audit, unit tests, SQL/RLS tests, 12 concurrent bootstraps, production build, typecheck and browser tests. The isolated `tests/presentation` application renders the real district component with explicit fixture data to test map/HUD accessibility without bypassing production authentication. The full auth-e2e job separately verifies real Supabase authentication and persisted data. Browser traces and screenshots are disabled to avoid publishing session/email tokens.

## Deployment and release

Push the feature branch and open a PR. Vercel Git integration should build a **preview**, using its configured environment variables. Inspect build logs and test the exact preview. The Vercel project currently has an ignored-build guard (`test "$VERCEL_ENV" = "production"`) because its first Git build unexpectedly targeted production. Keep that guard until the production branch is explicitly set to `main` in the Vercel project settings and the reviewed Stage 1 acceptance gate passes. Production is gated on those checks and an approved merge; do not deploy untested code to production. No custom deployment workflow or production tokens are required.

If the preview is protected by Vercel Authentication, use the authenticated Vercel integration to inspect it or grant testers access. Do not disable protection automatically. A `vercel.app` URL alone does not establish a healthy deployment.

## Assets and accessibility

The original SVG district and four founder portraits were authored for this project; no stock art, WebGL or 3D assets. The eleven buildings keep the issue's exact level gates. The scrollable mobile map has a keyboard-accessible building directory; native dialogs support Escape, focus containment and return to the opener. Touch targets are at least 44px. Light mode is default, dark mode is user-selected, and reduced-motion preference is respected.

Stage 1 ends here. Stage 2 requires explicit approval.
