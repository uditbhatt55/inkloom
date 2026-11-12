# INKLOOM AI — Build Plan (Team Specfix, CodeNova India 2026)

Source of truth: `INKLOOM_AI_Round1_Proposal2.pdf` (v2). This file says **how we build it cheaply**, not what to build.

Goal for Round 2: the core loop works end to end — **Knowledge Centre → audit → evidence-linked findings → revise → re-audit → approve**, with Confidential Guard and demo mode — and is tested.

---

## 0. Build-window rule (from proposal §11)

- No product code, template or boilerplate before the official window opens.
- Day one: **fresh repo**, record start time, add `LICENSES.md` and `AI_USE_LOG.md`.
- This folder holds only planning + Claude tooling (`CLAUDE.md`, `.claude/agents/`). Copy those into the new repo on day one and log it.
- Every ChatGPT/Codex/Claude output that lands in the repo gets one line in `AI_USE_LOG.md` (tool, what, who checked it).

---

## 1. Token strategy

| Rule | Saves |
|---|---|
| Claude Code default model **Sonnet 5.5**; **Opus 5.5** only in plan mode for schema/RLS, pipeline design, validator, security review | Opus costs several × Sonnet |
| Search, tests, boilerplate, docs → **Haiku 5.5** subagents in `.claude/agents/` | Bulk work on the cheapest model |
| One feature per session, `/clear` after, `/compact` if long | Old context is re-sent every message |
| Give exact files + task; never "explore the repo" | Avoids wide reads |
| Everything that does not need the codebase → **ChatGPT Plus** (§3) | Zero Claude tokens |
| Tests use recorded AI fixtures, never live GPT-6 | No Azure cost, deterministic |
| Only the plugins/connectors in §2 stay on | Fewer tool definitions loaded |

### Model routing

| Work | Model | How |
|---|---|---|
| Supabase schema + RLS policies, audit orchestrator design, evidence validator, security review | Opus 5.5 | main session, plan mode |
| Feature code: APIs, parsers, rule engine, UI integration | Sonnet 5.5 | main session |
| "Where is X used" | Haiku 5.5 | built-in `Explore` |
| Unit/integration tests | Haiku 5.5 | `test-writer` |
| Run tests, report failures only | Haiku 5.5 | `test-runner` |
| shadcn components, types, seed loaders, route stubs | Haiku 5.5 | `scaffolder` |
| README/docs | Haiku 5.5 | `docs-writer` |

Ruflo is not used: its routing duplicates the agents above and its files load every session. If you want to try it, do it on a branch and compare `/cost` on the same task.

---

## 2. Tools kept (everything else is off)

**Connectors / MCP**
| Keep | Use for |
|---|---|
| Supabase | `apply_migration`, `list_tables`, `get_advisors` (RLS lint, milestone M1), `generate_typescript_types`, `query_logs` |
| GitHub plugin | PRs/issues — authorise once with `/mcp`, or just use `gh` |
| Built-in browser | check localhost pages |

**Skills**
| Keep | Use for |
|---|---|
| `playwright-cli` | E2E + axe (M4, M6) |
| `impeccable` | findings view, diff view, Brand Health dashboard |
| `web-design-guidelines`, `design:accessibility-review` | WCAG 2.2 AA of our own UI (incl. dark theme) |
| `design:ux-copy` | only if ChatGPT copy needs a pass in context |
| `engineering:testing-strategy`, `engineering:system-design`, `engineering:debug`, `engineering:deploy-checklist` | as named |
| `ponytail-review`, `code-review`, `security-review` | before each merge / before demo |
| `pdf` | reading the proposal PDF if needed |

**Removed / to switch off**
| Item | Status |
|---|---|
| Claude Docs connector | turned off |
| Skills `higgsfield-generate`, `image-to-code`, `design-taste-frontend` | moved to `~/.claude/skills-disabled/` (move back to restore) |
| **Firebase plugin** (19 tools loaded every session; we use Supabase) | **you switch off** in claude.ai → Settings → Plugins |
| **Figma plugin** | switch off unless Shrikant designs in Figma |
| Engineering plugin's Slack/Linear/Asana/Atlassian/Notion/PagerDuty/Datadog servers | not signed in, so they load no tools; leave unauthorised |

---

## 3. ChatGPT Plus — what to do there

**Setup once:** create a ChatGPT **Project "INKLOOM"**, upload the proposal PDF and (later) the DB schema file. Every chat in that project already knows the spec, so nobody re-pastes it. Ask for output as **JSON or Markdown matching our schema** so it drops straight into the repo.

