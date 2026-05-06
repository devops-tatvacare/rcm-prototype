# Presenter guide

Keep this simple. The product story is:

**TatvaCare helps an RCM associate see what is stuck, understand what evidence is missing, and move the next claim step forward without jumping across email, folders, and spreadsheets.**

## What the three sidebar surfaces are for

### 1. Command Center

Use this as the opening view.

- Shows queue size, risk, SLA pressure, and value at stake
- Tells the client this is the morning operating view, not where detailed work happens
- Good for a 15-20 second setup only

### 2. Worklist

This is the main operational screen.

- Split into **Pre-auth**, **Concurrent**, and **Post-discharge**
- This is where the associate decides which case to open next
- For this demo, the visible cases are:
  - **Ibu Siti Aminah** — live pre-auth
  - **Ayu Lestari** — manual packet build from uploaded documents
  - **Reza Firmansyah** — concurrent stay extension watch
  - **Budi Santoso** — clean post-discharge success path
  - **Ravi Subramaniam** — partial settlement with appeal in flight

### 3. Payor Intelligence

Use this near the end.

- Shows payor correspondence and reusable payor rules
- Explains where learned rules come from
- Connects inbox signals back to what the associate sees inside the patient workspace

## What the patient workspace is for

When you open a patient from the Worklist, there are two tabs:

- **Action** = what the associate should do now
- **Journey** = what has happened across the episode so far

For the live demo, spend most of the time in **Action** and use **Journey** only to support the story when needed.

## Suggested click flow

## 1. Start at Command Center

1. Open `/`.
2. Say: *“This is the morning operating view. It shows where the queue is sitting, where value is at risk, and which stack needs attention first.”*
3. Point to the queue split across **pre-auth**, **concurrent**, and **post-discharge**.
4. Move on quickly to **Worklist**.

## 2. Use Worklist to frame the queue

1. Open `/worklist`.
2. Say: *“This is the operator’s main queue. It is organized by where the case sits in the revenue cycle.”*
3. Click **Pre-auth** and point out:
   - **Ibu Siti Aminah** = connected EMR, live insurer review
   - **Ayu Lestari** = sparse-data case, packet built from uploaded scans
4. Click **Concurrent** and point out:
   - **Reza Firmansyah** = inpatient stay being monitored for extension and clinical support
5. Click **Post-discharge** and point out:
   - **Budi Santoso** = successful settled case
   - **Ravi Subramaniam** = contesting a partial settlement

## 3. Budi Santoso — clean EMR-connected success path

1. Open **Budi Santoso** from **Post-discharge**.
2. Say: *“This is the best-case path. The hospital already has the clinical record, the policy is on file, and the platform drives the packet cleanly.”*
3. In the header, show:
   - BPJS payor
   - all three GL states approved
   - SLA met / settled in 6 days
4. In **Action**, point to:
   - **Policy-derived**
   - requirements already received
   - no blockers
5. In **Journey**, scroll to **Surgery** and show the scope expansion and top-up approval.

## 4. Ibu Siti Aminah — live pre-auth under review

1. Go back and open **Ibu Siti Aminah** from **Pre-auth**.
2. Say: *“This is a live case in flight. The point here is not appeal or denial recovery. The point is that the initial packet is already structured before the insurer comes back.”*
3. Show in the header:
   - initial GL = submitted
   - top-up = not started
   - final = not started
   - amber SLA bar
4. In **Action**, point to:
   - **Policy-derived**
   - the current packet requirements
   - pending vs received evidence
5. Optional: in **Documents**, click **Upload document**, pick the antenatal note or anaesthesia clearance, then click **Upload selected**.

## 5. Reza Firmansyah — concurrent monitoring case

1. Go back to **Worklist** and click **Concurrent**.
2. Point to **Reza Firmansyah**.
3. Say: *“This queue is for patients already in hospital. The system is monitoring whether the current authorization still holds or whether an extension needs support.”*
4. Show:
   - the case sits in the concurrent queue
   - the extension is being drafted
   - this is about active utilization management, not final billing yet
5. Do not stay here long. This is a queue-level proof point.

## 6. Ravi Subramaniam — partial settlement and appeal

1. Go back and open **Ravi Subramaniam** from **Post-discharge**.
2. Say: *“This is the recovery case. The hospital was paid partially, and the associate needs to push back with a stronger packet.”*
3. Show in the header:
   - **Verdict — Approved/Rejected (contesting)**
   - final claim = partial
   - appeal SLA remaining
4. In **Action**, point to:
   - blockers tied to the appeal
   - **Case-learned** rule source
   - the appeal packet guidance
5. In **Journey**, scroll to **Discharge** and show the appeal evidence pack.

## 7. Ayu Lestari — manual packet build from uploaded documents

1. Go back and open **Ayu Lestari** from **Pre-auth**.
2. Say: *“This is the sparse-data case. The hospital has basic demographics, but the supporting evidence is coming in as outside documents.”*
3. In **Action**, start in **Documents**.
4. Click **Upload document**.
5. First upload:
   - **OB-GYN referral**
   - **Pelvic MRI**
6. As they process, point to:
   - **Upload / Extract / OCR / Code / Packet**
   - OCR and coding signals in the document cards
   - requirement rows moving from **Pending** to **Received**
7. Second upload:
   - **Lab panel**
   - **Pre-op anaesthesia note**
8. Optional final upload:
   - **PRU policy PDF**
9. Then say: *“Once the policy is uploaded, the same case moves from case-learned logic to policy-derived logic.”*

## How to explain the rule engine

Keep this short.

- If the patient has an uploaded policy or benefits document, the workspace shows **Policy-derived** rules.
- If there is no patient-specific policy on file, the workspace shows **Case-learned** rules based on prior payor behavior and correspondence.
- The important point is not the label itself. The point is that the associate sees **what is required**, **what has been received**, and **what is still missing** before sending the packet.

## Close

End with:

**“This prototype is not trying to replace every RCM system. It is showing one simpler thing: give the associate a clear queue, a clear case workspace, and a clear evidence path from intake to submission or appeal.”**
