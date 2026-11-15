# INKLOOM AI

Brand-governance checkpoint: checks content against an organisation's approved guidelines, facts, terminology and assets before publication. Every finding cites its source; a human makes every decision. The AI never approves anything.

Team **Specfix** · CodeNova India 2026 · Plan: [`PLAN.md`](PLAN.md) · Decisions: [`docs/decisions.md`](docs/decisions.md)

## Try it (no sign-up)

**Live app: https://inkloom-specfix.azurewebsites.net**

The demo organisation is a fictional company, *Northbeam Cloud*, with its brand rules already loaded.

1. Open the link and press **Try the demo**, then **Brand owner**. (Sign-up is not needed.)
2. Press **New audit**, stay on **Paste text** and paste this (or upload a PDF, Word file or image):
   `Try NB Sync today: uptime is guaranteed and it is 100% reliable. Plans start at INR 499 per month.`
3. Press **Audit content**. It takes 30 to 40 seconds because the real model runs. Each finding quotes the text and shows the rule, fact or term it breaks (see **Knowledge** for the sources).
4. Accept or reject findings, then press **Apply … accepted fixes as a new version**. This saves version 2 and audits it again; the score goes up.
5. Sign out, press **Try the demo → Reviewer**, open the post from **Content** and **Approve** it. Try approving a post that still has an open Critical finding: the database refuses it.
6. As the owner, open **Brand Health** to see the most common mistakes, rules that reviewers often overrule (with an AI-suggested rewrite), and approved posts that rely on a fact that has since changed or expired.

The demo accounts are shared, so you may see other judges' posts. The demo data is restored to its starting state every night at 01:00 IST.

## What works

- **Knowledge Centre:** guidelines (versioned), approved facts with validity dates, terminology (banned, preferred, internal), colours and fonts, import of Vale rule files, and **Import brand book**: upload a brand-book PDF and the AI drafts guidelines, terms and colours; the owner ticks what to keep, and nothing is saved until they do.
- **Audit:** text, PDF, Word, HTML and image input; rule checks (terms, facts, expiry, contrast, palette, fonts, alt text, readability) plus a model check against the guidelines. The **Confidential Guard** removes internal codenames and personal data before anything reaches the model. A finding only appears if its quote is really in the text and its source really exists.
- **Human decisions:** accept, reject, dismiss or waive with a reason; comments; approve, request changes or reject; a database trigger blocks approval while a Critical finding is open; full history.
- **Brand Health:** recurring mistakes, unclear rules, conflicting terms, fact impact.
- **Real AI and a fallback:** Azure AI Foundry on the live site. Without keys (`DEMO_MODE=true`) recorded answers are used and every result is labelled **Simulated**. A cost limit protects the live model.

## Not built or limited (honest list)

- Brand-book import works on PDFs with a text layer (not scanned pages); every item it drafts must be checked by the owner before saving.
- Accuracy on our own 48 labelled cases (`npm run eval`; one labeller so far, so treat as a first measurement): with the real model, 98% of high-confidence findings are correct and 97% of the labelled issues are found; rule checks alone find 51% and are 100% correct on high confidence. All seeded codenames and internal facts are found. The model's answers vary a little between runs. Results are in `eval/results/`. Precision over all confidence levels is lower (79%) because medium and low findings include reasonable extras the labels did not list.
- Contrast measured from an image is an estimate (the weakest foreground colour on the main background, no text reading) and is marked low confidence; type the text and background colours in the upload form for an exact check.
- Uploaded files are kept (private Storage bucket) and can be opened again from the post; after a fix only the text is audited again, not the file.
- The approval gate checks the version belongs to the item, not that it is the latest one.
- An internal fact reworded with neither its figure nor its name (and spelled-out numbers) is not caught; reworded figures are flagged as a hint to check.
- Logos are stored for the team but not yet checked against content (no logo recognition).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui · Supabase (Postgres, Row Level Security, Auth) · Azure AI Foundry · Vitest · Playwright · Azure App Service. Libraries: [`LICENSES.md`](LICENSES.md).

## Hosting

The live app runs on **Azure App Service** (Linux, Central India, always on, so there is no cold start). Every push to `main` is tested, built (`scripts/build-azure.sh`) and deployed by `.github/workflows/deploy-azure.yml`; the app's keys live in the App Service settings, never in the repository. Files over 4 MB are uploaded straight to Storage, so there is no request-size limit in the way. See decision D29 in [`docs/decisions.md`](docs/decisions.md).

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
