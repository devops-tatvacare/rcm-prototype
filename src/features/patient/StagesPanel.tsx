import { STAGES, type StageKey } from "./JourneyTimeline";
import { StageSection, type StageContent, type DocStatus } from "./StageSection";

// ── Generic stub stage content ────────────────────────────────────────────
// Paraphrased from the v3 narrative docx. P5 will override with patient-specific
// content for the three deep patients (Budi-style cases).
const STUB_STAGES: Record<StageKey, Omit<StageContent, "stage" | "documents">> = {
  consultation: {
    narrative:
      "Patient presents to a specialist with chief complaint and history. Doctor conducts clinical assessment and recommends further investigation.",
    agentActions: [
      "Auto-fetched patient demographics and insurance card from EMR.",
      "Pre-checked policy active status.",
    ],
  },
  diagnostics: {
    narrative:
      "Patient is referred for full diagnostic workup. Results are the clinical backbone of the pre-auth package.",
    agentActions: [
      "Auto-uploaded lab + radiology results as released.",
      "Flagged 72h freshness window on CBC.",
    ],
  },
  preadmission: {
    narrative:
      "Patient is cleared for admission. RCM team assembles documents and submits the initial pre-authorization request to the insurer.",
    agentActions: [
      "Verified policy: procedure covered, sub-limits noted.",
      "Pre-filled TPA authorization form for officer sign-off.",
      "Submitted initial pre-auth packet to TPA via email.",
    ],
  },
  admission: {
    narrative:
      "Patient is admitted to the ward. Clinical monitoring continues. GL is expected during this window.",
    agentActions: [
      "Awaiting GL from insurer.",
      "Routed any TPA queries to correspondence panel.",
    ],
  },
  surgery: {
    narrative:
      "Patient undergoes the surgical procedure. Surgical team executes the planned operation.",
    agentActions: ["Monitoring intra-op events for scope changes."],
    hasComplicationBanner: false,
  },
  postop: {
    narrative:
      "Patient is transferred to the ICU. RCM accrues and documents billable events under the active GL.",
    agentActions: [
      "Auto-attached daily progress notes + MAR from EMR.",
      "Tracking variance against authorized days.",
    ],
  },
  discharge: {
    narrative:
      "Patient is cleared for discharge. RCM prepares final billing submission and reconciles GL versus actual.",
    agentActions: [
      "Reconciled total bill vs amended GL.",
      "Final billing claim submitted with full documentation package.",
    ],
  },
};

const STUB_DOCS: Record<StageKey, Array<{ id: string; label: string; source: string }>> = {
  consultation: [
    { id: "rx", label: "Doctor's Rx / Prescription", source: "Attending Doctor" },
    { id: "demo", label: "Patient Demographics", source: "EHR (Auto)" },
    { id: "ins", label: "Insurance card", source: "EHR (Auto)" },
  ],
  diagnostics: [
    { id: "angio", label: "Coronary Angiography Report", source: "Cardiology" },
    { id: "ecg", label: "ECG / Echo", source: "Cardiology" },
    { id: "cbc", label: "Lab CBC + Lipid Panel", source: "Lab" },
  ],
  preadmission: [
    { id: "lmn", label: "Letter of Medical Necessity", source: "Surgeon" },
    { id: "preop", label: "Pre-op Anesthesia Note", source: "Anaesthesiologist" },
    { id: "preauth", label: "Pre-auth Form", source: "RCM (Auto)" },
  ],
  admission: [
    { id: "adm", label: "Admission Note", source: "Admitting Doctor (EMR)" },
    { id: "consent", label: "Surgical Consent Form", source: "Surgeon + Patient" },
    { id: "gl", label: "GL Letter", source: "Insurer" },
  ],
  surgery: [
    { id: "intraop", label: "Intraoperative Finding Note", source: "Surgeon (signed in theatre)" },
    { id: "rce", label: "Revised Cost Estimate", source: "Hospital Billing" },
    { id: "anaes", label: "Anaesthesia Chart", source: "Anaesthesia" },
  ],
  postop: [
    { id: "icunote", label: "ICU Daily Progress Notes", source: "ICU Doctor (EMR)" },
    { id: "mar", label: "Medication Administration Record (MAR)", source: "Nursing (EMR)" },
    { id: "vitals", label: "Vitals Trend", source: "EMR (Auto)" },
  ],
  discharge: [
    { id: "ds", label: "Discharge Summary", source: "Treating Doctor (EMR)" },
    { id: "inv", label: "Final Itemised Invoice", source: "Billing (Auto)" },
    { id: "rec", label: "Discharge Receipt", source: "RCM" },
  ],
};

