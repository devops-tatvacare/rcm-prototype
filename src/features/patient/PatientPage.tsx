import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { TopBar } from "@/components/layout/TopBar";
import { Panel } from "@/components/ui/Panel";
import { query } from "@/lib/db";
import { PatientHeader } from "./PatientHeader";
import { JourneyTimeline, deriveActiveStage, type StageKey } from "./JourneyTimeline";

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
  agent_step: string | null;
  source: string | null;
  hospital_id: string;
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

export function PatientPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [claim, setClaim] = useState<ClaimContextRow | null>(null);
  const [inpatient, setInpatient] = useState<InpatientContextRow | null>(null);
  const [hospital, setHospital] = useState<HospitalRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [pRows, cRows, ipRows] = await Promise.all([
        query<PatientRow>(
          `SELECT p.*, py.name AS payor_name, py.color AS payor_color, py.kind AS payor_kind
             FROM patients p
             LEFT JOIN payors py ON py.id = p.payor_id
            WHERE p.id = ?`,
          [id],
        ),
        query<ClaimContextRow>(
          `SELECT id, drg, dx, gross_idr, expected_reimb_idr, stage, agent_step, source, hospital_id
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
      ]);
      if (cancelled) return;
      const p = pRows[0] ?? null;
      const c = cRows[0] ?? null;
      const ip = ipRows[0] ?? null;
      setPatient(p);
      setClaim(c);
      setInpatient(ip);
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
            onBack={() => navigate("/worklist")}
          />
        </div>

        {/* THREE-COLUMN GRID */}
        <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr_320px] gap-3 p-4 pt-3">
          {/* LEFT RAIL */}
          <aside className="sticky top-3 self-start">
            <JourneyTimeline activeStage={activeStage} />
          </aside>

          {/* MAIN — placeholder for P3.2 */}
          <section className="min-w-0 overflow-auto">
            <PlaceholderPanel
              eyebrow="Main"
              title="Stage sections — P3.2"
              hint="Consultation → Discharge sections, packet rows, and insurer correspondence land here in the next phase."
              tall
            />
          </section>

          {/* RIGHT RAIL — placeholder for P3.3 */}
          <aside className="sticky top-3 self-start">
            <PlaceholderPanel
              eyebrow="Right rail"
              title="Packet readiness — P3.3"
              hint="Per-document readiness, insurer-required checklist, and primary-action surface arrive in P3.3."
            />
          </aside>
        </div>
      </motion.div>
    </>
  );
}

function PlaceholderPanel({
  eyebrow,
  title,
  hint,
  tall = false,
}: {
  eyebrow: string;
  title: string;
  hint: string;
  tall?: boolean;
}) {
  return (
    <div
      className={
        "flex flex-col gap-2 rounded-xl border border-dashed border-[var(--color-line-soft)] bg-[var(--color-canvas-deep)]/40 px-4 py-4 " +
        (tall ? "min-h-[420px]" : "min-h-[180px]")
      }
    >
      <span className="eyebrow">{eyebrow}</span>
      <span className="font-display text-[15px] tracking-tight text-ink-soft">{title}</span>
      <span className="font-mono-tight text-[11px] leading-relaxed text-ink-faint">{hint}</span>
    </div>
  );
}
