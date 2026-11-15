# INKLOOM AI: design system

The visual and interaction rules for the INKLOOM AI web app and marketing site.

**Status: v2 (15 Nov 2026), light aesthetic theme, implemented in the codebase.** v1 (14 Nov) used indigo on near-black. Wireframes: the "Inkloom Wireframes" design canvas (11 artboards: landing, login, signup, dashboard, new audit, audit result, Knowledge Centre, Brand Health, components, mobile, shared sidebar). Where the code and the canvas differ, §11 says which wins.

This file describes how things look and behave. It does not change product rules: the score formula, validator rules and roles stay as the proposal fixes them (§7.3–7.5, §8.1).

---

## 0. References

We looked at three professional SaaS sites and measured their computed styles in a browser (14 Nov 2026):

| Site | UI font | H1 | Body | Background | What we take |
|---|---|---|---|---|---|
| linear.app | Inter Variable | 38px / 510 weight / −0.84px tracking | 15px / 24px line height | `#08090A` near-black | Dense, calm app UI; Inter; tight heading tracking; muted grey body text |
| vercel.com | Geist Sans + Geist Mono | 48px / 400 / −2.88px tracking | 16px / 24px | `#000000` | Mono for technical labels; dark hero; strong negative tracking on display type |
| stripe.com | Söhne (licensed) | 34px / 300 | 14px | white with a gradient hero | Generous whitespace; bento feature grid; a premium marketing page |

