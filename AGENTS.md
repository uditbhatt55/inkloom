# AGENTS.md — rules for Codex and other agents

INKLOOM AI: a brand-governance checkpoint. Checks content against an organisation's approved guidelines, facts and assets before publication. A human makes every final decision. The product proposal (`INKLOOM_AI_Round1_Proposal2.pdf`, summarised in `PLAN.md`) is the spec.

## Stack
Next.js App Router, TypeScript, Tailwind, shadcn/ui · Supabase (Postgres, RLS, Auth, Storage) · Azure AI Foundry (gpt-6-luna, gpt-6.1-sol) · Vitest · Playwright · Vercel.

## Commands
- `npm run test` unit tests
- `npm run test:int` integration tests
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Run all of these before you finish. Do not finish with any of them failing.

## Hard rules
- **Never change these without asking:** the score formula (`src/lib/score`), the evidence validator rules (`src/lib/validator`), the roles and permissions, the approval gate (database trigger `apply_decision`). They are fixed by the proposal (§7.3–7.5, §8.1).
- **Pure logic stays pure.** `src/lib/{rules,guard,validator,score,text}` must not touch the database or the network. Each change there needs a Vitest test.
- **Every Supabase table has RLS.** A new table needs a migration, an RLS policy and an RLS test.
- **Tests never call a live AI model.** Use recorded fixtures in `tests/fixtures/ai/`.
- **Demo mode works with no API keys.** Simulated results must be labelled "Simulated".
- **Secrets:** never commit `.env*`, API keys, or the Supabase service-role key. Keys live only in `.env.local` or Vercel environment variables. Never put the service-role key in a `NEXT_PUBLIC_` variable.
- **Internal data never reaches the AI model.** Internal facts and terms are masked before any model call (see `src/lib/guard`).
- **Log AI help.** Every file you produce goes in `AI_USE_LOG.md`.

## Git
- Work on a branch (`codex/<task>`), never directly on `main` or `udit`.
- Open a pull request. Do not merge it yourself.
- Do not add a co-author or attribution line for any AI tool to commits or pull requests.
- Keep commits small and describe what changed and why.

## Style
- Keep the code simple. No abstraction or option that nobody asked for.
- Comment only the reason behind a non-obvious choice.
- If a shortcut has a known limit, write it as a comment: `shortcut: <limit>, <when to upgrade>`.

## Where things are
- `PLAN.md`: build plan and phases
- `docs/decisions.md`: design decisions D1–D10. Follow them.
- `docs/research/`: regulatory and Azure research
- `supabase/migrations/`: database schema (apply in order)
- `supabase/tests/`: SQL security tests
- `tests/fixtures/`: recorded AI responses and sample knowledge base
