# RCM Prototype v3 — Sellable Narrative

**Goal**: turn the proto from a generic ops dashboard into a sellable demo. Two
named patients carry the story end-to-end. The hospital-side agent assembles
packets, submits to insurer, gap-fills when queried, three times per patient
(GL → top-up → final claim), under two rule modes (policy-on-file vs
payor-intelligence). State persists locally as the leader clicks through.
Light + dark, component-level, no breakage.

This plan is UX and flow only. No code, no schema. Existing files stay where
they are unless explicitly listed.

---

## 1. The three patients we sell

All three seeded richly. Other worklist rows are stubs.

| | Patient 1 — **Budi Santoso** | Patient 2 — **Ibu Siti Aminah** | Patient 3 — **Ravi Subramaniam** |
|---|---|---|---|
| Demographics | 58M, Mayapada Hospital | 47F, RS Cendana Jakarta | 51M, Mayapada Hospital |
| Procedure | CABG (Bypass) | Laparoscopic Cholecystectomy | TKR (Total Knee Replacement) |
| Insurer | **Prudential Indonesia** (policy PDF on file) | **BPJS Kesehatan** (no policy, gov scheme) | **AIA Indonesia** (policy PDF on file) |
| Why this case | The dramatic one — pre-existing HTN/DM, intra-op 4th-graft adds 55M, **GL top-up moment** while surgery is live, TPA queries back for intraop note. Ends "Approved with Amendment". | The contrast — clean, smaller-ticket, no policy on file. Agent leans on **Payor Intelligence** library (prior cases + admin rules) to assemble the packet. Ends "Approved" cleanly. | The contested one — admitted to a Deluxe room exceeding plan cap → **room-rent prorate deduction** fires, AIA partials the claim, agent **drafts an appeal** citing medical necessity for the higher room (post-op infection risk). Ends "Approved/Rejected (contesting)". |
| Rule mode | **Mode A** (policy on file) | **Mode B** (payor-intel only) | **Mode A** (policy on file) |
| GL flow | Initial → **Top-up** → Final | Initial → Final | Initial → Final → **Appeal** |
| Silo focus | Post-Discharge (with concurrent drama) | Pre-Auth + Concurrent | Post-Discharge with appeal in Discharge stage |
| Verdict label demonstrated | Approved | Approved | Approved/Rejected (contesting) |
| Source narrative | RCM Prototype-docs.docx | Composed to mirror docx structure | Composed to mirror docx structure |

Three patients × three silos × three verdict labels × two modes — the demo can land any pitch direction the audience steers toward.

---

## 2. Worklist (breadth) — minimal changes

Same `/worklist` route. Same 3 silos (Pre-Auth, Concurrent, Post-Discharge).
Two changes.

### 2.1 Rename kanban columns to descriptive status labels

The same lifecycle applies to every silo, because every silo is a submission
moment (GL, top-up, final claim). One vocabulary, three contexts.

| Status label (new) | Meaning shown to a leader |
|---|---|
| Building | AI is assembling the packet |
| Submitted | Sent to insurer, awaiting acknowledgment |
| In Review with insurer | Insurer is adjudicating |
| Asked for docs | Insurer queried, AI is gap-filling |
| Verdict — Approved | Closed, no contest |
| Verdict — Approved/Rejected (contesting) | Partial outcome, agent drafting appeal |
| Verdict — Rejected | Closed, no contest |

Replaces today's `Building / Submitted / Aging / At Risk / Ready / Denied / Paid`
jargon. Each column gets a one-line tooltip on hover so the leader reads it
once and gets it.

Applies identically to all 3 silos. Internally `subStage` mapping changes;
externally the label change is what the audience sees.

### 2.2 Add two filter chips (additive, not replacing)

Existing chips stay. Add:

- **SLA risk** — claim or insurer reply >5 days from discharge
- **At-risk** — document completion <80%

Two new chips slot in alongside the existing four. Visually identical pattern.

### 2.3 Keep both Kanban and Table — toggle stays

Both views remain, toggle in the worklist topbar (existing pattern). For a
workflow-based app this is powerful: kanban tells the *flow* story (cards
moving stage to stage), table tells the *manifest* story (a flat list a
manager scans). Different audiences land on different views.

- Default = Kanban (most visual, story-friendly).
- Toggle to Table for density.
- Both views read the new status labels from §2.1.

---

## 3. Patient drilldown (depth) — full-page route, no overlay