// Build a StageContent[] for a given active stage. Past + active stages get
// a clean/missing mix; future stages default to "missing".
function buildStubStages(activeStage: StageKey): StageContent[] {
  const activeIdx = STAGES.findIndex((s) => s.key === activeStage);
  return STAGES.map((s, idx) => {
    const base = STUB_STAGES[s.key];
    const docs = STUB_DOCS[s.key];
    const isPast = idx < activeIdx;
    const isActive = idx === activeIdx;
    const stageDocs = docs.map((d, i) => {
      let status: "clean" | "missing" | "flagged" | "freshness_expired";
      if (isPast) status = "clean";
      else if (isActive) status = i < 2 ? "clean" : "missing";
      else status = "missing";
      return { ...d, status };
    });
    return {
      stage: s.key,
      narrative: base.narrative,
      agentActions: base.agentActions,
      documents: stageDocs,
      hasComplicationBanner: base.hasComplicationBanner ?? false,
    };
  });
}

// ── P5 patient overrides ────────────────────────────────────────────────
// Per-stage rich content for the three deep-seed patients. Stages not listed
// here fall back to STUB_STAGES + STUB_DOCS. `documents` carry an explicit
// status; the surgery flag drives the inline complication banner for Budi.
type StageOverride = {
  narrative?: string;
  agentActions?: string[];
  documents?: Array<{ id: string; label: string; source: string; status: DocStatus }>;
  hasComplicationBanner?: boolean;
};

