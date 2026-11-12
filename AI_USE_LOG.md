# AI use log

Every AI-produced file or change that lands in this repo. Required for the hackathon disclosure (proposal §11, §13).

| Date | Tool | What | Files | Checked by |
|---|---|---|---|---|
| 2026-11-12 | Codex | PR #3 review fixes: file-specific code prefixes, skip regex patterns with warnings, deduplicate preferred terms, regression tests | `src/lib/rules/vale.ts`, `src/lib/rules/vale.test.ts`, `AI_USE_LOG.md` | Automated checks; human review pending |
| 2026-11-12 | Codex | Vale terminology importer, unit tests, YAML dependency and licence documentation | `src/lib/rules/vale.ts`, `src/lib/rules/vale.test.ts`, `package.json`, `package-lock.json`, `LICENSES.md`, `AI_USE_LOG.md` | Automated checks; human review pending |
| 2026-11-12 | Claude (Claude Code) | Build plan, Claude project rules, Haiku subagents, ChatGPT prompt pack | `PLAN.md`, `CLAUDE.md`, `.claude/agents/*`, `CHATGPT_PROMPTS.md` | Udit |
| 2026-11-12 | ChatGPT Deep Research | ASCI AI-labelling / CCPA / EU AI Act research | `docs/research/asci-ai-labelling.json` | Claude checked every clause against the ASCI PDF and CCPA Gazette; review in `asci-ai-labelling.review.md` |
| 2026-11-12 | ChatGPT Deep Research | Azure model prices, quota, capabilities | `docs/research/azure-models.md` | Claude re-did the arithmetic; quota checked live in Foundry |
| 2026-11-12 | ChatGPT | Usability-test kit | `docs/usability/kit.md` | Claude reviewed; added Tasks 6–7 |
| 2026-11-12 | Claude (Claude Code) | P0 scaffold: create-next-app, shadcn init, Vitest/Playwright config, CI workflow, `.env.example` | repo root | Udit |
| 2026-11-12 | Claude (Claude Code) | P1: Supabase schema, RLS policies, approval-gate trigger, append-only log, private RLS helpers, 19 RLS tests, generated DB types | `supabase/migrations/*`, `supabase/tests/rls_test.sql`, `src/lib/database.types.ts` | Udit; tests run on Supabase (all pass), security advisor clean |
| 2026-11-12 | Claude (Claude Code) | P3 core audit logic: score engine + gate, Confidential Guard + PII masking, rule engine (terms, WCAG contrast, expired facts), evidence validator + merge, 47 unit tests; DB gate hardening migration + 7 gate tests; design decisions D1–D4 | `src/lib/{audit,text,score,guard,rules,validator}/*`, `supabase/migrations/20261112000200_*`, `supabase/tests/rls_gate_test.sql`, `docs/decisions.md` | Udit; unit + SQL tests pass |
| 2026-11-12 | Claude (Claude Code) | Edge-case pass on P3 (offset NaN, padded quotes, phone masking, figure matching, overlapping duplicates, runtime enum checks) + AI step: output schema, brand pack, draft prompt, Azure client, demo-mode recorder, audit pipeline with retry/timeout/fallback; 81 unit + 20 integration tests | `src/lib/{ai,audit,text,guard,rules,validator}/*`, `tests/integration/pipeline.test.ts`, `tests/fixtures/*` | Udit; all tests pass |