**This is the headline change.** The three drawer components
(`ClaimDetail`, `CaseDetail`, `AppealDrafter`) collapse into one full-page
route: `/patient/:id`. Click a row → navigate, no overlay.

### 3.1 Layout (full page)

```
┌────────────────────────────────────────────────────────────────────────┐
│ HEADER  — Budi Santoso · 58M · Prudential · CABG · pre-existing HTN/DM │
│          Status pill · SLA bar · GL trio (Initial · Top-up · Final)    │
│          Primary action button (context-aware)                         │
├──────────────┬─────────────────────────────────────────┬──────────────┤
│ TIMELINE     │ STAGE BODY                              │ PACKET RAIL  │
│ (left rail)  │ (main, scrollable, sectioned)           │ (right rail) │
│              │                                         │              │
│ • Consult    │ ┌─ Stage: Pre-admission ──────────────┐│ Mode badge   │
│ • Diagnost.  │ │ Narrative                           ││ (A or B)     │
│ • Pre-adm.   │ │ Agent actions taken                 ││              │
│ • Admission  │ │ Documents (clean/missing/flagged)   ││ Acceptance % │
│ • Surgery    │ │ Insurer correspondence thread       ││ SLA bar      │
│ • ICU        │ └─────────────────────────────────────┘│ Checklist    │
│ • Discharge  │ ┌─ Stage: Admission ──────────────────┐│ Blockers     │
│              │ │ ...                                 ││ Submit / GL  │
│              │ └─────────────────────────────────────┘│ top-up / Fin │
└──────────────┴─────────────────────────────────────────┴──────────────┘
```

### 3.2 Header

- Identity: name, age, sex, MRN, hospital.
- Insurer + procedure pill.
- Pre-existing conditions chips (each clickable → highlights related rule
  fires in the packet rail).
- Status pill (the new label from §2.1).
- SLA bar (matches visit-demo SlaBar pattern — green/amber/red, % elapsed).
- **GL trio** — three small pills horizontally: `Initial GL` · `Top-up` ·
  `Final claim`. Each shows state (not started / drafting / submitted / approved
  / rejected). Click a pill → main panel scrolls to that submission moment.
- Primary action button — context-aware ("Submit GL", "Submit top-up",
  "Submit final claim", "Send appeal", "Mark closed").

### 3.3 Left rail — journey timeline

Vertical list of clinical stages from the docx:

1. Consultation
2. Diagnostics
3. Pre-admission
4. Admission (IPD)
5. In surgery
6. Post-operative care (ICU)
7. Discharge

Current stage glows. Past stages = dim with checkmark. Future stages = greyed.
Click any stage = main panel scrolls to that stage's section.
Each stage shows a tiny progress dot: green (complete) / amber (in progress) /
red (blocked) / grey (future).

### 3.4 Main — stacked stage sections

For each stage, one card with four sub-blocks:

1. **What happened** — the clinical narrative (1-2 sentences from the docx).
2. **Agent actions** — bullet list, e.g. "Auto-fetched demographics from EMR",
   "Verified CABG covered under PRUSolusi Sehat tier 3", "Pre-filled TPA
   authorization form". Reuses the existing `AgentStream` visual.
3. **Documents collected at this stage** — chip list with status icon per doc:
   *clean / missing / flagged / freshness-expired*. Click a chip → side panel
   PDF preview. Mirrors visit demo's `DocumentsPanel`. Doc list per stage
   matches the docx tables exactly (Doctor's Rx, demographics, lab results,
   etc.).
4. **Insurer correspondence** — only on stages where it applies (Pre-admission
   onward). See §3.6.

Special block for **In surgery** stage on Budi: a red banner
"Complication identified: 4th vessel grafted intra-op, +55M IDR, exceeds GL".
Inline GL Top-up CTA appears here. Click → drafts amendment letter, marks
required docs (intraop finding note, anaesthesia chart, revised cost estimate,
LMA addendum), animates the sub-checklist filling, submits.

### 3.5 Right rail — packet readiness

Live, sticky.

- **Mode badge** — "Mode A · Policy on file" or "Mode B · Payor Intelligence".
  Tooltip explains the distinction. See §4.
- **Acceptance %** — animated gauge (reuse existing).
- **SLA bar** — same SLA as header but at submission scope.
- **Required-docs checklist** — hierarchical: GL set / Top-up set / Final-claim
  set. Each item green/amber/red with a hover for why.
