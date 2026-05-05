# Worklist redesign — claims associate view

## Why

Today the prototype is split across pages that mirror RCM cycle stages
(Eligibility, Case Review, Packet Builder, Denials). That suits a hospital
CFO walkthrough but it doesn't match the **lived day of a claims
associate**, who works through ~30 patients across stages. We're
collapsing those pages into a single Worklist with three pools and
keeping the existing per-stage drawers intact behind it.

## Persona

Single claims associate. Logs in, sees their assigned cases, works the
list down. AI has done ~60% of the work; the associate handles the 40%
that needs human judgment (review-and-submit, approve a remediation
path, upload a missing artifact, escalate, push back on a denial).

## Three silos

| Silo | Source | Headcount in seed | Sub-stages |
|--|--|--|--|
| Pre-Auth / Admission | `claims` where stage in (BUILDING pre-discharge, AWAITING_PREAUTH) + AT_RISK rows where risk_flag = PA_MISMATCH | ~6 | Building · Submitted · Aging · At Risk |
| Concurrent (in-hospital) | `inpatients` table | ~14 | In stay · Watch / extension · Discharge-ready |
| Post-Discharge (claim) | `claims` where stage in (BUILDING post-discharge, READY, SUBMITTED, AT_RISK non-PA, DENIED, PAID) + `denials` rows | ~20 | Building · Ready · Submitted · At Risk · Denied / Appeal · Paid |

## AI / human split (per row, derived)

| Stage | AI | You |
|--|--|--|
| Building | 70 | 30 |
| Ready | 90 | 10 |
| Submitted (adjudicating) | 95 | 5 |
| At Risk | 50 | 50 |
| Denied · drafting / draft-ready | 70 | 30 |
| Concurrent · stable | 90 | 10 |
| Concurrent · extension drafted | 60 | 40 |

Visualised as a thin two-segment bar with `AI 70% · You 30%` label.

## Filters

- At risk only
- SLA < 24h
- Awaiting human (AI done its part)
- ≥100M IDR
- Free-text search (name, MRN, DRG)

## Surfaces

- **`/worklist`** — silo tabs at top, default Kanban (sub-columns per
  stage), toggle to Table view, filter chip row, KPI strip.
- **Click row** → existing stage-routed drawer fires (no logic changes):
  - claim row → `usePacketBuilder.openClaim`
  - inpatient row → `useCaseReview.open`
  - denial row → `useDenials.openDenial`
- **Drawer header** — small toolbar adds `Request info` and `Escalate to
  manager` (toast-only confirmation, marks a flag). Build/Remediate
  remain on their existing panels.
- **Command Center** (renamed from Cockpit) — KPIs reframed for *me,
  today*: my queue (split by silo · count + $), throughput, SLA at risk,
  $ cleared. Quick-action chips deep-link to Worklist with a filter
  pre-applied (e.g., "Pick next at-risk").
- **Sidebar** — hide *Patient Access* group (routes still work). Rename
  *Cockpit* → *Command Center*. Replace *Utilization & Coding* +
  *Billing & Recovery* groups with single *Worklist* item.
- **Old routes** — `/case-review`, `/builder`, `/denials` redirect to
  `/worklist?silo=…`. Files stay in repo (drawer logic still lives
  there), only nav entries removed.

## Files

### New

- `src/lib/worklistAggregator.ts` — fetches all 3 pools, normalises to
  `PatientItem[]` with derived fields (silo, subStage, ai_pct,
  sla_hours, $-tier).
- `src/store/useWorklist.ts` — silo, viewMode, filters, search query.
- `src/features/worklist/WorklistPage.tsx`
- `src/features/worklist/WorklistKpis.tsx`
- `src/features/worklist/WorklistFilters.tsx`
- `src/features/worklist/WorklistKanban.tsx`
- `src/features/worklist/WorklistTable.tsx`
- `src/features/worklist/PatientCard.tsx`
- `src/features/worklist/AiHumanBar.tsx`
- `src/features/worklist/AssistActions.tsx` — Request info + Escalate
  buttons, used inside drawer headers.

### Edit

- `src/components/layout/Sidebar.tsx`
- `src/App.tsx`
- `src/features/dashboard/Dashboard.tsx` — title rename + associate
  reframe.
- `src/features/packet-builder/ClaimDetail.tsx` — add `<AssistActions />`
  in header strip.
- `src/features/case-review/CaseDetail.tsx` — add `<AssistActions />`.
- `src/features/denials/AppealDrafter.tsx` — add `<AssistActions />`.

## Out of scope (this round)

- Manager-side assignment UI (logged-in user is the associate; everything
  shown is theirs).
- Real "Request info" workflow (toast only).
- Per-row drag-and-drop in Kanban.
- Spec C.6 steps 10–12 (remittance auto-parse, underpayment detection,
  learning loop).
