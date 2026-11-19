# Precision review: 13 findings the labels do not contain (19 Nov 2026)

**For:** Raghav and Shrikant (labellers). **Your call, not Claude's.** Claude only collected the items.

## Why this review

In the AI eval at low reasoning effort (`eval/results/rules+ai-effort-low.json`), INKLOOM found 77 issues. 64 match a label and 13 do not, so precision is 83.1%. The Round 3 target is 85%.

Of the 13 issues with no label:
- 10 come from our own rule engine (`rules-only.json` has the same 10).
- 3 come from the AI.

For each item, decide one of these:

- **Real:** it is a real issue. Add a label to the case in `eval/cases/*.json` and put your initials in `labelled_by`.
- **Not an issue:** the label stays as it is. The finding stays a false positive, and we may fix the rule later.
- **Other:** anything else. Write a note.

Please do not change labels just to raise the number. A label goes in only if you would flag the issue yourself in real review.

The scorer counts an issue as found only when **the category matches** and the quote overlaps a label (see `eval/run.ts`). Severity and rule id do not count.

The text of each case is in `eval/cases/`. The knowledge base is `seed/northbeam/knowledge.json`.

---

## A. Readability rule: 6 findings, one policy question

Rule `READABILITY` (`src/lib/rules/visual.ts`) flags any text whose Flesch–Kincaid grade is above 12. It reports the category `accessibility` with severity `minor`. None of the 48 cases has a readability label, so every hit counts as a false positive.

| Case | Channel | Grade |
|---|---|---|
| EV-CLAIM-03 | blog | 14.8 |
| EV-CLAIM-05 | press_release | 16.7 |
| EV-FACTUAL-01 | email | 12.2 |
| EV-FACTUAL-02 | linkedin | 13.3 |
| EV-FACTUAL-04 | landing_page | 12.9 |
| EV-FACTUAL-05 | press_release | 15.7 |

**Question:** for public copy, is "reads above grade 12" an issue you would flag?
- If yes, add one label per case: `accessibility / minor / quote "Reading grade" / rule_id READABILITY`. The quote is the text the rule prints, and it overlaps "Reading grade …".
- If no, or only for some channels, say which. Changing the rule's limit is a rule change, and the proposal fixes the rules, so Udit decides that separately.

**Claude's suggestion:** count the three cases at grade 14 or above as real (EV-CLAIM-03, EV-CLAIM-05, EV-FACTUAL-05). Do not count the three at 12.2–13.3. Flesch–Kincaid is an estimate, and being one grade over the limit is within its error. Agree or change:

Decision (all six, or per case): ______

---

## B. Rule pack words: 4 findings

These come from the open-source rule pack `src/lib/rules/packs/marketing-en.json`.

| # | Case | Rule | Category found | Words in context | Decision |
|---|---|---|---|---|---|
| B1 | EV-CLAIM-01 (linkedin) | PACK-EMPTY-VERB, "Empty verb" | tone | "…see how Northbeam Sync can **transform your** organisation's productivity." | Claude suggests: **Real**, `tone/minor`. It says nothing about what happens. |
| B2 | EV-CLAIM-03 (blog) | PACK-AI-VOCAB, "AI vocabulary", severity info | tone | "…helps them focus on **meaningful** work instead of managing scattered files." | Claude suggests: **Not an issue**. Plain usage. |
| B3 | EV-ACC-02 (email, clean case) | PACK-AI-VOCAB, severity info | tone | "The banner description is supplied as **meaningful** alt text for readers using assistive technology." | Claude suggests: **Not an issue**. Standard accessibility term. |
| B4 | EV-MSG-06 (linkedin) | PACK-FLAWLESS, "Untrue, no product is flawless" | claim | "…organisations require robust, **seamless** and future-ready infrastructure…" | Claude suggests: **Not an issue** as a claim. It is not a promise about the product, and the sentence already has a tone label. |

Notes:
- **B3:** "meaningful alt text" is a standard accessibility term. EV-ACC-02 is labelled as a clean case.
- **B4:** this sentence already has a label, `tone/minor` TONE-01. The rule reports "seamless" as a `claim`, so the category does not match. If "seamless" here is not a product claim, keep the label as it is.

---

## C. AI findings: 3

| # | Case | Found | Label in the case | Decision |
|---|---|---|---|---|
| C1 | EV-CLAIM-05 | `factual/high: "100% reliable"` | `claim/major: "100% reliable"` (CLAIM-02) | Claude suggests: keep the label. Whether to accept either category is Udit's call (scorer). |
| C2 | EV-MSG-04 | `factual/high: "100% reliable for every customer."` | `claim/major: "the service is 100% reliable for every customer."` (CLAIM-02) | Same as C1. |
| C3 | EV-CLAIM-06 (clean case) | `messaging/medium: "Northbeam Sync helps teams keep files in step across devices"` | none | Claude suggests: **Not an issue**. It is the approved message. |

Notes:
- **C1 and C2:** the AI found the right words but called them `factual`, because they contradict FACT-07, 99.9% uptime. The label says `claim`. The words are right and only the category differs, so these cost both a miss and a false positive. Is `claim` the right category? Or should the case accept either `claim` or `factual`, the way EV-FACTUAL-01 accepts either FACT-05 or FACT-06? Accepting either is a scorer change, so Udit decides it.
- **C3:** this case is labelled clean. The sentence is the approved Northbeam Sync message.

---

## If you accept every suggestion

You would add 4 labels: 3 readability and B1. My estimate from the stored result, before any rerun: precision 68/77 = 88.3%, recall 63/73 = 86.3%.

The suggestions come from the same AI that built the tool, and this time accepting them happens to raise the score. So check each one. Do not just sign off.

## After the review

Udit applies the decisions, the same way as in `eval/second-labeller-SS.md`. Then he reruns `npm run eval -- --ai` with `AZURE_REASONING_EFFORT=low` and records the new numbers in `docs/decisions.md`.

Reviewer: UB (Udit Bhatt). Date: 19 Nov 2026. Decision: every suggestion accepted as written. 4 labels added to `eval/cases/claim-factual.json`: B1 and the three readability cases at grade 14 or above. Nothing else changed. C1 and C2 keep their `claim` labels, and the scorer is unchanged. Results from before this review are kept in `eval/results/*-before-precision-review.json`.