- **Blockers** — what's stopping the next submission, plain English ("Missing:
  signed intraop finding note from Dr. Wijaya").
- **Submit / Top-up / Finalize buttons** — one is primary at a time,
  determined by state.

### 3.6 Insurer correspondence thread

Inline inside relevant stage sections. Email-thread visual:

- Latest message on top, expandable.
- Each TPA reply shows: who sent (PRU TPA, AdMedika, BPJS Verifier), subject,
  body excerpt, AI annotation tag underneath ("Requested: intraop note,
  anaesthesia chart").
- AI annotations link to the checklist on the right rail — clicking jumps the
  user to the checklist item.
- "Add reply" button at bottom — opens a small composer with the agent's
  pre-drafted response. Send = mock; toast confirms.

Realistic Bahasa-Indonesian phrasing for TPA messages, drawn from research
seed data:
- *"Mohon dilengkapi resume medis yang ditandatangani DPJP untuk pasien atas nama Budi Santoso."*
- *"Permintaan Kelengkapan Berkas Klaim — Budi Santoso / GL PRU-2025-00341"*

### 3.7 What replaces today's drawers

| Today | After v3 |
|---|---|
| `ClaimDetail` drawer | Patient drilldown route, Pre-Auth/Post-Discharge silo |
| `CaseDetail` drawer | Same patient drilldown, Concurrent silo (already inpatient) |
| `AppealDrafter` drawer | Same patient drilldown — appeal becomes a stage block at the end |

Files stay in repo; only the routing changes. The `ClaimDetail` body
becomes the "Post-Discharge stage section" inside the new page. `CaseDetail`
body becomes the Concurrent stages. `AppealDrafter` body becomes the appeal
sub-block inside the Discharge stage when verdict is *Approved/Rejected
(contesting)* or *Rejected*.

This means components are reused, not rewritten — just relocated.

---

## 4. Two rule modes — Mode A piggybacks on the upload-docs flow

The differentiator the visit demo cannot show, because they assume rules
already exist on the insurer side.

### 4.1 Mode detection (no new UI)

Mode is **derived from the documents uploaded for the patient**:

- If the patient's uploaded-docs list contains a document of kind
  `policy_certificate` (PDF), the agent runs **Mode A — policy on file**.
- Otherwise, **Mode B — payor intelligence**.

Policy is just another doc kind in the existing `UploadedDocsPanel`. The
upload UI stays exactly as it is today. We add `policy_certificate` to the
doc-kind enum and the kind-icon/label maps. No special "upload your policy"
button.

The mode badge in the right rail flips automatically when a policy doc is
uploaded or removed. State persists in browser local (§7).

### 4.2 Mode A — Policy on file

Agent extracts structured rules from the uploaded policy PDF (mocked — the
"extracted rules" pop in over ~1 second after upload, with the same
choreographer pulse used elsewhere). Right-rail checklist now reads from the
extracted policy:

- Sum insured: IDR 500M
- Room cap: IDR 1.2M/day
- ICU cap: IDR 2.4M/day
- Co-pay: 0% in network
- Pre-existing waiting: 12 months (cleared — patient on policy 36 months)
- Pre-auth required: yes for all surgeries
- Documents required (cashless): GL, Pre-auth form, LMA, op note,
  anaesthesia record, ...

Each rule is shown as a row, with the source ("Page 7, clause 4.3") on hover.
This mirrors the visit demo's `RulesPanel` — but populated from *our* uploaded
PDF rather than a pre-seeded policy library.

### 4.3 Mode B — Payor Intelligence

When no policy is on file (Patient 2, BPJS), the agent falls back to the
Payor Intelligence library. Right-rail checklist now reads from the
hospital-curated, evolving rule set. Each row is tagged:

- **Derived** — auto-learned from prior cases ("Based on 47 prior BPJS CABG
  cases").
- **Admin-added** — manually added by hospital RCM admin, with approver
  initials.
- **Promoted from denial** — added because a similar denial taught us this rule.

Each rule shows confidence (% of historical cases this held), evidence count
("47 cases"), and a "promote learning" action — when Budi's case closes,
new patterns get suggested for the library.

### 4.4 The mode toggle is the demo punchline

Walking from Patient 1 to Patient 2, the leader sees the mode badge flip and
the checklist source change visibly. That's the moment that says "we work in
both worlds — the clean policy-on-file ones, and the messy SEA reality".

---

## 5. Payor Intelligence — reorganized into 3 tabs

Today: one page, 3 payor cards on top, thread ingestion + rule library
underneath. Cluttered, doesn't scale.

### 5.1 New structure: `/payors` with 3 tabs

#### Tab 1 — **Payors** (default)

Inspired by visit demo `Policies` page.

- Grid of payor cards (3 today: BPJS, Prudential, AIA). Each card:
  - Payor name, kind (gov/private), monthly volume, network type.
  - Performance trio: clean-claim rate, avg days to payment, denial rate.
  - "X rules · Y threads ingested" footer.
- Click a card → **Payor detail page** (full route, not modal):
  - Header: payor identity + scorecard (the existing 3-metric stack).
  - Two-pane body, like visit demo's `PolicyDetail`:
    - **Left**: payor profile — kind, channels, INA-CBG handling, CoB rules,
      typical SLAs, common denial reasons (top 5 with frequency bars).
    - **Right**: structured rules grouped — *Documentation* / *Coverage &
      Financial* / *Process*. Each rule has ID, plain-English description,
      threshold value, source confidence (`extracted` / `industry-typical` /
      `admin-added`), evidence count.
  - Bottom: recent threads with this payor (3-5 most recent, click → §5.2).

Drilldown spirit, not drawer.

#### Tab 2 — **Email Inbox**

Replaces today's `ThreadIngestion` panel. Looks like an email inbox.

- Left list: threads sorted newest-first, each row shows
  payor logo + sender + subject + outcome pill + age.
- Click a thread → right side shows the full email exchange (multi-message
  thread view), with AI annotations on each message:
  - "📌 TPA requested: intraop note, anaesthesia chart" under their query.
  - "🤖 Agent replied with: drafted reply attaching X, Y" under our send.
- Each thread links to the patient case (clickable badge → opens patient
  drilldown).
- Bulk action button: "Re-ingest all threads" (mocked, animated count-up).

This is also the first place a new user lands when they want to understand
"what's actually flowing between us and insurers". Email inbox metaphor is
universal and comprehensible.

#### Tab 3 — **Payor Rules**

Replaces today's `RuleLibrary`. Full-width table.

- Filter chips: by payor / by category (doc / financial / process) / by source
  confidence (extracted / industry-typical / admin-added / promoted-from-denial).
- Columns: rule ID, payor, category, plain-English description, threshold,
  source-confidence pill, evidence count, lift %.
- Row action: "Promote / Demote / Edit / Disable". Edit and add happen in a
  side panel — admin curation lives here.
- Bottom toolbar: "Add admin rule" (small composer modal — name, payor,
  category, description, value).

Realistic seed data per §6.

### 5.2 Realistic seed — believable values, real sources

Drawn from web research:

- **BPJS** (Permenkes 26/2021, Permenkes 3/2023, BPJS verifier manual):
  SEP issuance 3×24h, INA-CBG case-mix tariff, fragmented re-admission <7d
  rule, CoB selisih biaya.
- **Prudential** (PRUSolusi Sehat brochure, Prudential klaim docs, AdMedika):
  AdMedika cashless flow, prorate room rate, 12-month PED waiting, IDR 10M
  outpatient pre-auth threshold, GL amendment within 24h.
- **AIA** (AIA-AdMedika docs, OJK SEOJK 7/2025): 12-month PED waiting,
  cataract/hernia 12-month wait, ICU 2× standard cap, 60-day reimbursement
  window.

Source confidence labeled per rule. Industry-typical thresholds clearly
flagged. Citations stored in seed and shown on hover. Full table to be
generated from the web-research output as part of Phase 2.

---

## 6. State management — browser-local, two patients, reset cleanly

### 6.1 What persists

- Uploaded docs per patient (including the policy PDF, which flips Mode A/B).
- GL state per patient (initial / top-up / final): not started / drafting /
  submitted / approved / rejected.
- Correspondence thread state per patient (read/unread, sent replies).
- Worklist filters and last viewed patient (for return-to-where-you-were).
- Payor Intelligence admin-added rules.

### 6.2 How it persists

- Reuse the existing `sql.js + localStorage` stack (`STORAGE_KEY` bumps to
  `_v3`). Browser-local. No backend needed.
- New tables (or columns) only where strictly necessary:
  - `documents.kind` accepts `policy_certificate`.
  - `gl_submissions(patient_id, kind, state, submitted_at, approved_at, ...)` —
    drives the GL trio in the header.
  - `email_threads.parent_thread_id` for threading.
  - `payor_rules.source_confidence`, `payor_rules.added_by`,
    `payor_rules.evidence_url`.

### 6.3 Reset

- Existing "Reset demo data" sidebar link stays where it is (left sidebar
  footer). Wire it to the v3 schema: clears localStorage, reseeds all three
  patients, all rules, all threads.
- Click → confirm modal → wipe → reseed → toast "Demo reset to clean state."
- One-click reset, no extra button anywhere else.

---

## 7. Light + dark mode — component-level

Today the proto is dark-only. Light mode added now, not retrofitted later.

### 7.1 Approach

- **Token-driven**, not class-conditional. All colors come from CSS variables
  in `styles/global.css`:
  - `--color-canvas`, `--color-canvas-deep`, `--color-panel`, `--color-panel-2`,
    `--color-ink`, `--color-ink-soft`, `--color-ink-mute`, `--color-ink-faint`,
    `--color-line-soft`, etc.
- Add a `:root[data-theme="light"]` block that redefines every token to its
  light-mode value. Component code never references hex.
- Theme switch lives in the **left sidebar footer** (sun/moon icon).
- Default = **system preference** (`prefers-color-scheme`). Toggle cycles
  *system → light → dark*. Persisted in localStorage. Reacts live to
  OS-level change when on system mode.

### 7.2 Component-level rules

- Every component must use design tokens. No hardcoded `#xxxxxx`. CI lints
  `bg-[#…]` / `text-[#…]` patterns.
- Charts and the gauge have explicit light/dark stroke + fill tokens.
- The `motion` ring pulses use token-derived `color-mix()` — work in both
  themes by default.
- Pills, badges, and tone variants (`good/warn/bad/info/neutral/champagne`)
  get parallel light-mode token values that preserve hierarchy.

### 7.3 What we test

- Each new screen rendered in both themes during build.
- Existing screens stay dark by default, but verified to render in light
  without contrast failures.
- A simple visual smoke pass before phase complete — not pixel-perfect, just
  "no broken contrast, no invisible text".

### 7.4 What we DO NOT do

- We do not introduce a UI library swap (no chakra/mantine/shadcn).
- We do not Tailwind-class-conditional (`dark:bg-… light:bg-…` everywhere).
  Tokens only — keeps the JIT scanner happy and avoids the v4 concat bug.

---

## 8. Sidebar + cleanup — only 3 routes survive

Sidebar shrinks to **three items, in this order**:

1. **Command Center** (renamed from Cockpit; was already partially renamed —
   finish it; KPI page lives here).
2. **Worklist** (the breadth view, §2; deep-link from Command Center quick
   actions).
3. **Payor Intelligence** (the 3-tab page, §5).

Plus a sidebar footer block:

- **Theme toggle** — sun/moon icon (system / light / dark; see §7).
- **Reset demo data** — existing link, kept where it is, just made visually
  cleaner (icon + label).

### 8.1 Code cleanup — kill old aliases and unused pages

This is part of the v3 work, not deferred:

- Remove every nav entry, route, and component file for surfaces NOT in the
  three sidebar items above. Specifically:
  - `/case-review`, `/builder`, `/denials`, `/eligibility`, `/clearances`
    routes (already redirected today) — remove the redirects entirely once
    drilldown is live.
  - The hidden Eligibility and Clearances feature folders (`features/eligibility`,
    `features/clearances`) — delete the code unless something inside is being
    reused in the drilldown. (Audit during Phase 1.)
  - "Cockpit" string everywhere → "Command Center". One name, no aliases.
  - Old `Sidebar.tsx` group headers ("Front cycle / Mid cycle / Back cycle")
    — gone, replaced by the three flat items.
- Remove dead components and store slices that nothing imports after the
  cleanup.
- Clean up `App.tsx` so only the three routes (+ patient drilldown +
  payor detail) exist.

The repo should be smaller after v3, not bigger.

### 8.2 Out of scope (v3)

- Multi-country switcher.
- Real EMR integration.
- Real payor APIs.
- Auth / multi-tenant.
- Mobile views.
- Module D Health Case Management as a separate route (folds into
  Concurrent silo + journey stages).
- More than 3 deeply-seeded patients.

---

## 9. Phasing

Each phase ends with a checkpoint demo. No phase merges to main without the
demo working in both themes.

### Phase 1 — Sidebar shrink + worklist relabel + theme tokens · ~0.75 day
- Sidebar reduced to 3 items: Command Center, Worklist, Payor Intelligence.
- "Cockpit" → "Command Center" everywhere; remove all aliases.
- Delete unused routes/components: `/eligibility`, `/clearances`, old
  redirects, dead feature folders. Audit imports first; only delete what's
  truly unused.
- Rename kanban column status labels, add tooltips.
- Add SLA risk + At-risk filter chips. Existing chips stay.
- Keep both Kanban and Table; Kanban as default.
- Theme tokens added to `global.css` (light-mode `:root[data-theme="light"]`
  block). System-preference default + sidebar-footer toggle (system / light /
  dark cycle).

### Phase 2 — Payor Intelligence reorg · ~1 day
- 3 tabs: Payors (grid → detail), Email Inbox, Payor Rules.
- Payor detail full route.
- Realistic seed data from web research, with source confidence + citations.
- Email inbox metaphor with multi-message threads + AI annotations.
- Admin rule add/edit composer.

### Phase 3 — Patient drilldown shell · ~1 day
- New `/patient/:id` route. Header, left timeline rail, main stages, right
  packet rail.
- Drawer routes redirect to drilldown.
- Reuse existing `ClaimDetail`, `CaseDetail`, `AppealDrafter` body content as
  per-stage blocks.

### Phase 4 — Two rule modes · ~0.5 day
- Add `policy_certificate` to doc-kind enum.
- Mode detection logic (uploaded doc list).
- Mode A: extract rules from uploaded policy PDF (mocked, pulse animation).
- Mode B: read from Payor Intelligence library; show derivation badges.
- Mode badge in right rail, flips live.

### Phase 5 — Three patients seeded deeply · ~1.25 days
- Budi Santoso (Prudential · Mode A · GL → top-up → final · intraop drama,
  TPA query thread).
- Ibu Siti Aminah (BPJS · Mode B · clean GL → final · payor-intel checklist).
- Ravi Subramaniam (AIA · Mode A · GL → final → appeal · room-rent prorate
  partial denial → agent drafts appeal citing medical necessity).
- All stages, docs, correspondence threads, and rule fires populated from seed.
- Reset wipes + reseeds all three deterministically.

### Phase 6 — Polish + light-mode pass · ~0.5 day
- Light mode rendered for every screen.
- Animation timing tuned (mode-flip, GL trio progression, top-up moment).
- Demo script written (90-second walkthrough) — reuses the existing demo
  script doc style.
- Dead routes/components removed where it's safe (no breakage promise).

Total: ~5 days.

### Subagent dispatch (per `superpowers:subagent-driven-development`)

- **Sequential gates**: Phase 1 → Phase 3 (drilldown shell needs cleaned-up
  routes) → Phase 5 (seeding needs the shell).
- **Parallelisable**: Phase 2 (Payor Intel reorg) runs in parallel with
  Phase 3 (drilldown shell). Phase 4 (rule modes) parallelises with the
  Patient 2 seed once Phase 3 is in.
- **Light-mode pass (Phase 6)** is the final gate; runs single-threaded
  across all surfaces.

---

## 10. Decisions — locked

1. Patients: **Budi Santoso · Ibu Siti Aminah · Ravi Subramaniam** (3 cases).
2. Kanban + Table both kept, toggle in worklist topbar; Kanban is default.
3. Three sidebar items only: **Command Center · Worklist · Payor Intelligence**.
   Old aliases and unused pages removed in Phase 1.
4. Theme: **system default**, toggle in sidebar footer, cycles system / light / dark.
5. Reset: existing **sidebar footer** action, kept and wired to v3 schema.

---

## 11. Risks

- **Scope creep on the drilldown.** It's the most ambitious surface. Discipline
  = ship the shell first (Phase 3) before deepening seed (Phase 5).
- **Light-mode breakage in third-party visuals** (motion ring, gauge,
  sparkline). Mitigation: token-derived colors only, smoke-test both themes
  per phase.
- **Rule extraction mock looking fake.** Mitigation: animate it slowly, show
  the source PDF on the left while rules pop on the right — same trick as
  visit demo's PolicyDetail. The leader sees the PDF and the rule simultaneously.
- **State persistence bugs across schema bump.** Mitigation: bump
  `STORAGE_KEY` to `_v3`, document the reset action prominently, force
  reseed on first v3 load.
