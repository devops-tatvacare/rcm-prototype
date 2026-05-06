import { STAGES, type StageKey } from "./JourneyTimeline";
import { StageSection, type StageContent } from "./StageSection";

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

export function StagesPanel({
  activeStage,
  payorId,
}: {
  activeStage: StageKey;
  payorId: string | null;
}) {
  const stages = buildStubStages(activeStage);
  return (
    <div className="flex flex-col gap-3">
      {stages.map((content) => (
        <StageSection
          key={content.stage}
          content={content}
          activeStage={activeStage}
          payorId={payorId}
        />
      ))}
    </div>
  );
}
