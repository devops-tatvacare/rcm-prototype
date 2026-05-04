# RCM AI Agent — Prototype

Provider-side, agentic claim-packet builder for Southeast Asian hospitals.
Built around the cash-flow KRA: **compress time-to-claim-acceptance, not chase incremental revenue**.

## What it shows

Three screens, one story:

1. **Cockpit** (`/`) — CFO landing. Time-to-cash, clean claim rate, denial rate, AR > 90 days. Cash-flow waterfall over 30 days, claim pipeline, recent activity, agent wins.
2. **Packet Builder** (`/builder`) — the hero. An agent narrates as it assembles a BPJS-ready claim packet for a hysterectomy case (Sari Wulandari, MRN-734291). 8 artifacts spring onto a canvas, the acceptance probability ticks 47% → 92% on spring physics, predicted days-to-payment drops from 31d to 15d. Two "payor-learned" rule toggles let the audience see what happens when documentation is skipped.
3. **Payor Intelligence** (`/payors`) — the cold-start answer. Per-payor scorecards (BPJS / AIA / Allianz). The "Email-thread ingestion" panel shows historical hospital insurance-desk threads being parsed into the rule library — directly answers Shruti's "where does the training data come from" objection.

## Stack

- Vite + React 18 + TypeScript
- Tailwind v4 (custom theme — not a stock shadcn skin)
- Motion (Framer Motion v11) — spring physics on the gauge, the artifact canvas, and most transitions
- sql.js — real SQLite running in the browser, persisted to localStorage
- zustand — agent + app state
- lucide-react — minimal icon subset

## Run

```
cd rcm-prototype
npm install
npm run dev
```

Opens on http://localhost:5180. Sidebar has a "Reset demo data" link to wipe localStorage and re-seed the SQLite ledger.

## File map

```
src/
  App.tsx                   router + boot
  main.tsx
  styles/global.css         design tokens (colors, fonts, motion)
  lib/
    db.ts                   sql.js init + localStorage persistence
    seed.ts                 schema + Indonesia-flavored seed data
    agent.ts                deterministic agent plan (HYSTERECTOMY_BPJS_PLAN)
    cn.ts, format.ts
  store/
    usePacketBuilder.ts     agent-step machine (idle → running → ready → submitted)
    useAppStore.ts
  components/
    ui/                     primitives — no stock checkboxes anywhere
      Button, Panel, Pill, SegmentedControl, ToggleChip, MetricNumber,
      Gauge, Sparkline, IconBadge
    layout/
      AppShell, Sidebar, TopBar
  features/
    dashboard/              Cockpit + CashFlow + Pipeline + RecentActivity
    packet-builder/         PatientCase + ArtifactCanvas + AgentStream + RuleControls + PacketBuilder
    payor-intel/            PayorIntel + ThreadIngestion + RuleLibrary
```

## How the agent works (mock)

`src/lib/agent.ts` defines a fixed sequence of steps for the demo case. Each step has:

- `kind` — init / fetch / code / rule / compose / validate / ready
- `narration` — one line shown in the reasoning trace
- `artifact?` — optional document to "attach" (animates onto the canvas)
- `ruleId?` — links to a `payor_rules` row visible on the Payor Intelligence screen
- `probDelta` — points added to the acceptance score
- `ms` — pause before this step fires

The store walks the plan with `setTimeout`, applying `probDelta` to a spring-driven motion value. Toggling a rule off in the right-rail "Override library" zeroes that step's contribution — the audience can watch the 92% drop back to 81% or 73% on the gauge live.

## Designed for a 90-second walkthrough

Open `/` → set the cash-flow context → click "Packet Builder" → press Run → narrate the rules firing as the gauge climbs → click "Submit to BPJS V-Claim" → cut to "Payor Intelligence" → land on the email-thread ingestion panel.

## Demo data

- Hospital: RS Cendana Jakarta (320 beds)
- Payors: BPJS Kesehatan, AIA Indonesia, Allianz Care
- 4 patients · 4 claims at varied lifecycle stages
- 6 payor-learned rules (with evidence-thread counts and historic lift)
- 5 sample email threads
- 30 days of cash-flow synthetic data
- 7 pipeline buckets
