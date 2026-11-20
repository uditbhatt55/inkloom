# INKLOOM AI

Brand-governance checkpoint: checks content against an organisation's approved guidelines, facts, terminology and assets before publication. Every finding cites its source; a human makes every decision. The AI never approves anything.

Team **Specfix** · Plan: [`PLAN.md`](PLAN.md) · Decisions: [`docs/decisions.md`](docs/decisions.md)

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

The demo accounts are shared, so you may see other visitors' posts. The demo data is restored to its starting state every night at 01:00 IST.

## What works

- **Knowledge Centre:** guidelines (versioned), approved facts with validity dates, terminology (banned, preferred, internal), colours and fonts, import of Vale rule files, and **Import brand book**: upload a brand-book PDF and the AI drafts guidelines, terms and colours; the owner ticks what to keep, and nothing is saved until they do.
- **Audit:** text, PDF, Word, HTML and image input; rule checks (terms, facts, expiry, contrast, palette, fonts, alt text, readability) plus a model check against the guidelines. The **Confidential Guard** removes internal codenames and personal data before anything reaches the model, and flags text that is in a web page or PDF but hidden from readers. An **ASCI pack** checks the copy against ASCI's September 2026 guidelines on AI-made (synthetic) content in ads: a virtual influencer, cloned voice or render of something not yet built needs an AI label; AI-made testimonials and deepfakes are flagged even with a label; an AI recommendation needs "Sponsored by" if paid for. A finding only appears if its quote is really in the text and its source really exists.
- **Human decisions:** accept, reject, dismiss or waive with a reason (a waiver can have an end date and can be carried to later versions of the post when the same rule flags the same words); comments; approve, request changes or reject; a database trigger blocks approval while a Critical finding is open; full history.
- **Brand Health:** recurring mistakes, unclear rules, conflicting terms, fact impact.
- **Real AI and a fallback:** Azure AI Foundry on the live site. Without keys (`DEMO_MODE=true`) recorded answers are used and every result is labelled **Simulated**. A cost limit protects the live model.

## Not built or limited (honest list)

- Brand-book import works on PDFs with a text layer (not scanned pages); every item it drafts must be checked by the owner before saving.
- Accuracy on our own 48 labelled cases (`npm run eval`; labelled by Udit, checked by Shrikant (`eval/second-labeller-SS.md`), then 4 labels added by Udit after a precision review (`eval/precision-review.md`, decision D34); still our own set, so treat it as a first measurement, not a benchmark). With the real model at the live setting (low reasoning effort), in two runs: 93% and 90% of the 73 labelled issues are found, 91% and 89% of all findings are correct, 98% of high-confidence findings are correct. Rule checks alone find 58% and are 88% correct. All seeded codenames and internal facts are found in every run. The model's answers vary between runs, so numbers move by a few points. Results are in `eval/results/`; earlier numbers are kept in `docs/decisions.md` (D31, D34).
- Contrast measured from an image is an estimate (the weakest foreground colour on the main background, no text reading) and is marked low confidence; type the text and background colours in the upload form for an exact check.
- Uploaded files are kept (private Storage bucket) and can be opened again from the post; after a fix only the text is audited again, not the file.
- An internal fact reworded with neither its figure nor its name (and spelled-out numbers) is not caught; reworded figures are flagged as a hint to check.
- Logos are stored for the team but not yet checked against content (no logo recognition).
- Usability: so far one guided walkthrough by a person from outside the team, who completed the basic flow and the file tests; it led to the web page fix below. No timings or ratings yet; the five-person test in `docs/usability/kit.md` is planned for the next release. Notes: [`docs/usability/results-round2.md`](docs/usability/results-round2.md).
- A web page is audited from its main content (`<main>`, or the page's only `<article>`); menus are skipped. A page with neither is read whole, so very busy pages (many images, long language lists) can still give noisy results.
- If text tries to instruct the AI ("ignore all previous instructions…"), Azure's jailbreak filter refuses the request; the audit then returns the rule checks only, with a note that AI checks were skipped.

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
