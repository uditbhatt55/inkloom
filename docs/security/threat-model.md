# Threat model (Round 3)

What INKLOOM protects, who might attack it, and which automated test proves each defence. Every row has at least one test that runs in CI (`npm run test`, `npm run test:int` or `npm run test:e2e`). The database tests run on an in-process Postgres (PGlite) with our real migrations.

**What we protect:** an organisation's content and its review history; internal facts and codenames; the approval decision; the AI budget.
**Who we assume:** a signed-in member trying to do more than their role allows; a member of another organisation; an anonymous visitor; a malicious web page or file submitted for audit; text written to steer the AI.

| # | Threat | Defence | Automated test |
|---|---|---|---|
| T1 | A member of another organisation reads our content, findings or files | Row Level Security on every table; private Storage buckets read through the same rules; signed links that expire | `tests/integration/db.test.ts` ("another organisation's owner sees none of org A's items", "anon gets no rows"), `tests/integration/storage.test.ts` |
| T2 | An author approves their own work, or a creator clears their own finding | Database policy on `decisions` and trigger `guard_finding_status` (not the page) | `tests/integration/review-security.test.ts` (T2), `tests/e2e/review-loop.spec.ts` (M4) |
| T3 | Content with an open Critical finding is approved | Approval gate inside the database trigger `apply_decision` | `tests/integration/approval-binding.test.ts`, `tests/e2e/review-loop.spec.ts` |
| T4 | An older version, an unaudited version, or an audit made before the rules changed is approved | Approval bound to the latest version, its audit run and the knowledge revision; hash, run and revision stored on the decision by the database | `tests/integration/approval-binding.test.ts` |
| T5 | A waiver is used forever | Optional expiry date; after it the gate counts the finding as open again | `tests/integration/review-security.test.ts` ("waivers with an expiry date"); a carried waiver (`carry_forward`) keeps the same expiry and only matches the same rule and words, `tests/integration/waiver-carry.test.ts` |
| T6 | Internal codenames, facts or personal data reach the AI provider | Confidential Guard masks internal terms, emails, phone and card numbers, including hidden spellings, before any model call | `src/lib/guard/guard.test.ts`, `tests/integration/pipeline.test.ts` ("never sends internal data or personal data to the model", "hidden with invisible characters") |
| T7 | The web-page audit is used to reach internal services (SSRF) | Only http(s) on ports 80/443, public addresses only, re-checked on every redirect, size and time limits | `src/lib/parsers/parsers.test.ts` (private, loopback, link-local and mapped addresses refused) |
| T8 | Clickjacking, script injection from other origins, MIME sniffing, downgrade to http | Content-Security-Policy, `frame-ancestors 'none'`, X-Frame-Options, nosniff, HSTS, no X-Powered-By | `src/lib/security-headers.test.ts` |
| T9 | An open redirect after sign-in sends people to another site | Only same-site relative paths are followed | `src/lib/safe-redirect.test.ts` |
| T10 | A script floods audits and runs up the AI bill, including with simultaneous requests | Per-account burst limit counted atomically under a per-user lock; organisation daily cap falls back to rule checks | `src/lib/audit/usage-cap.test.ts`, `tests/integration/usage-cap.test.ts` |
| T11 | Someone changes or hides what happened | Append-only activity log written by triggers (sign-ins, role changes, approvals, content and knowledge changes); members cannot insert, edit or delete it | `tests/integration/review-security.test.ts` ("security log") |
| T12 | A user creates or reads someone else's notifications | Notifications written only by triggers; each person reads and marks read only their own | `tests/integration/review-security.test.ts` ("notifications") |
| T13 | A known vulnerable dependency ships | `npm audit` (production, high and above) fails CI, also weekly; Dependabot opens update pull requests | `.github/workflows/ci.yml` |
| T14 | The AI approves, rejects or publishes content | The AI only produces findings saved by the server role; decisions need a signed-in owner or reviewer | `tests/integration/db.test.ts` (`save_audit` callable only by the server), `tests/e2e/review-loop.spec.ts` |

## Known limits

- Scripts are allowed `'unsafe-inline'` in the CSP because Next.js hydration scripts are inline; nonces would remove this.
- The web-page fetch resolves DNS before connecting, so a DNS-rebinding attack between the two is not covered (`src/lib/parsers/html.ts`).
- Text written to steer the AI is refused by Azure's jailbreak filter; the audit then reports rule checks only. There is no test against the live model, by design (tests never call it).
- Leaked-password protection and stricter sign-in limits are Supabase Auth settings, switched on in the dashboard, not in code.
