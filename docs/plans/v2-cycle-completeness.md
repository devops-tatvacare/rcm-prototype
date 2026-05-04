# RCM Prototype — v2 Cycle Completeness Plan

**Goal**: extend the prototype from a centerpiece demo (Module C — Auto-Document Engine + cold-start) into a **whole-cycle** story that lets a chain CEO walk from registration → discharge → claim → appeal without finding a dead end.

**What's in scope:** Modules A (Eligibility), B (Financial Clearance), D (Health Case Mgmt), E (Denials Mgmt), spec-banner KPIs, multi-country switcher, and the loose ends from slide 2 of the modules deck.

**What's deliberately not in scope:** EMR/HIS integrations, real payor APIs, real ML, auth, multi-tenant infra, mobile.

---

## Recommended sequencing (rationale)

For demo punch per unit of work, the ranking is **A > E > B > D**:

1. **Module A (Eligibility)** is the cycle's bookend: every story starts with "patient arrives, agent verifies in 90 seconds." It's the most visceral demo moment and the spec's most concrete TAT win (2-24h → <90s).
2. **Module E (Denials)** gives the agent its second hero moment — drafting an appeal letter from EMR + clinical guidelines + historical successful arguments. Closes the cash-flow story.
3. **Module B (Financial Clearance)** is utility-feeling but real revenue protection (deposit collection, GOP cycle).
4. **Module D (Health Case Mgmt)** is the most "dashboard-y" — useful for utilization review nurses, less dramatic for a CEO room.

Multi-country and the slide-2 fillers come last because they're breadth, not depth.

---

## Phase 1 — Bookends (Eligibility + Denials)

**Effort estimate**: ~2 working days equivalent.

### 1A · Module A — Insurance Eligibility Verification

- **Route**: `/eligibility` · sidebar item: "Eligibility · 90s checks"
- **Demo moment**: Sari's BPJS card scans at registration → 6-second OCR → BPJS V-Claim API dispatched → coverage object aggregated in 84 seconds → pre-auth gap matrix evaluated → eligibility summary auto-attached to her chart. Runs on a timer with a count-up element to make the TAT visible.
- **Screens**:
  1. **Today's eligibility queue** — scheduled admissions for the next 24-48h with batch-sweep status (pre-verified overnight); claim that come in walk-up join the queue.
  2. **Live eligibility check** (drawer or full-screen) — animated flow: card scan → OCR extraction → query dispatch (parallel calls to BPJS / AIA / national ID) → response aggregation → coverage object normalized.
  3. **Coverage detail card** — policy active, benefit limits, exclusions, COB outcome, pre-auth requirements vs planned procedures (gap analysis).
- **Seed additions**:
  - `eligibility_checks` table: id, patient_id, status, started_at, completed_at, tat_seconds, coverage_object_json, dispute_risk_score
  - Mock BPJS V-Claim API responses (3 variants: clean / lapsed / waiting period)
  - Pre-auth requirement matrix per DRG
