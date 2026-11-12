# INKLOOM AI

Brand-governance checkpoint: checks content against an organisation's approved guidelines, facts, terminology and assets before publication. Every finding cites its source; a human makes every decision.

Team **Specfix** · CodeNova India 2026 · Plan: [`PLAN.md`](PLAN.md)

## Run locally
```bash
npm install
cp .env.example .env.local   # fill in; DEMO_MODE=true works without AI keys
npm run dev
```

## Tests
| Command | What |
|---|---|
| `npm run test` | unit (Vitest) |
| `npm run test:int` | integration (needs `npx supabase start`) |
| `supabase/tests/rls_test.sql` | security (RLS + approval gate): paste into Supabase SQL editor; expect "ALL 19 RLS TESTS PASSED" |
| `npx playwright install chromium` then `npm run test:e2e` | end-to-end + accessibility |

AI assistance is disclosed in [`AI_USE_LOG.md`](AI_USE_LOG.md); libraries in [`LICENSES.md`](LICENSES.md).
