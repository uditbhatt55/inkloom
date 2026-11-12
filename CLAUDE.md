# INKLOOM AI

Brand-governance platform: audits content against an org's guidelines, facts, terms and assets. Full plan: PLAN.md.

## Stack
Next.js App Router + TypeScript + Tailwind + shadcn/ui · Supabase (Postgres + RLS, Auth, Storage) · Azure GPT-6 (structured outputs) · Vitest · Playwright · Vercel

## Rules
- `src/lib/{rules,guard,validator,score}` are pure functions: no DB, no network. Every change there needs a Vitest test.
- Every Supabase table has RLS. New table = migration + RLS policy + RLS test.
- Tests never call the live AI. Use recorded fixtures in `tests/fixtures/ai/`.
- Demo mode must work with no API keys; simulated results are labelled.
- Never commit `.env*`. Keys only in `.env.local`.
- Score formula, validator rules and roles are fixed by the proposal PDF (§7.3–7.5, §8.1). Don't change them without asking.
- Log every AI-produced file in `AI_USE_LOG.md`.

## Commands
- `npm run test` unit · `npm run test:int` integration (needs `supabase start`) · `npm run test:e2e` Playwright · `npm run eval` AI accuracy

## Token habits
- Delegate search to `Explore`, tests to `test-writer` / `test-runner`, boilerplate to `scaffolder`, docs to `docs-writer` (all Haiku).
- Read only the files named in the task. Don't re-read files after editing.