What they share, and what we adopt:
- One neo-grotesk sans for everything (Inter, Geist or Söhne). We use **Inter**: free (OFL), and available on Google Fonts and as `next/font`.
- A monospace for IDs, numbers and code. We use **JetBrains Mono** (OFL).
- Headings with negative letter-spacing (−0.02 to −0.035em). Body text at 14–16px with a ~1.6 line height.
- A dark hero on the marketing site and a light, quiet app. (v1 followed this; v2 went fully light at the product team's request, see §2.)

---

## 1. Design philosophy

**"Evidence, calmly presented."** INKLOOM tells people their content breaks the rules. The UI must feel trustworthy and precise, never alarming.

1. **Quiet app, expressive front door.** The 3D, motion and dark surfaces belong to the landing page and the auth side panel. Inside the app the work is the hero: light surfaces, one accent, colour used only to mean something.
2. **Colour carries meaning.** Plum means action or selection. Red, orange, amber and blue are reserved for the severities Critical, Major, Minor and Info. No decorative colour.
3. **Every claim shows its source.** Findings always show the quote, the cited clause, fact or term, and how the result was produced (AI review, Rule checks only, or Simulated analysis).
4. **People decide.** Approve, reject and waive are explicit, labelled and reversible where the rules allow. A blocked state says why, and what unblocks it.
5. **The 3D idea: checked content.** A glass sphere holds a shield with a check, and the content types INKLOOM audits (image, typography, document, video) float around it, each with a check. That one scene is the only 3D motif.

---

## 2. Colour palette (v2: light aesthetic theme, 15 Nov 2026)

Warm ivory and pastels with a deep plum accent. It replaces the v1 indigo-on-near-black look. Tokens live in `src/app/globals.css`. Tailwind's `zinc` and `indigo` scales are redefined there as warm greys and plum, so existing classes follow the theme.

### Brand
| Token | Value | Use |
|---|---|---|
| `--primary` | `#5B4B8A` plum (white text 8:1) | Primary buttons, links, active nav, focus ring |
| `--primary-hover` | `#4A3C75` | Hover on primary |
| `--primary-soft` / `--accent` | `#F1ECF8` | Selected rows, active nav, chips |
| `--accent-foreground` | `#3E3166` | Text on soft plum |
| `--lavender` `--peach` `--sage` `--sky` `--sand` | `#EDE7F8` `#FBE6DA` `#E3F0E8` `#E3EEF8` `#F5F1EA` | Section and card tints (one tint per feature card) |
| Logo mark | gradient `#B9A6E6 → #F2B89D` | Logo square only |

### Neutrals (warm)
| Token | Value | Use |
|---|---|---|
| `--background` | `#FBF8F3` ivory | Page background |
| `--card` | `#FFFFFF` | Cards, tables, sidebar |
| `--border` | `#E8E1D9` | Card borders, dividers |
| `--input` | `#DDD3E6` | Input and secondary-button borders |
| `--foreground` | `#231F2B` warm ink | Primary text |
| `--muted-foreground` | `#5E5868` | Secondary text (`#6B6475` only at 14px+) |

### Semantic (unchanged, meaning comes first)
| Meaning | Solid (white text) | Soft bg / text |
|---|---|---|
| Critical / error | `#DC2626` | `#FEE2E2` / `#991B1B` |
| Major | `#C2410C` | `#FFEDD5` / `#9A3412` |
| Minor / warning | `#A16207` | `#FEF3C7` / `#92400E` |
| Info | `#2563EB` | `#DBEAFE` / `#1E40AF` |
| Success | `#3F7F62` sage | `#E3F0E8` / `#2F6B4F` |

Rules:
- Severity is never shown by colour alone: every badge has a text label, and highlights also carry an underline.
- "In review" uses soft plum so it never reads as a severity.
- No dark hero anymore. Dark surfaces are reserved for toasts.

## 3. Typography

```css
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
```
Load both with `next/font/google` (`Inter`, `JetBrains_Mono`), `display: swap`, weights 400/500/600 (Inter) and 400/500 (Mono).

| Style | Size / line height | Weight | Tracking | Where |
|---|---|---|---|---|
| Display | 60 / 1.05 (34 on mobile) | 600 | −0.035em | Landing hero H1 |
| H1 | 40 / 1.15 | 600 | −0.025em | Landing section titles |
| Page title | 28 / 1.25 | 600 | −0.02em | App page headers (Content, Knowledge Centre…) |
| H3 | 20 / 1.3 | 600 | −0.01em | Card and section titles |
| Section label | 15–16 / 1.4 | 600 | 0 | Card headings in the app |
| Body large | 18 / 1.6 | 400 | 0 | Hero subtitle |
| Body | 16 / 1.6 | 400 | 0 | Audited content viewer, marketing body |
| UI | 14 / 1.5 | 400–500 | 0 | Default for tables, forms, buttons, nav |
| Caption | 12–13 / 1.4 | 400–500 | 0 | Helper text, metadata |
| Eyebrow | 12 / 1 mono | 500 | +0.08em uppercase | Marketing section labels |
| Mono data | 12–13 mono | 400–500 | 0 | Clause IDs (`TONE-01`), versions (`v2`), scores, deductions |

Rules: at most three sizes on one card; numbers in tables use `font-variant-numeric: tabular-nums`; never set body text below 14px in the app.

---

## 4. Layout system

**Base unit 4px.** Spacing scale: 4, 8, 12, 16, 20, 24, 32, 48, 64, 96.
**Radius:** 6 (badges inside inputs), 8 (buttons, inputs), 12–14 (cards), 16–20 (modals, marketing cards), full (pills, avatars).

### Marketing site
- Container `max-width: 1200px`, side padding 24px.
- Sticky top navbar, 72px: logo, 4 anchor links, "Sign in" (secondary) + "Try the demo" (primary). Below 768px the links collapse into a menu button (44×44 touch target).
- Sections are separated by 96px vertical padding. Feature grids are 12-column with a bento pattern (wide card = 2 tracks).

### App shell
```
┌──────────┬──────────────────────────────────────────┐
│ Sidebar  │ Page header (breadcrumb, title, actions)  │
│ 240px    ├──────────────────────────────────────────┤
│          │ Content, max-width 1120–1200px, centred   │
│ org      │ padding 32px                              │
│ + New    │                                           │
│ nav      │                                           │
│ org nav  │                                           │
│ user     │                                           │
└──────────┴──────────────────────────────────────────┘
```
- **Sidebar** (one shared component, `src/components/app-sidebar.tsx`): organisation card, primary "+ New audit" button, main nav (Content, New audit, Knowledge Centre, Brand Health), user + role + sign-out at the bottom. The organisation nav on the canvas (Members & roles, Activity log, Settings) is added only when those pages exist; no dead links. The active item gets a `--sidebar-accent` (`#F1ECF8`) background, `#3E3166` text, and a filled icon.
- Nav items are hidden by role, not disabled: Brand Health and the Knowledge Centre edit actions are owner/reviewer only (§8.1).
- **Page header**: breadcrumb (13px muted) → title (28px) → actions aligned right; wraps below on narrow screens.
- **Grids**: content uses CSS grid `repeat(auto-fit, minmax(200–260px, 1fr))` for stat tiles and cards, and flex-wrap two-column splits (e.g. audit result: content viewer 1fr | findings 1fr; Knowledge: list 1fr | detail 2fr).

---

## 5. Components

Built on shadcn/ui (`src/components/ui`). Restyle through tokens; don't fork components.

| Component | Spec |
|---|---|
| **Button** | Heights 32 / 40 / 48. Variants: primary (plum), secondary (white + `--input` border), ghost, destructive (red), disabled (50% opacity, `pointer-events: none`, from shadcn). Landing buttons are pills (`rounded-full`). Loading = 14px spinner + verb-ing label ("Auditing…"), button keeps its width. Icon-only buttons need `aria-label`. |
| **Badge** | 22px pill, 12px/500. Solid for severity, soft for status. Always text, optionally a 6px dot. |
| **Input / Select / Textarea** | 36–44px tall, radius from `--radius`, `--input` border. Focus: `--ring` border + 3px `--ring` at 50% (shadcn). Error: red border + red helper text below that says what to do. A label always sits above the field; never use placeholder-only fields. |
| **Segmented control / Tabs** | Zinc-100 track, white raised active segment (used for Paste/Upload/Web and range pickers). Page-level tabs use a 2px primary underline. |
| **Card** | White, 1px border, 12–14px radius, 16–24px padding. Clickable cards: hover lifts 2px with the `md` shadow and a darker border. |
| **Stat tile** | Label (13px muted) → value (28px/600) → optional caption. Placeholder `[n]` until real data loads; never invented numbers. |
| **Finding card** | Badges row (severity, category, source: AI finding / Rule check) + deduction at right in mono → one-line problem → quoted text (mono, `--muted` box) → source link → Before / Suggested fix pair → actions (Accept fix, Reject, Waive…). Collapsed variant: one row. Critical gets a red-200 border. Low confidence: dashed border + "Needs human check", 0 deduction. |
| **Score ring** | Conic ring, 112px desktop / 64px mobile; number centred (30px/600) over "/ 100"; the formula line underneath in mono (e.g. `100 −25 −10 −10 −1.8 = 53`). Ring colour follows the worst open severity. |
| **Table** | 14px rows, 12px/500 header on `--muted`, row hover `--muted`. Wrapped in an `overflow-x: auto` box. Below 768px it becomes a card list. |
| **Modal (Dialog)** | Max width 480px, 16px radius, 24px padding, `lg` shadow, backdrop `rgba(9,9,11,.55)`. Title → consequence sentence → required field → Cancel + confirm. The destructive confirm is red and repeats the verb ("Waive finding"). Esc and the backdrop close it; focus is trapped and returns to the trigger. |
| **Toast** (planned) | Bottom-right, `--ink`, 14px, auto-dismisses after 5s, with an inline "Undo" when the action allows it. |
| **Banner** | Full-width inside content: red-50 for "Approval blocked", amber-50 for "Demo mode / Simulated analysis". `role="status"`. |
| **Empty state** | Dashed border, centred: title + one sentence + one primary action. No illustrations. |
| **Skeleton** | Zinc-100→200 shimmer bars matching the final layout; 1.2s loop. |

Elevation: `sm 0 1px 2px rgb(0 0 0/.04)` · `md 0 16px 36px -14px rgb(91 75 138/.28)` (plum-tinted) · `lg 0 24px 64px -12px rgb(0 0 0/.4)`.

---

## 6. Pages

From the codebase (`src/app`) and PLAN.md. ✅ = exists today, 🆕 = new in the wireframes.

| Route | Page | Who | Key content |
|---|---|---|---|
| `/` | Landing ✅ (redesign) | Public | Light interactive 3D hero, How it works (4 steps), product bento (findings, score, Confidential Guard, Brand Health), roles, trust, CTA, footer |
| `/login` | Sign in ✅ | Public | "Try the demo" card (Brand owner / Reviewer on Northbeam Cloud), email + password, "Email me a sign-in link" (magic link, existing accounts only, same reply either way), light 3D side panel ≥1024px |
| `/login` (Create an account) | Sign up ✅ | Public | Today: the "Create an account" toggle on the sign-in form (email + password, confirmation email). The 3-step wizard on the canvas (account → organisation → invite team) is 🆕 and needs an org-creation API first |
| `/dashboard` | Content ✅ | All roles | Stat tiles, title search, channel filter, status chips (all in the URL: `?q=&channel=&status=`), items table (title, channel, version, score, status, last audit), empty and no-match states |
| `/audit/new` | New audit ✅ | Owner, reviewer, creator, agency | Title, channel, org, audience (public/internal); source tabs Paste / Upload / Web page; "Checked against" summary; demo banner; staged progress after submit |
| `/items/[id]` | Audit result ✅ | All (actions by role) | Header with status, version picker, run mode; blocked banner; content viewer with severity highlights; score ring + formula; finding filters and cards; Apply accepted fixes; comments & history; waive / reject / dismiss modals (reason required) |
| `/knowledge` | Knowledge Centre ✅ | Owner, reviewer edit; others read (no internal facts for creator/agency) | Tabs Guidelines / Facts / Terms / Assets; search; list + detail; Do / Don't; version history; Import brand book (P2b) |
| `/health` | Brand Health ✅ | Owner, reviewer | 4 detector tiles; recurring mistakes table with "Rewrite rule (AI)"; fact impact list; unclear rules; conflicting rules with "Compare clauses (AI)" |
| `/settings/members` | Members & roles 🆕 | Owner | Invite, change role, remove |
| `/activity` | Activity log 🆕 | Owner, reviewer | Append-only, filterable list; nothing editable |
| `/settings` | Organisation settings 🆕 | Owner | Name, AI mode/usage cap status, demo flag |
| `not-found`, `error` | 404 / error 🆕 | All | One sentence, a way back, no stack traces |

---

## 7. Responsiveness

Breakpoints (Tailwind defaults): `sm 640` · `md 768` · `lg 1024` · `xl 1280`.

| | Mobile < 768 | Tablet 768–1279 | Desktop ≥ 1280 |
|---|---|---|---|
| App nav | Top bar (org avatar, page title, "+" new audit) + **bottom tab bar** (Content, Audit, Knowledge, Health); org links in an avatar menu | Sidebar collapses to a 64px **icon rail** with tooltips | Full 240px sidebar |
| Marketing nav | Logo + Sign in + menu button → full-screen sheet (Esc closes, focus returns) | Inline links | Inline links |
| Tables | Card list | Horizontal scroll inside the card | Full table |
| Audit result | Score card → tabs "Findings / Content" → **sticky bottom bar** (Request changes, Approve) | Stacked: content above findings | Two columns |
| Forms | Single column, 48px buttons, full width | Two-column field rows | Form 2fr + side panel 1fr |
| 3D hero | Still scene, faded behind the copy, no hover | Full scene + pointer tilt | Full scene + pointer tilt |
| Touch targets | ≥ 44×44px everywhere | ≥ 44px | — |

Layout technique: flex-wrap with flex-basis (`flex: 999 1 560px` for content next to a `flex: 1 1 240px` sidebar) so columns stack without extra media queries; `min-width: 0` on flex children; no `100vh` on inner panels (use `100dvh` only for full-screen sheets).

---

## 8. Animations

Motion tokens:
```css
--dur-fast: 120ms;   /* hover, press */
--dur-base: 200ms;   /* menus, tabs, toasts */
--dur-slow: 320ms;   /* modals, sheets, page sections */
--ease-out: cubic-bezier(.16, 1, .3, 1);
--ease-in-out: cubic-bezier(.65, 0, .35, 1);
```

| Element | Behaviour |
|---|---|
| Buttons | Hover: background shade. Press: `translateY(1px)`. Focus-visible: 3px ring. |
| Cards (clickable) | `.card-lift`: lift −2px + `md` shadow, 200ms. Hero cards: see 3D below. |
| Score ring | Draws from 0 to its value over 600ms (ease-out cubic) on first view; the number counts up. Screen readers get the final number only. |
| Findings | List items fade and slide up 8px, staggered 30ms, first 10 only. Accepting a fix: the highlight in the content cross-fades to green, then away. |
| Modal / sheet (planned) | Backdrop fades 200ms; panel scales 0.96→1 and fades, 320ms. Exit is 2/3 of the enter duration. |
| Toast (planned) | Slides up 12px and fades in; auto-dismisses after 5s. |
| Loading | Skeleton shimmer for page data; button spinner for actions; the audit shows staged steps (Reading → Confidential Guard → Rules + AI → Checking citations → Scoring) instead of a bare spinner. |
| Page transitions | None in the app. Built: the landing hero copy and sign-in form fade up once (`.reveal`). Planned: scroll reveals for lower sections. |

### 3D (landing + auth only)
- **v2 (built): interactive CSS-3D scene,** `src/components/hero-scene.tsx` with the `.hs-*` styles in `globals.css`. It shows a glass sphere holding a cube and a shield with a check, beads circling on a tilted orbit, a pearl pedestal with pulsing rings, and five glass cards (Image, Typography, Document, Video, Brand Health).
  - The whole stage tilts toward the mouse (up to ±9° turn, ±6° pitch), and three depth layers move by 0, 28 and 60px for parallax.
  - Hovering a card straightens and lifts it, then slides out what was checked. Hovering the sphere makes it glow.
  - It uses no WebGL and no new dependencies. Mouse only: touch devices get the still scene, faded behind the copy.
  - `prefers-reduced-motion` stops all movement.
- The sign-in side panel uses the same scene as a still image, `public/images/hero-light.svg` (`.auth-scene`).
- **Later (optional): WebGL scene.**
  - Stack: `three` + `@react-three/fiber` + `@react-three/drei`; UI motion with `motion` (Framer Motion). Add them to `LICENSES.md` when installed.
  - Scene: the same sphere-and-cards scene in real 3D; the camera orbits slowly with scroll.
  - Budget: < 150 KB gzipped JS for the scene, loaded with `next/dynamic` and `ssr: false` after first paint; DPR capped at 1.5; pause rendering when off-screen (`frameloop="demand"` + IntersectionObserver).
  - Fallback: `public/images/hero-light.svg` when `prefers-reduced-motion: reduce`, there is no WebGL, or `navigator.connection.saveData` is on.
- `prefers-reduced-motion` (built): stops the hero tilt and all looping animations, and shortens every transition to 1ms.

---

## 9. UX guidelines

**Navigation**
- At most two clicks from anywhere to "New audit": the sidebar button, `N` as a keyboard shortcut, and the mobile "+" in the top bar.
- Breadcrumbs on every page below the top level (Content / item title).
- Deep links: findings anchor as `/items/[id]#finding-<id>`; selecting a highlight in the content scrolls to its finding and back.
- The skip-to-content link stays (it already exists in `(app)/layout.tsx`).

**Interactions**
- Destructive or governance actions (waive, reject, dismiss, remove member) open a modal that states the consequence and asks for a required reason. Nothing is deleted silently; history is append-only.
- Disabled actions explain themselves: a disabled "Approve" is always paired with the blocking banner (`aria-describedby`).
- Optimistic updates for accept/reject on findings, with an Undo toast; roll back on a server error.
- Always label how a result was produced: "AI review", "Rule checks only" or "Simulated analysis", next to the score.
- Restricted data is marked "(restricted: visible to owners and reviewers)" and is never sent to roles that can't see it. Hiding it in the UI alone is not enough.
- Errors say what happened and what to do, in plain words ("Private network addresses are refused."). No codes or stack traces.
- Keep form input when something fails; never clear a pasted post.

**Accessibility (WCAG 2.2 AA, tested with axe in Playwright)**
- Text contrast ≥ 4.5:1 (3:1 for 24px+), a visible focus ring on everything focusable, real `<button>`/`<a>`/`<label>`, `aria-live` for audit progress and toasts.
- Keyboard: Tab order follows the visual order; `J`/`K` move between findings, `A` accepts, `R` rejects (shown in a `?` shortcut sheet).
- Don't rely on colour alone: severity = colour + label + underline.

**Copy voice**
- Short, plain, British spelling to match the app ("organisation", "colour"). Sentence case for buttons and titles. Verbs on buttons ("Audit content", "Waive finding"), not "OK"/"Submit".

---

## 10. Implementation notes (as built)

| Piece | File |
|---|---|
| Colour, radius, motion tokens; Tailwind `zinc`/`indigo` remapped to warm greys/plum; `.eyebrow`, `.card-lift`, `.auth-scene`, `.reveal`, `.hs-*` hero styles; reduced-motion rule | `src/app/globals.css` |
| Inter + JetBrains Mono via `next/font` | `src/app/layout.tsx` |
| App shell: sidebar (≥1024), icon rail (768–1023), top bar + bottom tabs (<768) | `src/components/app-sidebar.tsx`, `src/app/(app)/layout.tsx` |
| Role names, status badge and severity badge colours | `src/lib/labels.ts` (`ROLE_LABEL`, `STATUS_STYLE`, `SEVERITY_STYLE`) |
| Landing (interactive 3D hero, how it works, product images, roles, trust, CTA) | `src/app/page.tsx` |
| Sign in (demo card, form, light 3D side panel ≥1024) | `src/app/login/page.tsx` |
| Dashboard stat tiles, coloured status badges, empty state | `src/app/(app)/dashboard/page.tsx` |
| Score ring, severity badges and borders | `src/app/(app)/items/[id]/page.tsx`, `finding-card.tsx` |
| Illustrations | `public/images/{hero-light,finding-card,score-ring,health-tiles}.svg` |
| Interactive hero | `src/components/hero-scene.tsx` |
| Landing mobile menu sheet | `src/components/mobile-menu.tsx` |
| Score ring count-up | `src/app/(app)/items/[id]/score-ring.tsx` |
| Magic-link sign-in | `src/app/login/login-form.tsx` |
| Findings stagger, button press | `.stagger` in `globals.css`, `src/components/ui/button.tsx` |

Original notes:

- Tokens go in `src/app/globals.css` under `:root` and `.dark` as shadcn variables (`--primary`, `--background`, `--border`…), plus `--critical/--major/--minor/--info/--success` and `--dur-*`. Tailwind reads them. App components don't hard-code hex values; the landing hero and feature tints do (decorative only). There is no dark-mode toggle yet; `.dark` holds a plum dark palette for later.
- The current header nav in `src/app/(app)/layout.tsx` becomes the sidebar shell. The routes stay the same.
- Build order that matches the core loop: tokens + fonts → app shell/sidebar → audit result page (highest value) → dashboard → new audit → Knowledge → Brand Health → landing with 3D last.

---

## 11. Canvas vs code

The code wins where they differ. Differences:
- Landing H1 keeps "INKLOOM AI" as a screen-reader prefix, so the page title heading still names the product.
- Dashboard tiles count real statuses (Items, In review, Changes requested, Approved) instead of the canvas's "Waiting for my review" and "Blocked by a Critical", which need extra queries.
- Dashboard "Updated" column is "Last audit" (time of the latest audit run); content items have no updated-at field.
- Not built yet: the signup wizard, Members & roles, Activity log, Settings, keyboard shortcuts (J/K/A/R), the waive dialog as a modal (it stays inline on the finding card: the M4 Playwright test and keyboard flow rely on the reason box sitting inside the card), the toast, the WebGL scene, and Musashi hero concepts (canvas only).
