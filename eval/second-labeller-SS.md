# Second labeller review (SS)

Proposal §7.7 asks for two people to label the evaluation set. The 48 cases in `eval/cases/` were labelled by Udit (UB). Shrikant Sharma (SS) then read all 48 against `seed/northbeam/knowledge.json` on 15 Nov 2026. He used Claude for a second opinion and says the final calls are his (logged in `AI_USE_LOG.md`). The review below is his text, unchanged.

**Outcome:** 39 cases OK (a few with notes), 9 with changes (1 disagree, 2 missing, 7 severity; the severity changes are 6 times MSG-01 plus EV-ACC-05). Udit accepted all of them on 15 Nov 2026 and they are applied in `eval/cases/*.json` (both `UB` and `SS` are now in every case's `labelled_by`). The scoring ignores severity and rule id, so only the label changes that add or remove an issue move the numbers; the new results are in `eval/results/` and in decision D31.

---

## Second labeller check — SS

48/48 cases read against seed/northbeam/knowledge.json. I used Claude for a second opinion; the final calls are mine.
Summary: 39 OK (a few with notes), 9 with changes (1 Disagree, 2 Missing, 7 Severity).

EV-CLAIM-01: OK
EV-CLAIM-02: OK
EV-CLAIM-03: OK
EV-CLAIM-04: OK
EV-CLAIM-05: OK
EV-CLAIM-06: OK
EV-FACTUAL-01: OK. FACT-06 vs FACT-05: keep FACT-06 as the rule_id, because it is the fact the copy has to match and the fix cites INR 599. FACT-05 is the expired fact the text came from, so the eval should accept either ID for this finding.
EV-FACTUAL-02: OK
EV-FACTUAL-03: OK
EV-FACTUAL-04: OK
EV-FACTUAL-05: Disagree. Drop the factual FACT-91 label on "Northbeam Mobile is available today". It covers the same text as the confidentiality label, and its fix ("launches in March 2027") would itself put the internal date into public copy. Keep one finding: confidentiality, critical, FACT-91, quote "Northbeam Mobile is available today". The Project Atlas label is OK.
EV-FACTUAL-06: OK. It is an internal deck, but "41 countries" vs FACT-03 (14) is still a wrong fact, so major is right.
EV-TERM-01: OK
EV-TERM-02: OK
EV-TERM-03: OK
EV-TERM-04: OK
EV-TERM-05: OK
EV-TERM-06: OK
EV-CONF-01: OK
EV-CONF-02: OK
EV-CONF-03: OK
EV-CONF-04: OK
EV-CONF-05: OK
EV-CONF-06: OK
EV-TONE-01: OK
EV-TONE-02: OK
EV-TONE-03: OK
EV-TONE-04: Missing. "Stop babysitting files" is also slangy (TONE-01, minor). Borderline, but it is the same kind of phrase as "stupidly simple".
EV-TONE-05: Severity. MSG-01 is labelled major; I think minor (see EV-MSG-01). Also, the MSG-01 quote contains the CLAIM-03 quote "the market-leading file sync experience". Shorten the MSG-01 quote to "Northbeam Cloud today announced an exciting new chapter for Northbeam Sync" so the two spans don't overlap.
EV-TONE-06: OK
EV-MSG-01: Severity. Label is major; I think minor. Putting features before the benefit is an order/style problem, closer to TONE (minor) than to a wrong fact or an unsafe claim (major). Same call for every MSG-01 label below.
EV-MSG-02: Severity. MSG-01 major → minor. The FACT-06 label is OK (same note as EV-FACTUAL-01).
EV-MSG-03: OK
EV-MSG-04: Severity. MSG-01 major → minor. The CLAIM-02 label is OK.
EV-MSG-05: Severity. MSG-01 major → minor. The FACT-91 confidentiality label (critical) is OK.
EV-MSG-06: Severity. MSG-01 major → minor. TERM-04 is OK. Also Missing (borderline): "operational synergy" and "future-ready infrastructure" are jargon, which breaks TONE-01 "professional and plain" (minor).
EV-VIS-01: OK
EV-VIS-02: OK
EV-VIS-03: OK. On the contrast question: white #F8FAFC on #BE123C is 6.01:1, which passes 4.5:1. The 3.51:1 figure doesn't match these colours, so no contrast issue was missed. Only the off-palette label applies.
EV-VIS-04: OK
EV-VIS-05: OK
EV-VIS-06: OK. The audience is internal, but the slide is shown to a prospect, so the palette rule still applies.
EV-ACC-01: OK, but please split it into two findings: (1) missing alt text, since alt "" is on the main visual that carries the headline, so it is not decorative; (2) contrast 2.38:1, teal #14B8A6 on #F8FAFC, below 4.5:1. One label holding two problems makes scoring hard.
EV-ACC-02: OK
EV-ACC-03: OK. 2.38:1. Worth telling the brand team: both colours are in the brand palette, so this brand pairing fails for text.
EV-ACC-04: OK. alt "" is wrong here because the copy says the image "carries the central message", so it is not decorative. The engine treating "" as decorative is an engine limit, not a label error.
EV-ACC-05: Severity. Label is minor; I think major. Alt text "image" tells a screen-reader user nothing, which is the same harm as the empty alt in EV-ACC-04 (major).
EV-ACC-06: OK. Small note: the copy says "navy text" but text_colour is #334155 (Ink Grey). Still in the palette and 9.9:1, so no issue.