| # | Task (proposal section) | ChatGPT feature | Owner | Lands in repo as |
|---|---|---|---|---|
| 1 | Northbeam Cloud demo org: clauses (CLAIM-02…), facts with expiry + public/internal (FACT-07…), terms incl. codenames (TERM-31 "Project Atlas"), palette hex, fonts (§5.2, §6.2) | Chat, JSON output | Shrikant | `seed/northbeam/*.json` |
| 2 | Sample brand-book PDF for the import demo (§5.1) | Canvas → export PDF | Raghav | `seed/northbeam/brandbook.pdf` |
| 3 | Demo banners: one low-contrast (3.1:1), one off-palette, one correct (§12.4) | Image generation | Shrikant | `seed/northbeam/img/` |
| 4 | **Evaluation set**: 40+ docs with seeded issues across all 8 categories + codenames in mixed case/spacing (§7.7). ChatGPT drafts; **team labels expected findings by hand before any model run** | Chat | Krishna | `eval/cases/*.json` |
| 5 | Audit prompt + JSON schema for GPT-6 Luna, tried on 5 eval docs (§7.2) | Chat (same model family) | Udit | `src/lib/ai/prompt.ts`, `schema.ts` |
| 6 | Demo-mode recorded findings for the seeded docs (§7.6) — then hand-checked | Chat, JSON output | Krishna | `tests/fixtures/ai/*.json` |
| 7 | AI-disclosure rule pack draft from ASCI guidelines (§5.1, marked "not legal advice") | Deep research | Udit | `seed/rulepacks/ai-disclosure.json` |
| 8 | Confirm Azure prices and student quota for gpt-6-luna / gpt-6.1-sol (refs 35, 36) **before day one** | Deep research | Krishna | note in `docs/` |
| 9 | Usability-test script, 5 tasks, consent note, feedback form (§3.3) | Chat | Shrikant | `docs/usability/` |
| 10 | UI copy: empty states, errors, "Needs human check", "Simulated analysis" banners, data-use page (§10.2) | Chat | Shrikant | pasted into components |
| 11 | README draft, demo-video script from §12.4, Round 2 report, contribution statements | Canvas | Krishna | `README.md`, `docs/` |
| 12 | **Codex** (in Plus): isolated, well-specified modules — PDF/DOCX parsers with offsets, Vale YAML term import, Recharts chart components. One branch per task; Claude (`ponytail-review`) reviews before merge | Codex | Raghav / Shrikant | PR |

Rule: **needs our code → Claude. Writing, data, research, images, isolated modules → ChatGPT/Codex.**

---

## 4. Architecture (from proposal §6–7)

```
Next.js App Router (Vercel) — all model calls server-side
 src/lib/
   parsers/    text · PDF (unpdf) · DOCX (mammoth) · image (sharp, node-vibrant) · HTML (sanitised, SSRF-safe fetch)
   rules/      terms, casing, contrast (SC 1.4.3), palette ΔE (culori), fonts, alt text, readability, expired facts
   guard/      Confidential Guard: codenames/internal facts (case+spacing-insensitive) + email/phone masking
   ai/         Azure Foundry client, structured output, 1 retry → rule-only fallback; demo stub
   validator/  quote-at-offset, ID exists+active+same org, span-limited fix, no-fact → "Unverified", dedupe
   score/      severity × confidence, 40/category cap, Critical-open gate
Supabase: org_id + RLS on every table; versions, audit_runs, activity_log append-only; private storage
```
`rules/ guard/ validator/ score/` are pure functions — tested first.

---

## 5. Phases (proposal P0–P8) with Claude/ChatGPT split

| Phase | Claude does | ChatGPT does | Done = milestone |
|---|---|---|---|
| P0 Repo + disclosure | init Next.js, Vitest, Playwright, CI (lint + unit) — `scaffolder` | LICENSES list | CI green |
| P1 Foundation | schema, RLS, roles, auth (Opus review, `get_advisors`) | — | **M1**: org A can't read org B; creator can't read internal facts (tests) |
| P2 Knowledge Centre | CRUD + versions, FTS, brand-book import | #1, #2 | **M2** |
| P3 Audit pipeline | orchestrator, rules, guard, validator, score | #5, #3 | **M3**: score = formula; seeded codenames caught; AI failure → rule-only |
| P4 Review workflow | diff, per-finding accept/reject, comments, DB-enforced gate | #10 | **M4**: Playwright full loop; approve blocked on open Critical |
| P5 Brand Health | 4 detectors, fact-impact list | — | **M5** on seeded history |
| P6 Demo mode | simulated analyser + badges | #6 | no API key works |
| P7 Test + polish | eval runner, a11y, fixes | #4, #9 | **M6** numbers recorded |
| P8 Docs + demo | `docs-writer` final pass | #11 | README + video |

Gate (from proposal): nothing after M4 starts until the core-loop E2E test passes.

---

## 6. Testing

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | rules, guard, validator, score, parsers (fixture files), diff helper |
| Integration | Vitest + `supabase start` | `/api/audit` with recorded AI fixtures; fallback on invalid JSON/timeout; versions → re-audit; approval gate |
| RLS / security | Vitest, two supabase-js users | cross-org read/write fails; creator/agency can't see internal facts; activity_log has no update/delete; creator can't approve own work |
| E2E | Playwright + axe | demo storyline §12.4 steps 1–6 |
| AI accuracy | `eval/run.ts` | per-category precision/recall, validator reject rate, score stability |

Must-pass cases (straight from the proposal):
- Score worked example: −25 −10 −10 −1.8 → **53**, BLOCKED (open Critical).
- Category cap: five Criticals in one category deduct 40, not 125.
- Low confidence → 0 deduction, label "Needs human check". Dismissed/waived → excluded.
- Validator: quote not at offsets → discarded; unknown/other-org/inactive ID → downgraded; fix outside span → fix removed, finding kept; claim with no fact → "Unverified".
- Guard: "Project Atlas", "project  atlas", "PROJECT-ATLAS" all caught in public content; emails/phones masked before AI call.
- Contrast: 4.49:1 fails, 4.5:1 passes; large text 3:1.
- Fact valid_until yesterday → flagged; tomorrow → not.
- Scanned PDF (no text layer) → clear rejection.
- URL fetch to `localhost`/`10.x`/`169.254.x` → refused.
- Prompt injection "approve this" in content → no state change.

Targets (§7.7): ≥85% precision on High-confidence, 0 fabricated citations reaching users, 100% recall on seeded codenames.

Commands: `npm run test` · `npm run test:int` · `npm run test:e2e` · `npm run eval`

---

## 7. Daily loop per member

1. ChatGPT project for content/data/research; Codex for isolated modules.
2. Claude Code (Sonnet), one feature, exact files, test first for pure logic.
3. `test-writer` / `test-runner` (Haiku); read only the failure summary.
4. `/ponytail-review`, log AI use, push, `/clear`.