const PATIENT_OVERRIDES: Record<string, Partial<Record<StageKey, StageOverride>>> = {
  // ── Budi · CABG · GL top-up flow ───────────────────────────────────────
  "p-budi": {
    consultation: {
      narrative:
        "58M with HTN (10y), T2DM (controlled), and dyslipidaemia presents to cardiothoracic surgery with CCS class III angina. Coronary angiogram shows triple-vessel disease 80%/75%/70%. Plan: elective CABG.",
      agentActions: [
        "Auto-pulled demographics and PRU policy from EMR.",
        "Linked patient to existing PRUSolusi Sehat Tier-3 policy on file.",
      ],
      documents: [
        { id: "rx", label: "Cardiothoracic Consult Note", source: "Dr. Wijaya, SpBTKV", status: "clean" },
        { id: "demo", label: "Patient Demographics", source: "EHR (Auto)", status: "clean" },
        { id: "ins", label: "Insurance card · PRU", source: "EHR (Auto)", status: "clean" },
      ],
    },
    diagnostics: {
      narrative:
        "Pre-op workup: ECG, echo (LVEF 52%), CXR, CBC, HbA1c 7.1, eGFR 76, INR 1.0. All cleared for surgery.",
      agentActions: [
        "Auto-attached labs + ECG/echo as released.",
        "Confirmed HbA1c within acceptable range for elective CABG.",
      ],
      documents: [
        { id: "angio", label: "Coronary Angiography Report", source: "Cardiology", status: "clean" },
        { id: "ecg", label: "ECG / Echo", source: "Cardiology", status: "clean" },
        { id: "cbc", label: "Pre-op Lab Panel", source: "Lab", status: "clean" },
      ],
    },
    preadmission: {
      narrative:
        "RCM submits initial GL request to Prudential via AdMedika TPA. PRU approves IDR 270M for elective CABG against Tier-3 policy.",
      agentActions: [
        "Verified PRU Tier-3 coverage: CABG eligible, sum insured IDR 500M.",
        "Submitted Initial Medical Report (LMA) to AdMedika.",
        "Initial GL approved · IDR 270M · valid through 2026-04-30.",
      ],
      documents: [
        { id: "lmn", label: "Letter of Medical Necessity", source: "Surgeon", status: "clean" },
        { id: "preop", label: "Pre-op Anesthesia Note", source: "Anaesthesiology", status: "clean" },
        { id: "preauth", label: "Initial GL Letter (PRU)", source: "AdMedika · approved", status: "clean" },
      ],
    },
    admission: {
      narrative:
        "Patient admitted to private cardiac surgical ward. Initial GL stands. RCM tracks accruals against authorised plan.",
      agentActions: [
        "Daily progress notes auto-attached from EMR.",
        "GL utilisation tracked at IDR 78M by day 2.",
      ],
      documents: [
        { id: "adm", label: "Admission Note", source: "Admitting Doctor (EMR)", status: "clean" },
        { id: "consent", label: "Surgical Consent Form", source: "Surgeon + Patient", status: "clean" },
        { id: "gl", label: "Initial GL Letter", source: "Prudential · AdMedika", status: "clean" },
      ],
    },
    surgery: {
      narrative:
        "Patient undergoes 4-vessel CABG. During grafting, surgeon identifies a critically stenosed 4th vessel (PDA) not visible on the pre-op angiogram and decides to graft an additional vessel. Theatre time +90 min, ICU +2 days expected.",
      agentActions: [
        "Detected scope expansion intra-op (LMA addendum required within 24h per PRU rule pru-proc-02).",
        "Auto-drafted GL top-up request for IDR 55M with intra-op finding note.",
        "GL top-up submitted to AdMedika · approved 2h26m later.",
      ],
      documents: [
        { id: "intraop", label: "Intraoperative Finding Note", source: "Dr. Wijaya, SpBTKV (signed in theatre)", status: "clean" },
        { id: "rce", label: "Revised Cost Estimate (+IDR 55M)", source: "Hospital Billing", status: "clean" },
        { id: "anaes", label: "Anaesthesia Chart", source: "Anaesthesia", status: "clean" },
      ],
      hasComplicationBanner: true,
    },
    postop: {
      narrative:
        "Patient transferred to ICU for 48 hours, then step-down. Recovery uneventful. RCM accrues billable events under amended GL (IDR 270M + 55M = 325M).",
      agentActions: [
        "ICU progress notes + MAR auto-attached.",
        "Variance against amended authorised days within +1d benchmark.",
      ],
      documents: [
        { id: "icunote", label: "ICU Daily Progress Notes", source: "ICU Doctor (EMR)", status: "clean" },
        { id: "mar", label: "Medication Administration Record", source: "Nursing (EMR)", status: "clean" },
        { id: "vitals", label: "Vitals Trend", source: "EMR (Auto)", status: "clean" },
      ],
    },
    discharge: {
      narrative:
        "Patient cleared for discharge day 9. RCM reconciles total bill IDR 322M vs amended GL IDR 315M; balance IDR 7M as patient co-pay. Final billing claim submitted to Prudential and settled 6 days later.",
      agentActions: [
        "Reconciled total bill IDR 322M vs amended GL IDR 315M.",
        "Submitted final claim to AdMedika with full documentation bundle.",
        "Final settlement IDR 315M received 2026-05-04.",
      ],
      documents: [
        { id: "ds", label: "Discharge Summary", source: "Dr. Wijaya, SpBTKV", status: "clean" },
        { id: "inv", label: "Final Itemised Invoice (IDR 322M)", source: "Billing", status: "clean" },
        { id: "rec", label: "Settlement Receipt (PRU IDR 315M)", source: "RCM", status: "clean" },
      ],
    },
  },

  // ── Siti · BPJS lap chole · clean cashless flow ────────────────────────
  "p-siti": {
    consultation: {
      narrative:
        "47F presents with recurrent biliary colic. USG abdomen: cholelithiasis with thickened GB wall. Surgical consult recommends laparoscopic cholecystectomy.",
      agentActions: [
        "Auto-pulled demographics from EMR.",
        "BPJS membership active · Class I entitlement confirmed.",
      ],
      documents: [
        { id: "rx", label: "General Surgery Consult Note", source: "Dr. Hapsari, SpB", status: "clean" },
        { id: "demo", label: "Patient Demographics", source: "EHR (Auto)", status: "clean" },
        { id: "ins", label: "BPJS membership card", source: "EHR (Auto)", status: "clean" },
      ],
    },
    diagnostics: {
      narrative:
        "USG abdomen confirms cholelithiasis. CBC, LFT WNL. Patient cleared for elective lap chole.",
      agentActions: [
        "Auto-attached USG and lab results.",
        "ICD-10 K80.20 + INA-CBG K-1-40-I matched.",
      ],
      documents: [
        { id: "angio", label: "USG Abdomen Report", source: "Radiology", status: "clean" },
        { id: "ecg", label: "Pre-op ECG", source: "Cardiology", status: "clean" },
        { id: "cbc", label: "Lab CBC + LFT", source: "Lab", status: "clean" },
      ],
    },
    preadmission: {
      narrative:
        "Patient cleared for admission. RCM team assembles BPJS pre-auth packet using payor-intelligence library defaults (no policy on file). Submission via VClaim REST API.",
      agentActions: [
        "Used payor-intelligence library — no patient policy doc on file (Mode B).",
        "Auto-built BPJS VClaim packet · SEP 2026-05-04-CDJ-00114.",
        "Initial GL submitted to BPJS via VClaim API · awaiting verification.",
      ],
      documents: [
        { id: "lmn", label: "Letter of Medical Necessity", source: "Surgeon", status: "clean" },
        { id: "preop", label: "Pre-op Anesthesia Note", source: "Anaesthesiology", status: "clean" },
        { id: "preauth", label: "BPJS VClaim Pre-auth Packet", source: "RCM (Auto)", status: "clean" },
      ],
    },
    admission: {
      narrative:
        "Patient awaiting admission for tomorrow. Admission packet ready; SEP printed and routed to ward.",
      agentActions: [
        "Awaiting BPJS GL acknowledgment.",
      ],
      documents: [
        { id: "adm", label: "Admission Note (planned)", source: "Admitting Doctor", status: "missing" },
        { id: "consent", label: "Surgical Consent Form", source: "Surgeon + Patient", status: "missing" },
        { id: "gl", label: "GL Letter (BPJS)", source: "BPJS · pending", status: "missing" },
      ],
    },
    surgery: {
      narrative:
        "Pending admission · scheduled lap chole next day.",
      agentActions: [],
      documents: [
        { id: "intraop", label: "Intraoperative Note (planned)", source: "Surgeon", status: "missing" },
        { id: "rce", label: "Cost Estimate (planned)", source: "Billing", status: "missing" },
        { id: "anaes", label: "Anaesthesia Chart (planned)", source: "Anaesthesia", status: "missing" },
      ],
      hasComplicationBanner: false,
    },
    postop: {
      narrative:
        "Pending surgery · post-op care to be tracked once admission begins.",
      agentActions: [],
      documents: [
        { id: "icunote", label: "Recovery Notes (planned)", source: "Nursing", status: "missing" },
        { id: "mar", label: "MAR (planned)", source: "Nursing", status: "missing" },
        { id: "vitals", label: "Vitals Trend (planned)", source: "EMR", status: "missing" },
      ],
    },
    discharge: {
      narrative:
        "Pending — discharge planning will start day 1 post-op.",
      agentActions: [],
      documents: [
        { id: "ds", label: "Discharge Summary (planned)", source: "Treating Doctor", status: "missing" },
        { id: "inv", label: "Final Invoice (planned)", source: "Billing", status: "missing" },
        { id: "rec", label: "Discharge Receipt (planned)", source: "RCM", status: "missing" },
      ],
    },
  },

  // ── Ravi · TKR · prorate appeal in flight ──────────────────────────────
  "p-ravi": {
    consultation: {
      narrative:
        "51M with OA bilateral knees grade IV (R worse) and controlled HTN. Failed conservative therapy 18 months. Plan: right TKR.",
      agentActions: [
        "Auto-pulled demographics from EMR.",
        "Linked AIA Premier H&S Tier-3 policy on file.",
      ],
      documents: [
        { id: "rx", label: "Orthopaedic Consult Note", source: "Dr. Eka Wibowo, SpOT", status: "clean" },
        { id: "demo", label: "Patient Demographics", source: "EHR (Auto)", status: "clean" },
        { id: "ins", label: "Insurance card · AIA", source: "EHR (Auto)", status: "clean" },
      ],
    },
    diagnostics: {
      narrative:
        "Pre-op workup: knee X-ray (Kellgren-Lawrence IV), CBC, ECG, INR. All cleared.",
      agentActions: [
        "Auto-attached imaging + lab results.",
        "Implant lot pre-confirmed with AIA-AdMedika TPA.",
      ],
      documents: [
        { id: "angio", label: "Knee X-ray (KL IV)", source: "Radiology", status: "clean" },
        { id: "ecg", label: "Pre-op ECG", source: "Cardiology", status: "clean" },
        { id: "cbc", label: "Lab Panel", source: "Lab", status: "clean" },
      ],
    },
    preadmission: {
      narrative:
        "Initial GL request sent to AIA via AdMedika TPA. AIA approves IDR 142.8M against Tier-3 cap.",
      agentActions: [
        "Verified AIA Tier-3: TKR eligible, room cap IDR 2.0M/day.",
        "Submitted LMA + implant lot to AdMedika.",
        "Initial GL approved IDR 142.8M.",
      ],
      documents: [
        { id: "lmn", label: "Letter of Medical Necessity", source: "Surgeon", status: "clean" },
        { id: "preop", label: "Pre-op Anesthesia Note", source: "Anaesthesiology", status: "clean" },
        { id: "preauth", label: "Initial GL Letter (AIA)", source: "AdMedika · approved", status: "clean" },
      ],
    },
    admission: {
      narrative:
        "Patient admitted to Deluxe room (IDR 3.2M/day) per surgeon's request citing post-op infection-risk profile (OA + comorbid HTN). Plan tier-3 cap is IDR 2.0M/day — booking exceeds plan.",
      agentActions: [
        "Plan tier verification at admission missed the room cap delta.",
        "Daily accruals tracked under amended utilisation.",
      ],
      documents: [
        { id: "adm", label: "Admission Note (Deluxe room)", source: "Admitting Doctor", status: "flagged" },
        { id: "consent", label: "Surgical Consent Form", source: "Surgeon + Patient", status: "clean" },
        { id: "gl", label: "Initial GL Letter", source: "AIA · AdMedika", status: "clean" },
      ],
    },
    surgery: {
      narrative:
        "Right TKR · Zimmer NexGen LPS · cemented · tourniquet 62 min · EBL 280mL · uneventful.",
      agentActions: [
        "Implant lot recorded · matches pre-auth.",
      ],
      documents: [
        { id: "intraop", label: "OT Report (TKR)", source: "Dr. Eka Wibowo, SpOT", status: "clean" },
        { id: "rce", label: "Cost Estimate", source: "Hospital Billing", status: "clean" },
        { id: "anaes", label: "Anaesthesia Chart", source: "Anaesthesia", status: "clean" },
      ],
      hasComplicationBanner: false,
    },
    postop: {
      narrative:
        "Stable post-op recovery in Deluxe room. PT initiated day 1, ROM 0-95° by day 5.",
      agentActions: [
        "ICU not required · stepped down to ward.",
        "PT progress notes auto-attached.",
      ],
      documents: [
        { id: "icunote", label: "Daily Progress Notes", source: "Ortho ward (EMR)", status: "clean" },
        { id: "mar", label: "MAR", source: "Nursing (EMR)", status: "clean" },
        { id: "vitals", label: "Vitals Trend", source: "EMR (Auto)", status: "clean" },
      ],
    },
    discharge: {
      narrative:
        "Patient cleared for discharge after 5 days. Final billing submitted at IDR 178.5M (claim IDR 142.8M after Tier-3 mapping). AIA partial-pays IDR 89.25M — prorate ratio 0.625 applied because Deluxe room exceeded plan cap. Agent drafts appeal citing post-op infection-risk medical necessity (Mayapada SOP §4.7).",
      agentActions: [
        "Reconciled total bill IDR 178.5M.",
        "AIA returned partial settlement IDR 89.25M with CON-04 prorate.",
        "Drafted appeal letter (medical necessity for higher room class) — pending submission.",
      ],
      documents: [
        { id: "ds", label: "Discharge Summary", source: "Dr. Eka Wibowo, SpOT", status: "clean" },
        { id: "inv", label: "Final Invoice (IDR 178.5M)", source: "Billing", status: "clean" },
        { id: "rec", label: "Plan tier verification", source: "RCM", status: "flagged" },
      ],
    },
  },
};

