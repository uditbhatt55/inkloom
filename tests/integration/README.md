# Integration tests

`npm run test:int` — runs in CI, needs no Docker and no Supabase project.

| File | What it covers | Database |
|---|---|---|
| `pipeline.test.ts` | full audit pipeline with recorded AI fixtures (`tests/fixtures/ai/`) | none |
| `db.test.ts` | all migrations apply; `supabase/tests/rls_test.sql` (19) and `rls_gate_test.sql` (7); `save_audit()` | PGlite |
| `audit-service.test.ts` | upload text → audit → save, on the Northbeam seed (`supabase/seed.sql`) | PGlite |

**PGlite** is real Postgres compiled to WASM, running in the test process. `tests/db/harness.ts` adds the small part of
Supabase our SQL needs (`auth.users`, `auth.uid()`, the anon/authenticated/service_role roles and default grants).
It does not run Supabase Auth, Storage or the REST API, so the `/api/audit` route itself (cookies, HTTP) is checked
against a real local Supabase:

```bash
npx supabase init           # once: creates supabase/config.toml (answer "N" to the VS Code questions)
npx supabase start          # needs Docker Desktop running
npx supabase db reset       # applies supabase/migrations/* and supabase/seed.sql
npx supabase gen types typescript --local > src/lib/database.types.ts
```

Then put the printed API URL, anon key and service_role key in `.env.local`, sign up in the app, add yourself to the
demo org with `supabase/demo-membership.sql`, and use the upload screen (or `POST /api/audit`).
