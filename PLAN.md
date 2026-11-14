# INKLOOM AI: build plan (Team Specfix, CodeNova India 2026)

Spec: `INKLOOM_AI_Round1_Proposal2.pdf` (v2). This file says how and in what order we build it.

Goal for Round 2: the core loop works end to end and is tested: **Knowledge Centre → audit → evidence-linked findings → revise → re-audit → approve**, with Confidential Guard and demo mode.

## Rules (from proposal §11)
- No product code before the official build window opened. The repo started fresh on day one.
- Every AI-assisted file gets one line in `AI_USE_LOG.md`: tool, what, who checked it.
- Third-party libraries and licences are listed in `LICENSES.md`.

## Team
| Member | Area |
|---|---|
| Udit Bhatt (captain) | database, security, audit logic, integration |
| Raghav Bansal | backend: parsers, rule packs, audit API |
| Shrikant Sharma | UI and product |
| Krishna Sharma | testing, evaluation set, usability tests, docs |

## Architecture (proposal §6–7)
```
Next.js App Router (Vercel); all model calls are server-side
 src/lib/
   parsers/    text · PDF (unpdf) · DOCX (mammoth) · image (sharp: size + dominant colours, D8) · HTML (sanitised, SSRF-safe fetch, D7)
   rules/      terms, contrast (WCAG SC 1.4.3), palette, fonts, alt text, readability, expired facts, wording packs (D5)
   guard/      Confidential Guard: internal terms (case- and spacing-insensitive, D2) + email/phone masking
   ai/         Azure AI Foundry client, structured output, one retry, then rule-only fallback; demo recordings
   validator/  quote check, known and active IDs only, fix limited to the quote, no fact → "Unverified", dedupe (D3)
   score/      severity × confidence, 40 per category cap, open Critical blocks approval (D1)
 Supabase: org_id + RLS on every table; versions, audit runs and activity log are append-only
```
`rules/ guard/ validator/ score/ text/` are pure functions with unit tests. Design decisions: `docs/decisions.md`.

## Phases
| Phase | Scope | Milestone | Status |
|---|---|---|---|
| P0 Setup | Next.js, Vitest, Playwright, CI | CI green | Done |
| P1 Foundation | schema, RLS, roles, auth, approval gate | **M1**: org A can't read org B; creator can't read internal facts | Done |
| P2 Knowledge Centre | guidelines, facts, terms: add/edit, versions, search, brand-book import | **M2** | Not started (data comes from `supabase/seed.sql` for now) |
| P3 Audit pipeline | parsers, rules, guard, AI step, validator, score, `/api/audit` | **M3**: score matches formula; seeded codenames caught; AI failure → rule-only | Done |
| P4 Review workflow | accept/reject per finding, waive/dismiss, comments, decisions, DB gate | **M4**: full-loop Playwright test; approve blocked on open Critical | Done: Playwright M4 test passes; apply-accepted-fixes added (PR #6, #7) |
| P5 Brand Health | 4 detectors, fact-impact list | **M5** on seeded history | Not started |
| P6 Demo mode | simulated reviewer + "Simulated" labels | works with no API key | Done ("Simulated analysis" label); check again in the demo storyline |
| P7 Test + polish | eval runner, accessibility, fixes | **M6**: accuracy numbers recorded | In progress: 48-case eval set labelled (`eval/cases`), runner not built |
| P8 Docs + demo | README, demo video, Round 2 report | README + video | Not started |

Gate (from proposal): nothing after M4 starts until the core-loop E2E test passes.

## Testing
| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | rules, guard, validator, score, parsers, review helpers |
| Integration | Vitest + PGlite (D9) | audit pipeline with recorded AI responses; fallback on invalid output and timeout; migrations; RLS and gate SQL suites; `save_audit()` |
| RLS / security | SQL suites in `supabase/tests/` | cross-org access fails; creator/agency can't see internal facts; activity log has no update/delete; creator can't approve own work |
| E2E | Playwright + axe | demo storyline §12.4 |
| AI accuracy | `npm run eval` (P7, not built yet) | per-category precision/recall, validator reject rate, score stability |

Must-pass cases (from the proposal):
- Score worked example: −25 −10 −10 −1.8 → **53**, blocked (open Critical).
- Category cap: five Criticals in one category deduct 40, not 125.
- Low confidence → 0 deduction, label "Needs human check". Dismissed/waived → excluded.
- Validator: quote not in content → discarded; unknown, other-org or inactive ID → downgraded; fix outside the quote → fix removed, finding kept; claim with no fact → "Unverified".
- Guard: "Project Atlas", "project  atlas", "PROJECT-ATLAS" all caught in public content; emails and phones masked before the AI call.
- Contrast: 4.49:1 fails, 4.5:1 passes; large text 3:1.
- Fact valid_until yesterday → flagged; tomorrow → not.
- Scanned PDF (no text layer) → clear rejection.
- URL fetch to `localhost`, `10.x`, `169.254.x` → refused.
- Prompt injection ("approve this") in content → no state change.

Targets (§7.7): ≥85% precision on High-confidence findings, 0 fabricated citations reaching users, 100% recall on seeded codenames.
