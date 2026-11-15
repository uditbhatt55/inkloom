# Usability: first walkthrough (Round 2, 15 Nov 2026)

**What this is, and what it is not.** One person from outside the team (a friend of a team member, not involved in building INKLOOM) went through the live site on 15 Nov 2026 between about 23:00 and 23:30 IST, following two written step-by-step scripts the team gave them (the basic flow, and the file tests). Udit also ran the scripts himself; as a team member he is not counted as a participant. This is a guided walkthrough with one participant, not the moderated five-person test in [`kit.md`](kit.md): no task times, think-aloud quotes or ratings were recorded. The full kit test is planned for Round 3.

## What the participant did, and what happened

| Step (script) | Done? | What the screenshots show |
|---|---|---|
| Sign in with "Try the demo", audit the sample text | Yes | 4 findings (banned term "NB Sync", "uptime is guaranteed", expired price "499", "100% reliable"), each with its quote, rule and source; score 70 |
| Accept findings | Yes | Findings marked Accepted; the text highlights each issue |
| Upload an image with low contrast | Yes | "No alt text" and an estimated contrast of 1.97:1 marked "Needs human check"; image preview and "Open original" |
| Upload an image with off-brand colours | Yes | Palette and accessibility findings; score 86 |
| Upload the sample brand book PDF | Yes | 2 Critical findings for internal names; "Approval blocked" shown at the top |
| Upload a large real brand book PDF (5 MB+) | Yes | 39 findings, "Open original" |
| Upload a Word file | Yes | Font finding ("Calibri is not an approved brand font"); score 97 |
| Audit a web page (a Wikipedia article) | Yes, but noisy | 23 findings and a -40 accessibility penalty: the audit read the site's menus and counted every icon as an image |

## What we changed because of it

- **Web page audits read only the page's main content** (decision D32): menus are removed and images are counted only inside the main content. Before the fix the participant's page started with "Jump to content, Main menu"; afterwards it starts at the article title.
- Contrast estimated from a photograph can pick a shadow as the "text" colour. It was already low confidence with no score deduction; this is now stated in the README limitations.

## Limits of this walkthrough

- One outside participant, guided by written steps, so it shows that the flows can be completed, not how easy they are to discover without help.
- The reviewer approval step, Brand Health and the brand-book import were tested by the team, not by the participant.
- No timings, quotes or ratings, so the kit's assumptions (a)–(d) are not yet tested.
