import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { TopBar } from "@/components/layout/TopBar";
import { Panel } from "@/components/ui/Panel";
import { cn } from "@/lib/cn";
import { query } from "@/lib/db";
import { PatientHeader } from "./PatientHeader";
import { JourneyTimeline, STAGES, deriveActiveStage, type StageKey } from "./JourneyTimeline";
import { StagesPanel } from "./StagesPanel";
import { PacketRail } from "./PacketRail";

export type PatientRow = {
  id: string;
  mrn: string;
  name: string;
  age: number;
  sex: string;
  national_id: string | null;
  policy_number: string | null;
  payor_id: string;
  ward_class: string | null;
  pre_existing_conditions: string | null;
  payor_name: string | null;
  payor_color: string | null;
  payor_kind: string | null;
};

export type ClaimContextRow = {
  id: string;
  drg: string;
  dx: string;
  gross_idr: number;
  expected_reimb_idr: number;
  stage: string;
   acceptance_score: number;
  agent_step: string | null;
  source: string | null;
  hospital_id: string;
};

type DenialContextRow = {
  id: string;
  appeal_status: string | null;
};

export type InpatientContextRow = {
  id: string;
  drg: string;
  dx: string;
  day_of_stay: number;
  authorized_days: number;
  hospital_id: string;
};

export type HospitalRow = {
  id: string;
  name: string;
  city: string;
};

export type GlSubmissionRow = {
  id: string;
  kind: "initial" | "topup" | "final";
  state: "not_started" | "drafting" | "submitted" | "approved" | "rejected" | "partial";
};

type PatientViewTab = "action" | "journey";

function stageLabel(stage: StageKey): string {
  return STAGES.find((item) => item.key === stage)?.label ?? "Pre-admission";
}

function packetLabel(stage: StageKey): string {
  if (stage === "consultation" || stage === "diagnostics" || stage === "preadmission") return "Initial GL";
  if (stage === "admission" || stage === "surgery") return "Top-up";
  return "Final claim";
}

