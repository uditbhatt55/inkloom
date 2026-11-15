# INKLOOM AI

Brand-governance checkpoint: checks content against an organisation's approved guidelines, facts, terminology and assets before publication. Every finding cites its source; a human makes every decision. The AI never approves anything.

Team **Specfix** · CodeNova India 2026 · Plan: [`PLAN.md`](PLAN.md) · Decisions: [`docs/decisions.md`](docs/decisions.md)

## Try it (no sign-up)

**Live app: https://inkloom-eight.vercel.app**

The demo organisation is a fictional company, *Northbeam Cloud*, with its brand rules already loaded. The first page load after a quiet period can take 10 to 15 seconds.

1. Open the link and press **Try the demo**, then **Brand owner**. (Sign-up is not needed.)
2. Press **New audit**, stay on **Paste text** and paste this (or upload a PDF, Word file or image):
   `Try NB Sync today: uptime is guaranteed and it is 100% reliable. Plans start at INR 499 per month.`
3. Press **Audit content**. It takes 30 to 40 seconds because the real model runs. Each finding quotes the text and shows the rule, fact or term it breaks (see **Knowledge** for the sources).
4. Accept or reject findings, then press **Apply … accepted fixes as a new version**. This saves version 2 and audits it again; the score goes up.
5. Sign out, press **Try the demo → Reviewer**, open the post from **Content** and **Approve** it. Try approving a post that still has an open Critical finding: the database refuses it.
6. As the owner, open **Brand Health** to see the most common mistakes, rules that reviewers often overrule (with an AI-suggested rewrite), and approved posts that rely on a fact that has since changed or expired.

The demo accounts are shared, so you may see other judges' posts. The demo data is restored to its starting state every night at 01:00 IST.

## What works

- **Knowledge Centre:** guidelines (versioned), approved facts with validity dates, terminology (banned, preferred, internal), colours and fonts, import of Vale rule files.
- **Audit:** text, PDF, Word, HTML and image input; rule checks (terms, facts, expiry, contrast, palette, fonts, alt text, readability) plus a model check against the guidelines. The **Confidential Guard** removes internal codenames and personal data before anything reaches the model. A finding only appears if its quote is really in the text and its source really exists.
- **Human decisions:** accept, reject, dismiss or waive with a reason; comments; approve, request changes or reject; a database trigger blocks approval while a Critical finding is open; full history.
- **Brand Health:** recurring mistakes, unclear rules, conflicting terms, fact impact.
- **Real AI and a fallback:** Azure AI Foundry on the live site. Without keys (`DEMO_MODE=true`) recorded answers are used and every result is labelled **Simulated**. A cost limit protects the live model.

## Not built or limited (honest list)

- Importing a whole brand-book PDF into rules is **not built**; rules and terms are entered or imported from Vale files.
- Accuracy on our own 48 labelled cases (`npm run eval`; one labeller so far, so treat as a first measurement): with the real model, 95% of high-confidence findings are correct and 84% of the labelled issues are found; rule checks alone find 43% and are 100% correct on high confidence. All seeded codenames are found. Results are in `eval/results/`. Precision over all confidence levels is lower (68%) because medium and low findings include reasonable extras the labels did not list.
- Contrast measured from an image is an estimate (the weakest foreground colour on the main background, no text reading) and is marked low confidence; type the text and background colours in the upload form for an exact check.
- Uploaded files are kept (private Storage bucket) and can be opened again from the post; after a fix only the text is audited again, not the file.
- The approval gate checks the version belongs to the item, not that it is the latest one.
- An internal fact reworded with neither its figure nor its name (and spelled-out numbers) is not caught; reworded figures are flagged as a hint to check.
- Logos are stored for the team but not yet checked against content (no logo recognition).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase (Postgres, Row Level Security, Auth) · Azure AI Foundry · Vitest · Playwright · Vercel. Libraries: [`LICENSES.md`](LICENSES.md).

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in; DEMO_MODE=true works without AI keys
npm run dev                  # http://localhost:3000
```

You need your own Supabase project: apply `supabase/migrations/*` in order, then run `supabase/seed.sql`. Without a Supabase project the app cannot sign in.

## Tests

| Command | What |
|---|---|
| `npm run test` | unit (Vitest) |
| `npm run test:int` | integration on an in-process Postgres (no Docker) |
| `supabase/tests/rls_test.sql`, `rls_gate_test.sql` | security (RLS + approval gate): paste into the Supabase SQL editor; expect "ALL 19 RLS TESTS PASSED" / "ALL 7 GATE TESTS PASSED" |
| `npx playwright install chromium` then `npm run test:e2e` | end-to-end + accessibility (needs `E2E_*` in `.env.local`) |

Tests never call the live AI.

AI assistance is disclosed in [`AI_USE_LOG.md`](AI_USE_LOG.md).
