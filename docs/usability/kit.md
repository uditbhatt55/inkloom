# INKLOOM AI — Usability-Test Kit

Test scope: core workflow using the fictional Northbeam Cloud demo organisation
Participants: 5 people who create or approve content
Proposal basis: Sections 2.4, 3.3 and 12.4 of the Round 1 Proposal (v2)
Source: ChatGPT (Prompt C), reviewed by Claude 12 Nov 2026 — see "Review notes" at the end.

## 1. Participant plan

| Participant | Suggested profile | Role during the test |
|---|---|---|
| P01 | Marketing staff | Brand owner |
| P02 | Marketing staff | Creator or reviewer |
| P03 | Agency writer | Creator (agency role) |
| P04 | College communications office | Creator |
| P05 | College communications office | Reviewer or approver |

All participants use the same Northbeam Cloud demo org. Give each the role stated in each task, even if it is not their usual job, so tasks stay comparable.

## 2. Consent note

Thank you for taking part. We are testing INKLOOM AI, not your skills, and there are no right or wrong answers. Taking part is voluntary; you may pause or stop at any time. We will take notes about task completion, time and comments. We will not make an audio or video recording unless you give separate, explicit consent before recording starts. We will use the feedback to improve the product and report the results, including feedback that contradicts our assumptions, in Round 2. Participant-linked test data and notes will be deleted after Round 3. Please do not enter real customer, personal or confidential information; this test uses fictional Northbeam Cloud data.

## 3. Moderator guide

- Ask the participant to think aloud: what they look for and what they expect to happen.
- Read each task as written. Do not demonstrate or point to a control.
- If stuck, ask "What would you expect to do next?" Help only when needed to continue, and record that help was given.
- Success = Y only when all success criteria are met; otherwise N and note what was missed.
- Time from task start until the participant says done or the task is stopped.
- Copy quotes verbatim.
- Ask the questions right after each task, without explaining the intended answer.

## 4. Tasks

### Task 1 — Set up the Northbeam Cloud knowledge (storyline step 1) · Role: brand owner

**Read:** "You are the Northbeam Cloud brand owner. Import the supplied part of the brand book. Review the draft clauses and confirm the ones that should become approved rules. Then show me the approved fact FACT-07 and its expiry date, a banned term, the internal codename Project Atlas, and the brand palette."

**Watch for:** finds import; understands imported clauses stay drafts until confirmed; confirms clauses unaided; finds FACT-07 and understands its validity dates; tells banned from preferred terms; recognises Project Atlas as internal; finds palette; any doubt about who owns facts and dates.

**Success:** imports material · confirms intended draft clauses · finds FACT-07 and its expiry · finds banned term, Project Atlas and palette.

**Ask — (b):** "How manageable would it be for you or someone on your team to keep approved facts and their expiry dates up to date? What would make that difficult?"

### Task 2 — Audit the draft post and banner (step 2) · Role: creator

**Read:** "You have been given an AI-drafted Northbeam Cloud post and a banner image. Upload both and run an audit. Review the score and findings. Explain what you think needs attention before this content can be published."

**Watch for:** upload + audit; notices score 53; finds Critical claim, wrong product name, contrast failure, Project Atlas confidentiality finding; opens the cited clause/fact; quote matches content; tells finding vs evidence vs fix apart; which finding they treat as most important and why.

**Success:** completes upload + audit · finds score 53 · locates all four seeded issues · opens at least one cited source and explains how it relates to the quote.

**Ask — (a):** "Does seeing the quote and its cited source make you trust this finding enough to act on it? Which finding would you act on first, and why?"

### Task 3 — Apply fixes and re-audit (step 3) · Role: creator

**Read:** "Make changes to this draft. Accept the fixes you agree with. Reject at least one suggested fix and give a reason. Save the changes as a new version, then run the audit again. Compare the new result with the previous one."

**Watch for:** understands the diff; accepts and rejects separately; finds where to give a rejection reason; notices a new version is created; re-runs audit and compares; whether fixes keep meaning and voice.

**Success:** accepts ≥1 fix · rejects ≥1 fix with a reason · creates new version and re-audits · finds the new, higher score.

**Ask — (a):** "Did the cited rule or fact affect which fix you accepted or rejected? What made you decide?"

### Task 4 — Review, approve and inspect history (step 4) · Role: reviewer

**Read:** "You are the Northbeam Cloud reviewer. Try to approve the current version while a Critical finding is still open. Then resolve the remaining Critical finding and complete the approval. Finally, use the history to explain what happened."

**Watch for:** finds approve action; notices the block and understands why; resolves the Critical and approves; traces changes and decisions in history; expects a person, not the AI, to decide.

**Success:** sees the block on approve · explains why · resolves and approves · uses history to name key actions and decisions.

