# Design decisions

Decisions made after the proposal, where the proposal left room. Code must follow these.

| # | Date | Area | Decision | Why |
|---|---|---|---|---|
| D1 | 2026-11-12 | Score (§7.5) | A finding the **creator rejects** still deducts. Only reviewer/owner **dismiss or waive**, or a new version where the issue is gone, removes the deduction. | Creators can't raise their own score or bypass the approval gate (§8.1). The rejection reason is shown to the reviewer. |
| D2 | 2026-11-12 | Confidential Guard | Match registered internal terms as **whole words**, case-insensitive, with any run of spaces/hyphens/underscores/line breaks between words. "Project Atlas" catches `PROJECT-ATLAS`, `project  atlas`; does not catch `Atlassian`. | Avoid false Criticals that block approval. Owners should register specific names ("Project Atlas"), not generic words ("Atlas"). |
| D3 | 2026-11-12 | Evidence validator (§7.3) | If the AI's quote exists **anywhere** verbatim in the content, keep the finding and **correct the offsets** to the occurrence nearest the stated offset. Discard only if the quote does not exist at all. | Models miscount characters; the verbatim quote is the real evidence. |
| D4 | 2026-11-12 | Contrast on images | Extract dominant colours from the image and check the lowest-contrast text-like pair (**medium** confidence). If the creator enters text + background colours on the upload form, check those exactly (**high** confidence). | Keeps contrast a measurable code check (§9.1) and keeps the demo's 3.1:1 banner finding. |
