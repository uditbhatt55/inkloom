# Review of asci-ai-labelling.json (12 Nov 2026)

Source file: `asci-ai-labelling.json` (ChatGPT Deep Research, Prompt B in `docs/chatgpt-prompts.md`). Clause letters and CCPA section numbers were checked against the source PDFs; see "Source check" below.

## Verdict
Usable. Well sourced, flags its own gaps, and agrees with the proposal's design (label never clears prohibited content; no "false" without a source).

## Fixes before it becomes rule-pack data (Prompt 7)

| # | Issue | Decision |
|---|---|---|
| 1 | Effective date is "3 months from publication"; no date printed (signed 17 Sep). Could be 17 Dec or 29 Dec 2026. | Proposal keeps "as reported by Lexology". In-app text: "applies 3 months after publication (expected by end of Dec 2026)" — no exact date. |
| 2 | **AI-written text copy is exempt** (Guideline 3, ex. 4). ASCI labelling is about realistic audio/visual content. | Never flag "this text was AI-written, add a label". Flag only realistic synthetic people, scenes, products, voices, and sponsored AI recommendations. |
| 3 | A fabricated testimonial is **prohibited**, not "needs a label" (Guideline 1, ex. 1). | Proposal §2.1 example "AI-generated testimonial with no label" → finding text must say "remove or substantiate", not "add a label". |
| 4 | SGC-05 (sound effects) needs audio — out of MVP scope. | Drop from MVP. Future scope. |
| 5 | SGC-10 (likeness / copyright) needs a rights register; labelled `confidentiality`, which in INKLOOM means internal leaks. | Drop from MVP. Future scope (rights register). |
| 6 | Several rules need facts the content can't show (is it synthetic? is it sponsored?). | Add **two fields to the upload form**, like the alt-text field: "Contains AI-generated people, places, products or voices?" (y/n/unsure) and "Sponsored or paid? By whom?". Then SGC-06/11/12 become deterministic, high confidence. Answer "unsure" → reviewer check. |
| 7 | IDs `SGC-NN` don't follow our scheme. | Rename to `AIDISC-01…` in Prompt 7. |
| 8 | EU AI Act Art. 50 duties fall mostly on AI providers/deployers, and MVP is India-first. | Keep as background only. No EU rules in MVP. |
| 9 | "Generic AI phrasing" (in Prompt 7, `docs/chatgpt-prompts.md`) has no ASCI basis. | Keep it as a separate Minor **tone** rule, not cited to ASCI. |
| 10 | Label size/position not specified by ASCI. | No size rule. Reuse our WCAG contrast check on the label text only. |

## Source check (tick each, write initials + date)

ASCI guideline (3-page PDF, signed 17 Sep 2026):
- [x] Clause 1 lists 4 prohibited examples (1A–1D): fake endorsement, exaggerated results, non-existent location, unauthorised likeness/IP
- [x] Clause 2 lists 6 must-label examples (2A–2F): synthetic influencer, replicated real person, fabricated event, non-existent product, sound effects, sponsored AI recommendation
- [x] Clause 2F wording is exactly "Sponsored by [Brand]"
- [x] Clause 3D exempts "Generating or enhancing advertising copy" (text)
- [x] Clause 4 example labels: "Audio/Video created using AI" / "Audio/Video enhanced using AI"
- [x] Clause 1: prohibited content "will violate the ASCI code even if an AI label is used"
- [x] Effective date: "These Guidelines shall come into effect on the expiration of 3 months from the date of their publication." No publication date is printed. 29 Dec 2026 holds only if publication = 29 Sep press release; if publication = 17 Sep signature, it is 17 Dec 2026.

**Correction made:** ASCI letters its examples A–F; the research called them "example 1–6". All references in the JSON now read "ASCI Clause 2A" etc.

CCPA Guidelines 2022 (Gazette, 9 June 2022, F. No. J-25/4/2020-CCPA):
- [x] §4(1)(a)(b)(d) truthful, no exaggeration, no "universally accepted" for disputed claims
- [x] §11(1) disclaimer can't contradict, hide or correct; §11(2)(a)–(e) same language, same font, prominent, synced voice-over, legible
- [x] §12(a) substantiation; §12(c) no reference to a person without permission; §12(d) no misleading by implication/omission/exaggeration
- [x] §13(1) endorsements genuine and current
- [x] §14 material connection disclosed

Note: the ₹10 lakh penalty in proposal §2.2 is **not** in these guidelines (it comes from the Consumer Protection Act 2019). The proposal already cites it through a secondary source, so no change needed; just don't cite these guidelines for it.

Checked by: Claude, against the PDFs in Downloads. Date: 12 Nov 2026. A team member should still glance over it before Prompt 7.

## MVP rule pack (10 rules)
SGC-01, 02, 03, 04, 06, 07, 08, 09, 11, 12 → AIDISC-01…10, all `advisory: true`, "aid only, not legal advice".