function buildPatientStages(patientId: string, activeStage: StageKey): StageContent[] {
  const overrides = PATIENT_OVERRIDES[patientId];
  const activeIdx = STAGES.findIndex((s) => s.key === activeStage);
  return STAGES.map((s, idx) => {
    const ov = overrides?.[s.key];
    const baseStub = STUB_STAGES[s.key];
    const stubDocs = STUB_DOCS[s.key];
    const isPast = idx < activeIdx;
    const isActive = idx === activeIdx;
    const fallbackDocs = stubDocs.map((d, i) => {
      let status: DocStatus;
      if (isPast) status = "clean";
      else if (isActive) status = i < 2 ? "clean" : "missing";
      else status = "missing";
      return { ...d, status };
    });
    return {
      stage: s.key,
      narrative: ov?.narrative ?? baseStub.narrative,
      agentActions: ov?.agentActions ?? baseStub.agentActions,
      documents: ov?.documents ?? fallbackDocs,
      hasComplicationBanner:
        ov?.hasComplicationBanner ?? baseStub.hasComplicationBanner ?? false,
    };
  });
}

export function StagesPanel({
  activeStage,
  payorId,
  patientId,
}: {
  activeStage: StageKey;
  payorId: string | null;
  patientId?: string | null;
}) {
  const hasOverride = patientId && PATIENT_OVERRIDES[patientId];
  const stages = hasOverride
    ? buildPatientStages(patientId!, activeStage)
    : buildStubStages(activeStage);
  return (
    <div className="flex flex-col gap-3">
      {stages.map((content) => (
        <StageSection
          key={content.stage}
          content={content}
          activeStage={activeStage}
          payorId={payorId}
          patientId={patientId ?? null}
        />
      ))}
    </div>
  );
}
