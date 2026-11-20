# Claude's check of the new labels and the helper eval cases (20 Nov 2026)

**This is not a human review.** Claude drafted the helper cases, so this is the same author reading its own work again. It can catch slips. It cannot stand in for the second labeller (SS) or Raghav. The cases keep `labelled_by: ["Claude (draft)"]` and the four new labels keep `UB`. Nobody's initials were added for them.

## 1. The four labels added in D34 (UB, 19 Nov)

Read again against the case text and the rule that produced each finding.

| Label | Case | Check |
|---|---|---|
| tone/minor "transform your" (PACK-EMPTY-VERB) | EV-CLAIM-01 | Reads as an empty verb: "transform your organisation's productivity" does not say what changes. Fine. |
| accessibility/minor "Reading grade" (READABILITY) | EV-CLAIM-03 (grade 14.8) | Well above the grade-12 limit for a public blog. Fine. |
| same | EV-CLAIM-05 (grade 16.7) | Well above the limit. Fine. |
| same | EV-FACTUAL-05 (grade 15.7) | Well above the limit. Fine. |

One weakness to know about, not a mistake: the three readability labels use the quote "Reading grade", which is the wording of the finding, not a phrase in the post (image labels use a file name in the same way). The scorer matches it because the category is the same and the finding's quote contains it. If a reviewer prefers, these can point at the first sentence of each post instead; the numbers would not change.

The nine findings left unlabelled were reasoned out in `eval/precision-review.md`; this check did not change any of them.

## 2. Helper cases, `eval/health/conflicts.json` (29 clause sets)

Each expected pair was read against the clause texts, and each "no conflict" set was checked for a real clash.

- The 8 plain conflict sets (CF-01 to CF-08), the mixed set MX-01 (TONE-B against TONE-C only) and the 5 hard conflict sets (HC-01 to HC-05): each pair is a real, direct contradiction. No change suggested.
- The 8 no-conflict sets (NC-01 to NC-08), the 5 hard no-conflict sets (HN-01 to HN-05) and the 2 seed sets: no real contradiction found. HN-01 and HN-04 are the closest calls (rules that apply to different channels); calling them "no conflict" is a judgement a human may want to confirm.

## 3. Helper cases, `eval/health/rewrites.json` (12 cases)

Each clause, its two "reviewers overrule this" notes and its `must_keep` word were read together.

- The notes are plausible exceptions, and each `must_keep` word is in the clause text (`percent` matches "percentages", `abbreviat` matches "abbreviate").
- RW-01, RW-09 and RW-10 to RW-12 use real clauses from `seed/northbeam/knowledge.json`; their texts match the seed. RW-02 to RW-08 use made-up clauses (TONE-03, TERM-05, CLAIM-06, MSG-02, TONE-07, A11Y-04, CLAIM-09 are not in the seed). That is fine for measuring the helper, but the Brand Health page should not suggest they are Northbeam's rules.
- RW-09 puts "Project Atlas" (an internal codename) in a note on purpose, to see whether the rewrite leaks it. It is a deliberate hard case; a human should confirm that is intended.

No case needed to be changed.

## What is still open for people

1. SS (or another person) confirms the four D34 labels.
2. Raghav or SS confirms the 29 conflict sets and the 12 rewrite cases, in particular HN-01, HN-04 and RW-09 above. The helper numbers on the Brand Health page stay marked as drafted by Claude until then.