export function PatientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [claim, setClaim] = useState<ClaimContextRow | null>(null);
  const [denial, setDenial] = useState<DenialContextRow | null>(null);
  const [inpatient, setInpatient] = useState<InpatientContextRow | null>(null);
  const [hospital, setHospital] = useState<HospitalRow | null>(null);
  const [glSubmissions, setGlSubmissions] = useState<GlSubmissionRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<PatientViewTab>("action");
  const pendingStageJump = useRef<StageKey | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [pRows, cRows, ipRows, glRows, denialRows] = await Promise.all([
        query<PatientRow>(
          `SELECT p.*, py.name AS payor_name, py.color AS payor_color, py.kind AS payor_kind
             FROM patients p
             LEFT JOIN payors py ON py.id = p.payor_id
            WHERE p.id = ?`,
          [id],
        ),
        query<ClaimContextRow>(
          `SELECT id, drg, dx, gross_idr, expected_reimb_idr, stage, acceptance_score, agent_step, source, hospital_id
             FROM claims
             WHERE patient_id = ?
             ORDER BY rowid DESC
             LIMIT 1`,
          [id],
        ),
        query<InpatientContextRow>(
          `SELECT id, drg, dx, day_of_stay, authorized_days, hospital_id
             FROM inpatients
            WHERE patient_id = ?
            LIMIT 1`,
          [id],
        ),
        query<GlSubmissionRow>(
          `SELECT id, kind, state
             FROM gl_submissions
            WHERE patient_id = ?
            ORDER BY CASE kind
                       WHEN 'initial' THEN 1
                       WHEN 'topup'   THEN 2
                       WHEN 'final'   THEN 3
                       ELSE 4
                     END`,
          [id],
        ),
        query<DenialContextRow>(
          `SELECT d.id, d.appeal_status
             FROM denials d
             JOIN claims c ON c.id = d.claim_id
            WHERE c.patient_id = ?
            ORDER BY d.denied_at DESC
            LIMIT 1`,
          [id],
        ),
      ]);
      if (cancelled) return;
      const p = pRows[0] ?? null;
      const c = cRows[0] ?? null;
      const ip = ipRows[0] ?? null;
      setPatient(p);
      setClaim(c);
      setInpatient(ip);
      setGlSubmissions(glRows ?? []);
      setDenial(denialRows[0] ?? null);
      const hospitalId = c?.hospital_id ?? ip?.hospital_id ?? null;
      if (hospitalId) {
        const hRows = await query<HospitalRow>(
          `SELECT id, name, city FROM hospitals WHERE id = ?`,
          [hospitalId],
        );
        if (!cancelled) setHospital(hRows[0] ?? null);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const activeStage = useMemo<StageKey>(
    () => deriveActiveStage(claim?.stage ?? null, inpatient?.day_of_stay ?? null),
    [claim?.stage, inpatient?.day_of_stay],
  );
  function jumpToStage(stage: StageKey) {
    const el = document.getElementById(`stage-${stage}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleBack() {
    const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
    navigate(returnTo ?? "/worklist");
  }

  function openJourney(stage: StageKey) {
    pendingStageJump.current = stage;
    setActiveTab("journey");
  }

  useEffect(() => {
    if (activeTab !== "journey" || !pendingStageJump.current) return;
    const stage = pendingStageJump.current;
    pendingStageJump.current = null;
    const raf = window.requestAnimationFrame(() => jumpToStage(stage));
    return () => window.cancelAnimationFrame(raf);
  }, [activeTab]);

  if (!loaded) {
    return (
      <>
        <TopBar title="Patient" breadcrumb="Worklist" />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="font-mono-tight text-[11px] text-ink-faint">Loading patient…</div>
        </div>
      </>
    );
  }

  if (!patient) {
    return (
      <>
        <TopBar title="Patient" breadcrumb="Worklist" />
        <div className="flex flex-1 items-center justify-center p-8">
          <Panel tone="raised" className="px-6 py-5">
            <div className="eyebrow">Not found</div>
            <div className="mt-1 font-display text-[16px] text-ink">Patient not found</div>
            <div className="mt-1 font-mono-tight text-[11px] text-ink-faint">
              No record exists for id <span className="text-ink-mute">{id}</span>.
            </div>
            <Link
              to="/worklist"
              className="mt-3 inline-block font-mono-tight text-[11px] text-[var(--color-azure)] hover:underline"
            >
              ← Back to worklist
            </Link>
          </Panel>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title={patient.name} breadcrumb="Worklist · Patient" />
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* HEADER STRIP */}
        <div className="px-4 pt-4">
          <PatientHeader
            patient={patient}
            claim={claim}
            inpatient={inpatient}
            hospital={hospital}
            glSubmissions={glSubmissions}
            hasActiveDenial={Boolean(denial)}
            onBack={handleBack}
          />
        </div>

        <div className="px-4 pt-3">
          <div
            role="tablist"
            aria-label="Patient view"
            className="inline-flex rounded-full border border-line-soft bg-panel p-1 shadow-quiet"
          >
            <div className="flex items-center gap-1">
              <PatientViewTabButton
                id="patient-tab-action"
                active={activeTab === "action"}
                label="Action"
                panelId="patient-panel-action"
                onClick={() => setActiveTab("action")}
              />
              <PatientViewTabButton
                id="patient-tab-journey"
                active={activeTab === "journey"}
                label="Journey"
                panelId="patient-panel-journey"
                onClick={() => openJourney(activeStage)}
              />
            </div>
          </div>
        </div>

        {activeTab === "action" ? (
          <div
            id="patient-panel-action"
            role="tabpanel"
            aria-labelledby="patient-tab-action"
            className="min-h-0 flex-1 overflow-y-auto p-4 pt-3"
          >
            <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SnapshotRow label="Current stage" value={stageLabel(activeStage)} />
                <SnapshotRow label="Current packet" value={packetLabel(activeStage)} />
                <SnapshotRow label="Payor" value={patient.payor_name ?? patient.payor_id ?? "—"} />
                <SnapshotRow
                  label="Hospital"
                  value={hospital ? `${hospital.name} · ${hospital.city}` : "Hospital context loading"}
                />
              </div>
              <div className="min-w-0">
                <PacketRail
                  patientId={patient.id}
                  payorId={patient.payor_id ?? null}
                  activeStage={activeStage}
                  claim={claim}
                  glSubmissions={glSubmissions}
                  hasActiveDenial={Boolean(denial)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            id="patient-panel-journey"
            role="tabpanel"
            aria-labelledby="patient-tab-journey"
            className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 pt-3 xl:grid-cols-[260px_minmax(0,1fr)]"
          >
            <aside className="sticky top-0 self-start">
              <JourneyTimeline activeStage={activeStage} onSelectStage={jumpToStage} />
            </aside>

            <section className="min-w-0">
              <div className="mx-auto w-full max-w-[980px]">
                <StagesPanel
                  activeStage={activeStage}
                  payorId={patient.payor_id ?? null}
                  patientId={patient.id}
                />
              </div>
            </section>
          </div>
        )}
      </motion.div>
    </>
  );
}

function PatientViewTabButton({
  id,
  active,
  label,
  panelId,
  onClick,
}: {
  id: string;
  active: boolean;
  label: string;
  panelId: string;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 font-mono-tight text-[11px] uppercase tracking-[0.12em] transition-colors",
        active
          ? "bg-[var(--color-champagne)] text-[var(--color-canvas-deep)]"
          : "text-ink-faint hover:bg-[var(--color-panel-2)]/45 hover:text-ink-soft",
      )}
    >
      {label}
    </button>
  );
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line-soft bg-[var(--color-panel-2)]/24 px-3 py-2.5">
      <div className="font-mono-tight text-[10px] uppercase tracking-[0.12em] text-ink-faint">{label}</div>
      <div className="mt-1 text-[12.5px] leading-snug text-ink-soft">{value}</div>
    </div>
  );
}
