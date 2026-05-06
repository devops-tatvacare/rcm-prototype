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
  // ── Budi · BPJS cardiac surgery · GL top-up flow ───────────────────────
  "p-budi": {
    consultation: {
      narrative:
        "58M with HTN (10y), T2DM (controlled), and dyslipidaemia presents to cardiothoracic surgery with CCS class III angina. Coronary angiogram shows triple-vessel disease 80%/75%/70%. Plan: elective CABG.",
      agentActions: [
        "Auto-pulled demographics and BPJS card from EMR.",
        "Linked patient to the BPJS cardiac-benefit policy PDF already on file.",
      ],
      documents: [
        { id: "rx", label: "Cardiothoracic Consult Note", source: "Dr. Wijaya, SpBTKV", status: "clean" },
        { id: "demo", label: "Patient Demographics", source: "EHR (Auto)", status: "clean" },
        { id: "ins", label: "Insurance card · BPJS", source: "EHR (Auto)", status: "clean" },
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
        "RCM submits the initial BPJS cardiac-surgery packet. Initial approval lands at IDR 270M for the planned CABG.",
      agentActions: [
        "Verified BPJS cardiac-surgery benefits from the policy PDF on file.",
        "Submitted initial medical necessity pack with angiography evidence.",
        "Initial GL approved · IDR 270M · valid through 2026-04-30.",
      ],
      documents: [
        { id: "lmn", label: "Letter of Medical Necessity", source: "Surgeon", status: "clean" },
        { id: "preop", label: "Pre-op Anesthesia Note", source: "Anaesthesiology", status: "clean" },
        { id: "preauth", label: "Initial GL Letter (BPJS)", source: "BPJS reviewer · approved", status: "clean" },
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
        { id: "gl", label: "Initial GL Letter", source: "BPJS", status: "clean" },
      ],
    },
    surgery: {
      narrative:
        "Patient undergoes 4-vessel CABG. During grafting, surgeon identifies a critically stenosed 4th vessel (PDA) not visible on the pre-op angiogram and decides to graft an additional vessel. Theatre time +90 min, ICU +2 days expected.",
      agentActions: [
        "Detected scope expansion intra-op and prepared the top-up addendum immediately.",
        "Auto-drafted GL top-up request for IDR 55M with the intra-op finding note.",
        "GL top-up submitted and approved 2h26m later.",
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
        "Patient cleared for discharge day 9. RCM reconciles total bill IDR 322M vs amended GL IDR 315M; balance IDR 7M as patient co-pay. Final billing claim is submitted and settled 6 days later.",
      agentActions: [
        "Reconciled total bill IDR 322M vs amended GL IDR 315M.",
        "Submitted final claim with the full discharge documentation bundle.",
        "Final settlement IDR 315M received 2026-05-04.",
      ],
      documents: [
        { id: "ds", label: "Discharge Summary", source: "Dr. Wijaya, SpBTKV", status: "clean" },
        { id: "inv", label: "Final Itemised Invoice (IDR 322M)", source: "Billing", status: "clean" },
        { id: "rec", label: "Settlement Receipt (BPJS IDR 315M)", source: "RCM", status: "clean" },
      ],
    },
  },

  // ── Siti · BPJS C-section pre-auth review ──────────────────────────────
  "p-siti": {
    consultation: {
      narrative:
        "34F, breech presentation at term with prior C-section scar. Obstetric review recommends planned repeat C-section with 48-hour pre-auth turnaround.",
      agentActions: [
        "Auto-pulled demographics from EMR.",
        "BPJS membership active · obstetric benefits already uploaded for rule extraction.",
      ],
      documents: [
        { id: "rx", label: "OB-GYN Consult Note", source: "Dr. Ratna Dewi, SpOG", status: "clean" },
        { id: "demo", label: "Patient Demographics", source: "EHR (Auto)", status: "clean" },
        { id: "ins", label: "BPJS membership card", source: "EHR (Auto)", status: "clean" },
      ],
    },
    diagnostics: {
      narrative:
        "Obstetric ultrasound confirms breech presentation with reassuring fetal heart tracing. CBC and anaesthesia clearance are complete for the planned C-section.",
      agentActions: [
        "Auto-attached ultrasound, CTG, and antenatal labs.",
        "Matched the BPJS obstetric packet to the planned C-section episode.",
      ],
      documents: [
        { id: "angio", label: "Obstetric Ultrasound Report", source: "Radiology", status: "clean" },
        { id: "ecg", label: "CTG / fetal monitoring strip", source: "Labour ward", status: "clean" },
        { id: "cbc", label: "CBC + pre-op anaesthesia clearance", source: "Lab", status: "clean" },
      ],
    },
    preadmission: {
      narrative:
        "RCM submits the C-section pre-auth packet using the patient-specific BPJS obstetric policy already on file. Review is in progress inside the 48-hour window.",
      agentActions: [
        "Extracted obstetric rules from the uploaded BPJS policy PDF.",
        "Auto-built the C-section packet with breech evidence and prior-scar history.",
        "Initial GL submitted to BPJS · awaiting review.",
      ],
      documents: [
        { id: "lmn", label: "OB medical necessity letter", source: "Dr. Ratna Dewi, SpOG", status: "clean" },
        { id: "preop", label: "Pre-op Anaesthesia Note", source: "Anaesthesiology", status: "clean" },
        { id: "preauth", label: "BPJS C-section Pre-auth Packet", source: "RCM (Auto)", status: "clean" },
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
        "Pending admission · scheduled repeat C-section once approval lands.",
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

  // ── Ravi · PCI · prorate appeal in flight ──────────────────────────────
  "p-ravi": {
    consultation: {
      narrative:
        "51M with exertional chest pain and unstable angina. Cardiology recommends PCI after angiography shows a critical LAD lesion with diagonal involvement.",
      agentActions: [
        "Auto-pulled demographics from EMR.",
        "No patient-specific AIA policy PDF on file — rail uses learned payor rules.",
      ],
      documents: [
        { id: "rx", label: "Cardiology Consult Note", source: "Dr. Albert Santoso, SpJP", status: "clean" },
        { id: "demo", label: "Patient Demographics", source: "EHR (Auto)", status: "clean" },
        { id: "ins", label: "Insurance card · AIA", source: "EHR (Auto)", status: "clean" },
      ],
    },
    diagnostics: {
      narrative:
        "Diagnostic workup includes ECG, troponin trend, echo, and coronary angiography. Findings support PCI and same-admission intervention.",
      agentActions: [
        "Auto-attached angiography images, troponin trend, and echo.",
        "Matched the episode to the AIA PCI submission template from prior cases.",
      ],
      documents: [
        { id: "angio", label: "Coronary Angiography Report", source: "Cath lab", status: "clean" },
        { id: "ecg", label: "ECG / Echo", source: "Cardiology", status: "clean" },
        { id: "cbc", label: "Troponin + coagulation panel", source: "Lab", status: "clean" },
      ],
    },
    preadmission: {
      narrative:
        "Initial GL request sent to AIA for PCI. Approval lands at IDR 142.8M using the hospital's learned AIA rule set because no policy is on file.",
      agentActions: [
        "Verified historical AIA requirements for PCI packets and room-cap constraints.",
        "Submitted clinical summary, angiography report, and planned stent details.",
        "Initial GL approved IDR 142.8M.",
      ],
      documents: [
        { id: "lmn", label: "Cardiology medical necessity letter", source: "Dr. Albert Santoso, SpJP", status: "clean" },
        { id: "preop", label: "Pre-op Anesthesia Note", source: "Anaesthesiology", status: "clean" },
        { id: "preauth", label: "Initial GL Letter (AIA)", source: "AIA reviewer · approved", status: "clean" },
      ],
    },
    admission: {
      narrative:
        "Patient is admitted to a premium monitored cardiac room at IDR 3.2M/day. The AIA plan cap is IDR 2.0M/day, so the room choice creates exposure despite the approved PCI GL.",
      agentActions: [
        "Room-cap variance was detected after admission rather than before booking.",
        "Daily telemetry and monitored-room charges were tracked against the approved case.",
      ],
      documents: [
        { id: "adm", label: "Admission Note (monitored cardiac room)", source: "Admitting Doctor", status: "flagged" },
        { id: "consent", label: "Surgical Consent Form", source: "Surgeon + Patient", status: "clean" },
        { id: "gl", label: "Initial GL Letter", source: "AIA approval desk", status: "clean" },
      ],
    },
    surgery: {
      narrative:
        "PCI completed with drug-eluting stent placement to the LAD. Procedure is technically successful and haemodynamics remain stable throughout.",
      agentActions: [
        "Cath-lab report and implant sticker sheet were captured for the final packet.",
      ],
      documents: [
        { id: "intraop", label: "Cath-lab Procedure Report", source: "Dr. Albert Santoso, SpJP", status: "clean" },
        { id: "rce", label: "Cost Estimate", source: "Hospital Billing", status: "clean" },
        { id: "anaes", label: "Anaesthesia Chart", source: "Anaesthesia", status: "clean" },
      ],
      hasComplicationBanner: false,
    },
    postop: {
      narrative:
        "Recovery is stable in the monitored cardiac room. Telemetry, antiplatelet initiation, and post-PCI observation continue without complications.",
      agentActions: [
        "Telemetry notes and medication administration records auto-attached.",
        "No top-up requested despite the premium room variance.",
      ],
      documents: [
        { id: "icunote", label: "Cardiology Progress Notes", source: "Cardiac ward (EMR)", status: "clean" },
        { id: "mar", label: "MAR", source: "Nursing (EMR)", status: "clean" },
        { id: "vitals", label: "Vitals Trend", source: "EMR (Auto)", status: "clean" },
      ],
    },
    discharge: {
      narrative:
        "Patient is discharged after PCI recovery. Final billing is submitted at IDR 178.5M against the approved IDR 142.8M case. AIA returns a partial settlement of IDR 89.25M after applying a 0.625 prorate tied to the premium monitored-room overage. The agent drafts the appeal instead of accepting the haircut.",
      agentActions: [
        "Reconciled total bill IDR 178.5M.",
        "AIA returned partial settlement IDR 89.25M with CON-04 prorate.",
        "Drafted the appeal letter and lined up the medical-necessity attachments for submission.",
      ],
      documents: [
        { id: "ds", label: "Discharge Summary", source: "Dr. Albert Santoso, SpJP", status: "clean" },
        { id: "inv", label: "Final Invoice (IDR 178.5M)", source: "Billing", status: "clean" },
        { id: "rec", label: "Appeal evidence pack", source: "RCM", status: "flagged" },
      ],
    },
  },
  p43: {
    consultation: {
      narrative:
        "42F referred from an outside OB-GYN clinic for symptomatic fibroid uterus and prolonged bleeding. The hospital has only sparse demographics in EMR; the referral packet is arriving as scans.",
      agentActions: [
        "Created a new case shell from referral metadata only.",
        "Waiting for uploaded clinical evidence before the pre-auth packet can be completed.",
      ],
      documents: [
        { id: "rx", label: "Outside-clinic referral note", source: "Klinik Harapan Ibu", status: "missing" },
        { id: "demo", label: "Patient demographics", source: "Registration", status: "clean" },
        { id: "ins", label: "Insurance member card", source: "Patient", status: "missing" },
      ],
    },
    diagnostics: {
      narrative:
        "MRI pelvis, CBC, and anaesthesia readiness are not integrated into the hospital EMR. The agent must extract them from uploaded scans before it can defend the surgery request.",
      agentActions: [
        "Watching for uploaded MRI, lab panel, and anaesthesia support documents.",
        "Will code ICD / DRG and rematch insurer rules as each file lands.",
      ],
      documents: [
        { id: "angio", label: "Pelvic MRI", source: "Outside radiology", status: "missing" },
        { id: "ecg", label: "Anaesthesia clearance", source: "Outside anaesthesia", status: "missing" },
        { id: "cbc", label: "CBC + chemistry", source: "Outside lab", status: "missing" },
      ],
    },
    preadmission: {
      narrative:
        "The pre-auth packet is being assembled manually from uploaded scans. This is the showcase case for sparse or non-integrated EMR data: upload each artifact, extract evidence, match insurer rules, then submit once the packet is complete.",
      agentActions: [
        "Packet remains in build until referral, MRI, lab results, and anaesthesia clearance are uploaded.",
        "Policy upload is optional — if present, rules switch from learned patterns to policy-derived clauses.",
        "Submission fires once the extracted evidence clears the checklist.",
      ],
      documents: [
        { id: "lmn", label: "Medical necessity letter", source: "Treating surgeon", status: "missing" },
        { id: "preop", label: "Pre-op anaesthesia note", source: "Outside anaesthesia", status: "missing" },
        { id: "preauth", label: "Cashless pre-auth form", source: "RCM packet builder", status: "missing" },
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
