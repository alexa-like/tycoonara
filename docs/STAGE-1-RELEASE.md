# Stage 1 release candidate — blocked, no production authorization

Candidate: PR #2, `feat/stage-1-foundation`, `60334bae1f83f700331d2d37720d202a1d8ef58f`. Application source matches `bd78df10773b553d96869e5fca447d199f5ea33e`; final commit contains screenshot documentation only. Four jobs passed in Actions run 39269574056, including 39 browser tests and isolated database/auth coverage. Owner accepted the UI.

Do not merge or release until these gates have evidence:

1. Restore Vercel integration access to team `team_nNRiGDcyxWPsYNGf8NbKB9yR` / project `prj_O0QCZZHMCZlXrIGE9dI88N92SNie`. GET project returned 403 on 2026-10-19; no CLI authentication is configured. Inspect current production branch, protection, environment scopes and ignored-build guard. Previously configured guard: `test "$VERCEL_ENV" = "production"` (exit zero skips production builds). Do not remove it during development.
2. Verify hosted Supabase confirmation/resend templates use the SSR token-hash `/auth/confirm` route, and recovery uses the supported callback flow. Verify exact approved site URLs/redirect allowlist, SMTP/provider recipient restrictions and delivered emails. Perform hosted signup → resend → verification → onboarding → refresh → sign-out → recovery/update → re-login on the pinned candidate. Never expose tokens in logs/screenshots.
3. Review disabled leaked-password protection; check plan availability/cost before enabling it. Private ledger RLS-without-policy advisor notices are intentional deny-all, not missing public access.
4. Verify branch protection/required checks with an owner: the GitHub integration cannot read the administration-only branch-protection endpoint (403). Re-run checks if release code/config changes. Physical-device UI acceptance is recorded; native zoom/screen-reader smoke remains manual.
5. Record exact candidate SHA, config evidence, passing hosted results and rollback plan, then request explicit production release approval. Only after approval coordinate guard removal and merge/release. Retain previous deployment; roll application back if needed without resetting or editing financial records.

Hosted Supabase currently has exactly the two Stage 1 migrations. Stage 2A is separately authorized development only; do not apply its migration to this database during release preparation. No project recreation, paid infrastructure, merge or production deployment was performed.