**Ask — (d):** "Would a dedicated checkpoint like this fit your real publishing process better than relying on a general AI chat tool? Why or why not?"

### Task 5 — Update FACT-07 and use Brand Health (step 5) · Role: brand owner

**Read:** "FACT-07 has changed. Update it in the Northbeam Cloud knowledge base. Then open Brand Health. Find the approved posts that relied on FACT-07, identify the most repeated product-name mistake, and inspect the clause with a high dismiss rate and its suggested rewrite."

**Watch for:** finds and updates FACT-07; understands which approved posts are affected; reads the top recurring mistake; understands what a high dismiss rate may mean; treats the rewrite as a suggestion, not an automatic change.

**Success:** updates FACT-07 · finds posts that cited it · names the top product-name mistake · finds the high-dismiss clause and its suggested rewrite.

**Ask — (b):** "After seeing the affected-post list, who in your organisation would own updates to facts like FACT-07, and how would they keep them current?"
**Ask — (c):** "Would dismiss or waive rates help you spot an unclear guideline? What else might explain a high rate?"

### Task 6 — Demo mode labelling (step 6) · Any role

**Read:** "Switch on demo mode and run an audit. Tell me how you know this run is simulated."

**Success:** switches on demo mode · points to the "Simulated" label on the run, score and findings.

### Task 7 (P03 only) — Agency view and Confidential Guard

**Read:** "You are the agency writer. Paste this draft (contains 'project atlas' in lower case) and run an audit. What does the tool tell you, and what can you see of Northbeam's internal information?"

**Watch for:** sees a Critical confidentiality finding; understands what to do; can NOT see other internal facts or terms; whether the message feels clear or accusatory.

**Success:** finds the confidentiality finding · removes or replaces the phrase · confirms they cannot browse the internal register.

## 5. Final participant form

Scale for 1–4: 1 Strongly disagree · 2 Disagree · 3 Neutral · 4 Agree · 5 Strongly agree

| # | Question | Rating |
|---|---|---|
| 1 | I could understand why a finding appeared because it showed the relevant quote and source. (a) | 1 2 3 4 5 |
| 2 | I would trust the source-linked findings enough to take action on them. (a) | 1 2 3 4 5 |
| 3 | I could see how my organisation would keep approved facts and expiry dates up to date. (b) | 1 2 3 4 5 |
| 4 | A dedicated review checkpoint like INKLOOM AI would fit our process better than relying only on general AI chat tools. (d) | 1 2 3 4 5 |
| 5 | What was the most confusing, difficult or slow part of the experience? | open |
| 6 | What would make the findings, approval workflow or Brand Health insights more useful in your organisation? | open |

## 6. Results table

Exact quotes only. Assumption column: e.g. "(a) confirmed", "(b) contradicted", "(c) mixed".

| Participant | Task | Success (Y/N) | Time | Help given? | Quote | Assumption |
|---|---|---|---|---|---|---|
| P01 | 1 | | | | | |
| P01 | 2 | | | | | |
| P01 | 3 | | | | | |
| P01 | 4 | | | | | |
| P01 | 5 | | | | | |
| P01 | 6 | | | | | |

Repeat the block for P02–P05 (P03 also Task 7).

## 7. Assumption coverage

| Assumption | Evidence in this kit |
|---|---|
| (a) Reviewers trust and act on findings that show their source | Task 2 + 3 behaviour and questions; form Q1–2 |
| (b) A facts register with expiry dates is maintainable | Task 1 + 5 behaviour and questions; form Q3 |
| (c) Dismiss/waive rates signal unclear guidelines | Task 5 interpretation and question |
| (d) Mid-size orgs will adopt a dedicated checkpoint over chat tools | Task 4 question; form Q4 |

## 8. Reporting notes

- Report all five participants, including results that contradict an assumption.
- Keep observed behaviour separate from what participants say they would do.
- A high rating alone is not proof; compare with success, time, hesitation and comments.
- Note where help was given, findings were misunderstood, or tasks failed.
- Use findings to decide changes before Round 2. Five participants do not represent all marketing teams, agencies or college offices.

## Review notes (Claude, 12 Nov 2026)

Changes from the ChatGPT version:
1. Split the old Task 5: demo mode is now **Task 6**, so one failure doesn't hide the other.
2. Added **Task 7** for the agency participant — Confidential Guard and agency scoping are key differentiators (proposal §3.2, §8.1) and were not tested.
3. Added a "Help given?" column to the results table.

Things to settle before testing:
- Tasks name FACT-07 and Project Atlas directly, which helps participants find them. Fine for a demo walkthrough, but note it when reporting findability.
- Task 2 expects score **53**. That only holds if the seed data and banner match the §7.5 worked example exactly — check before each session.
- (c) has one question only; with 5 people, treat (c) results as directional.