- **Cross-cutting**: TopBar gets an eligibility ticker (today's avg TAT). Cockpit gets an eligibility-TAT KPI tile.

### 1E · Module E — Denials Management

- **Route**: `/denials` · sidebar item: "Denials · appeals"
- **Demo moment**: A denied claim comes in → agent classifies it (clinical/technical/admin/contractual) → drafts an appeal letter pulling from EMR + relevant clinical guidelines + the historical successful appeals for this payor + DRG cluster → human reviewer edits 2 sentences and clicks Send. Counter shows "appeal #3 of 19 today."
- **Screens**:
  1. **Denials queue** — every denial, color-coded by category, ranked by ROI (`$ × success_prob ÷ days_to_deadline`). Deadline countdown is prominent.
  2. **Appeal drafter** (drawer) — left: denial details + AI classification + root-cause trace ("this denial happened because step X in the original claim was missing Y"). Right: drafted appeal letter, editable, with attachment bundle preview.
  3. **Prevention loop view** — recurring denial patterns with "push to Builder" action (adds new rule to the rule library on Payor Intelligence).
- **Seed additions**:
  - `denials` table with category, reason_code, deadline_at, success_prob
  - `appeal_drafts` table with letter_md, attachment_ids
  - Recurring-denial-pattern aggregator (computed view)
- **Cross-cutting**: Cockpit gets appeal-success-rate KPI. Payor Intelligence rule library gets a "promoted from denials" badge on rules created by this loop.

---

## Phase 2 — Cycle middle (Financial Clearance + Case Management)

**Effort estimate**: ~2 working days equivalent.

### 2B · Module B — Financial Clearance

- **Route**: `/financial-clearance` · sidebar item: "Financial clearance"
- **Demo moment**: Eligibility is confirmed for a TKR patient. Agent runs LOS prediction (XGBoost in real life, scripted here) → returns 5-day stay with 80% CI [4-7]. Episode cost model + payor reimbursement profile gives expected payor pay → net patient liability → deposit recommendation. GOP request auto-drafts, the patient sees a financial consent form on a tablet (mocked preview).
- **Screens**:
  1. **Today's clearances** — admissions awaiting clearance, status flag CLEARED / CONDITIONAL / PENDING / NOT_CLEARED.
  2. **Cost prediction view** — LOS prediction with CI band, episode cost waterfall (room + procedures + drugs + implants), expected payor reimbursement, net patient liability.
  3. **GOP / Consent generation** — auto-drafted GOP letter to insurer, financial consent form preview, patient signature capture (mocked).
- **Seed additions**:
  - `clearances` table: status, los_predicted, los_ci_low, los_ci_high, episode_cost, expected_reimb, deposit_required, bad_debt_risk_tier, gop_status, consent_signed_at
  - Mock LOS predictions per patient based on diagnosis
- **Cross-cutting**: Cockpit gets deposit-collection-rate + bad-debt-rate KPIs.

### 2D · Module D — Health Case Management

- **Route**: `/case-management` · sidebar item: "Concurrent review"
- **Demo moment**: Utilization review nurse opens dashboard. 47 inpatients, 3 are flagged red — Day 6 of authorized 5 days for one. Click → AI shows medical-necessity documentation gaps for this patient ("payor needs objective indicators of continued IV antibiotics — your notes mention 'improving' but no quantitative markers"). One-click drafts pre-auth extension letter using current clinical justification.
- **Screens**:
  1. **Concurrent review dashboard** — all active inpatients, columns: patient, payor, day-of-stay vs DRG benchmark (color-coded), auth days remaining, medical-necessity completeness %.
  2. **Patient case review** — clinical documentation gaps with payor's medical-necessity criteria highlighted; AI suggested note additions.
  3. **Pre-auth extension drafter** — same drawer pattern as Builder.
- **Seed additions**:
  - `inpatients` table: patient_id, admission_date, authorized_days, los_actual, los_drg_benchmark, medical_necessity_score, auth_extension_status
  - `medical_necessity_gaps` table per patient
- **Cross-cutting**: Cockpit gets avoidable-day-rate + auth-extension-approval KPIs.

---

## Phase 3 — Breadth

**Effort estimate**: ~1.5 working days equivalent.

### 3.1 · Multi-country switcher

- TopBar gets a country dropdown: ID (default) / MY / TH / SG / PH
- Switching swaps:
  - Visible payors (BPJS+AIA+Allianz for ID; MySalam+AIA+Prudential for MY; NHSO+AIA for TH; MediShield+AIA for SG; PhilHealth+AIA for PH)
  - DRG code system (INA-CBG / DRG-AM / Z-benefit / etc.)
  - Currency display (IDR / MYR / THB / SGD / PHP)
  - Hospital list
- Implementation: country field on hospitals/payors/claims, filter every query by selected country
- **Note**: this is invasive but high-impact for a regional pitch.

### 3.2 · Spec-banner KPIs

Surface the spec's headline numbers wherever they fit:

| KPI | Where it lives | Source |
|---|---|---|
| Eligibility TAT < 90s | Cockpit + Eligibility page | `eligibility_checks.tat_seconds` |
| Discharge-to-bill < 48h | Cockpit + Builder header | computed from claims |
| Appeal success rate > 70% | Cockpit + Denials page | `appeal_drafts.outcome` |
| 40-KPI dashboard | New `/analytics` route, table view of all 40 | Computed from existing tables |

### 3.3 · Slide-2 fillers (optional, lowest priority)

Only build if there's room and the audience asks. Each is a single read-only page:

- **Provider Credentialing** — license expiry tracker; auto-renewal reminders
- **Patient Portal preview** — patient-facing view of their claim status (mock, no auth)
- **Charge Capture audit** — under-captured charges by physician/department vs case-mix expected
- **Interoperability monitor** — connection status to EMR / LIS / RIS / Pharmacy / OT systems

---

## Cross-cutting work (applies to all phases)

- **Sidebar nav** extends to ~7 routes. Group with section headers: "Front cycle" (Eligibility, Financial Clearance), "Mid cycle" (Builder, Case Mgmt), "Back cycle" (Denials, Payor Intel, Cockpit).
- **Schema versioning**: bump `STORAGE_KEY` from `rcm_prototype_db_v1` to `_v2` on schema change; localStorage auto-reseeds.
- **HeadlineStrip on Cockpit** evolves to a 4-tile chain summary (touchless rate, time-to-cash, eligibility TAT, appeal success).
- **Drawer pattern** reused everywhere — the Builder's pattern (one column board / detail in slide-over) becomes the platform standard.

---

## Decisions to make before building

1. **Phase order — confirm?** I recommend 1 → 2 → 3 in order. Alternative: skip Phase 2, jump to Phase 3 multi-country to widen the regional pitch. Your call.
2. **Module D scope.** It's the lowest demo-value piece. Option to drop it from Phase 2 and only do 2B. Saves ~0.5 day.
3. **Slide-2 fillers (3.3).** Build none, build one (Patient Portal probably most CEO-friendly), or build all four. I'd default to none unless asked.
4. **Multi-country breadth.** All 5 SEA countries or just ID + MY (the two named in the transcript)? Reduced scope is faster.
5. **Where does the agent fleet show up?** Right now agents are implicit in the Builder. Consider a `/fleet` page showing all 14 agents across the 4 sites with what each is doing in real time. Optional.

---

## Out of scope (don't build)

- Auth / multi-tenant
- Real payor API integrations
- Real ML (LOS predictor, denial classifier, NLP coder) — keep all scripted
- Mobile views
- Settings / admin pages
- The 7th module (Module F — Payor Performance) is already built as Payor Intelligence, no work needed.

---

## Risks & open questions

- **Scope creep**: easy to add "one more screen" inside each module. Discipline = one demo moment per module, three screens max.
- **Sql.js schema migration**: localStorage caches the DB. Each schema bump needs a clean reset. Document the `Reset demo data` action prominently.
- **Trace flow consistency**: every module that has an "agent does work" moment should reuse the AgentStream component pattern from the Builder. Build once, instantiate per module.
- **Visual fatigue**: 7 routes is a lot. Make sure each has a distinct visual signature (color tone, primary motion) so the demo doesn't feel samey.
