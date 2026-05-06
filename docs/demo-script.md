# Demo script — 90-second walkthrough

A click-by-click walkthrough that takes a hospital CEO from the cold-open
landing page to a verdict on the agent. Presenter notes are *italicised
inline*. Stay under 90 seconds — this is a teaser, not a training.

---

## Cold open — `/` Command Center  (~10s)

1. Open the app at `/`. *“This is the morning view for a revenue-cycle
   lead. Three claims sitting on the cliff today, two payors flagging us,
   one denial fight in progress.”*
2. Point to the KPI tiles (Net cash, Days to pay, Denial-rate).
   *“Everything you’d look at first.”*
3. Point to the queue strip below. *“Three patients deeply seeded — Budi,
   Siti, Ravi. We’ll walk all three.”*

## Worklist — `/worklist`  (~10s)

4. Click **Worklist** in the sidebar.
5. Note the silos: Pre-auth, Pre-discharge, Disputes. *“Universal
   vocabulary — Building, Submitted, Auto-cleared, At-risk, Paid,
   Denied. Same labels regardless of insurer.”*
6. Hover the filter chips (Aging PA, At-risk, Denied). *“These are
   the work-priorities, not the lifecycle.”*

## Patient 1 — Budi Santoso · BPJS  (~20s)

7. Click the **Budi Santoso** row. *“Cardiac surgery patient, BPJS, post-
   discharge.”*
8. Header: identity, payor pill (BPJS), DRG, status pill **PAID**.
   GL trio: **Initial · approved · Top-up · approved · Final · approved**.
   SLA bar: **SLA met · settled in 6d**. *“Three GLs, three approvals,
   closed inside SLA. This is what success looks like.”*
9. Left timeline rail: past stages green, **Discharge** active.
10. Scroll to the **Surgery** stage. Point to the red complication banner.
    *“Intra-op finding, 4th-vessel graft. Cost expanded. The agent caught
    it and fired a top-up GL — that’s why the Top-up pill is approved.”*
11. Right rail: **Mode A** badge — *“Policy on file at BPJS. Rules read
    directly from the policy document.”* Acceptance score 92%. Action:
    **Submit final claim** (already done).

## Patient 2 — Ibu Siti Aminah · BPJS pre-auth  (~15s)

12. Header back-arrow → **Worklist**. Click **Ibu Siti Aminah**.
    *“C-section, also BPJS, but pre-auth review. 18 of 48 SLA hours used.”*
13. GL trio: **Initial · submitted · Top-up · not started · Final ·
    not started**. SLA bar amber: **18h elapsed of 48h**.
14. Right rail: still **Mode A** (BPJS has a policy on file). *“Notice
    the same Mode A badge — but extracted rules are different because
    the procedure is different.”*

## Patient 3 — Ravi Subramaniam · AIA dispute  (~20s)

15. Back to **Worklist**. Click **Ravi Subramaniam**. *“AIA member,
    PCI, partial settlement. The fight.”*
16. Status pill: **Verdict — Approved/Rejected (contesting)**.
17. GL trio: **Initial · approved · Top-up · not started · Final ·
    partial**. SLA bar green: **Appeal SLA · 26d remaining of 30d**.
18. Scroll to **Discharge** stage. *“Agent-drafted appeal letter,
    supporting attachments inline. We didn’t accept the prorate.”*
19. Right rail: **Mode B** badge. *“No policy on file for AIA. Rules
    derived from N prior cases — evidence-driven.”* Point to the
    derivation badges on each rule.

## Payor Intelligence — Email Inbox  (~10s)

20. Sidebar → **Payor Intelligence** → **Email Inbox** tab.
21. Click the **AdMedika top-up thread** (Budi’s permohonan
    perpanjangan). *“Indonesian, AI-summarised, with the exact rule
    that fired highlighted inline.”*
22. Hover the AI annotation. *“The agent links the email back to the
    extracted policy rule. Closed loop — emails feed the rule library,
    the rule library feeds the next packet.”*

## Verdict  (~5s)

23. *“Three patients, three insurers, two rule modes — same agent, same
    packet. That’s the product.”*

---

**Total budget**: 90s. Allow 10s slack on Q&A.
