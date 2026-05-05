import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, FileImage, FlaskConical, ScrollText, Receipt,
  Upload, ChevronDown, CheckCircle2, Loader2, Play, Layers, ArrowRight, X,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { exec, query } from "@/lib/db";

type Doc = {
  id: string;
  owner_kind: string;
  owner_id: string;
  patient_id: string;
  kind: string;
  filename: string;
  source_clinic: string | null;
  uploaded_by: string;
  uploaded_at: string;
  pages: number;
  ocr_excerpt: string;
  extracted_icd: string | null;
  extracted_cpt: string | null;
  extracted_drg: string | null;
  status: string;
  sort: number;
};

const KIND_ICON: Record<string, typeof FileText> = {
  handwritten_referral: ScrollText, ed_note: ScrollText, handwritten_progress: ScrollText,
  handwritten_anesthesia: ScrollText, discharge_summary: ScrollText, op_report: FileText,
  pathology: FlaskConical, lab_result: FlaskConical, imaging: FileImage, invoice: Receipt,
  consult_note: ScrollText, echo_report: FileText, abg: FlaskConical, culture: FlaskConical,
};
const KIND_LABEL: Record<string, string> = {
  handwritten_referral: "Handwritten GP referral", ed_note: "ED admission note",
  handwritten_progress: "Daily progress notes", handwritten_anesthesia: "Anaesthesia record",
  discharge_summary: "Discharge summary", op_report: "Operative report",
  pathology: "Pathology report", lab_result: "Lab result", imaging: "Imaging",
  invoice: "Final invoice", consult_note: "Consult note", echo_report: "Echo report",
  abg: "ABG result", culture: "Culture result",
};

const STATUS_META: Record<string, { label: string; tone: "neutral" | "info" | "champagne" | "good"; }> = {
  uploaded:         { label: "Uploaded",      tone: "neutral" },
  ocr_running:      { label: "OCR running",   tone: "info" },
  ocr_done:         { label: "OCR done",      tone: "champagne" },
  coded:            { label: "Coded",         tone: "champagne" },
  handed_to_packet: { label: "Packet",        tone: "good" },
};

const STEPS = ["uploaded", "ocr_running", "ocr_done", "coded", "handed_to_packet"] as const;
const STEP_LABEL: Record<string, string> = {
  uploaded: "Upload", ocr_running: "Extract", ocr_done: "OCR", coded: "Code", handed_to_packet: "Packet",
};
const STATUS_RANK: Record<string, number> = {
  uploaded: 1, ocr_running: 2, ocr_done: 3, coded: 4, handed_to_packet: 5,
};

type Pickable = { kind: string; filename: string; pages: number; source_clinic: string; ocr_excerpt: string; extracted_icd: string | null; extracted_cpt: string | null; extracted_drg: string | null };

const PICKABLE_BY_OWNER: Record<string, Pickable[]> = {
  "claim:c43": [
    { kind: "handwritten_referral", filename: "GP_referral_KlinikMitraSehat.jpg", pages: 1, source_clinic: "Klinik Mitra Sehat · Bekasi", ocr_excerpt: "Rujukan: Tn. Ravi S., 58thn. Demam 5hari, batuk produktif, sesak. SpO2 91% udara ruangan. Diduga pneumonia berat. Mohon rawat inap.", extracted_icd: "J18.9", extracted_cpt: null, extracted_drg: null },
    { kind: "ed_note", filename: "ED_admission_note_handwritten.pdf", pages: 2, source_clinic: "Cendana Jakarta · IGD", ocr_excerpt: "Riw. DM tipe 2. TD 92/58, HR 118, RR 28, Temp 39.1°C. Lactate 4.2. Severe CAP with septic shock. Resusitasi + meropenem empirik dimulai.", extracted_icd: "A41.9", extracted_cpt: null, extracted_drg: "PRIV-MEDS-SEPSIS-S" },
    { kind: "lab_result", filename: "CBC_blood_culture_day1.pdf", pages: 1, source_clinic: "Cendana Jakarta · Lab", ocr_excerpt: "WBC 22.4 (H), Neut 89%, CRP 168, Procalcitonin 8.4. Blood culture: pending.", extracted_icd: null, extracted_cpt: "85027,86703", extracted_drg: null },
    { kind: "imaging", filename: "CXR_admission.jpg", pages: 1, source_clinic: "Cendana Jakarta · Radiology", ocr_excerpt: "PA chest film: bilateral lower-lobe consolidation, R > L. No effusion. Findings consistent with severe CAP.", extracted_icd: null, extracted_cpt: "71046", extracted_drg: null },
  ],
  "inpatient:ip15": [
    { kind: "culture", filename: "blood_culture_sensitivity_day4.pdf", pages: 1, source_clinic: "Cendana Jakarta · Microbiology", ocr_excerpt: "Day 4 blood culture: Klebsiella pneumoniae. ESBL-neg. Sensitive: meropenem, cefepime. Resistant: ampicillin, ciprofloxacin.", extracted_icd: "A41.9", extracted_cpt: "87040,87186", extracted_drg: null },
    { kind: "handwritten_progress", filename: "progress_notes_day3-6_DrIqbal.pdf", pages: 4, source_clinic: "Cendana Jakarta · Ward 4B", ocr_excerpt: "D3: demam 38.7, lactate 2.8. D4: kultur Klebsiella+, switch meropenem 1g/8h. D5: afebrile 16:00. D6: SpO2 93/3LPM, WBC turun.", extracted_icd: null, extracted_cpt: null, extracted_drg: null },
    { kind: "lab_result", filename: "PCT_lactate_trend_day1-6.pdf", pages: 1, source_clinic: "Cendana Jakarta · Lab", ocr_excerpt: "PCT: 8.4 → 6.1 → 3.8 → 2.4 → 2.1 ng/mL (d1→d6). Lactate cleared d3 (4.2 → 1.6).", extracted_icd: null, extracted_cpt: "84145,83605", extracted_drg: null },
  ],
};

const HANDOFF_THRESHOLD = 1;

export function UploadedDocsPanel({
  ownerKind, ownerId, onRunAgent,
}: {
  ownerKind: "claim" | "inpatient";
  ownerId: string;
  patientName?: string;
  onRunAgent?: () => void;
}) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [animStatus, setAnimStatus] = useState<string>("uploaded");
  const [handedOff, setHandedOff] = useState(false);
  const timeouts = useRef<number[]>([]);

  async function refetch() {
    const rows = await query<Doc>(
      `SELECT * FROM uploaded_docs WHERE owner_kind = ? AND owner_id = ? ORDER BY sort ASC`,
      [ownerKind, ownerId],
    );
    setDocs(rows);
  }

  useEffect(() => {
    refetch();
    return () => { timeouts.current.forEach(clearTimeout); timeouts.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKind, ownerId]);

  const ownerKey = `${ownerKind}:${ownerId}`;
  const allPickable = PICKABLE_BY_OWNER[ownerKey] ?? [];
  const usedKinds = useMemo(() => new Set(docs?.map((d) => d.kind) ?? []), [docs]);
  const pickable = allPickable.filter((p) => !usedKinds.has(p.kind));

  if (!docs) return null;
  // Hide entirely if no pre-populated docs AND no upload paths defined for this owner
  if (docs.length === 0 && allPickable.length === 0) return null;

  const codedCount = docs.filter((d) => STATUS_RANK[d.status] >= 4).length;
  const maxRank = docs.length === 0 ? 0 : Math.max(...docs.map((d) => STATUS_RANK[d.status] ?? 0));
  const isEmpty = docs.length === 0;
  const readyForHandoff = codedCount >= HANDOFF_THRESHOLD && !handedOff && maxRank < 5;
  const allHandedOff = docs.length > 0 && docs.every((d) => d.status === "handed_to_packet");

  async function handlePick(p: Pickable) {
    setPickerOpen(false);
    const id = `ud_${Date.now()}`;
    const sortNext = (docs?.length ?? 0) + 100;
    await exec(
      `INSERT INTO uploaded_docs
        (id, owner_kind, owner_id, patient_id, kind, filename, source_clinic, uploaded_by,
         uploaded_at, pages, ocr_excerpt, extracted_icd, extracted_cpt, extracted_drg, status, sort)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, ownerKind, ownerId, "p43", p.kind, p.filename, p.source_clinic, "associate",
        new Date().toISOString(), p.pages, "", null, null, null, "uploaded", sortNext,
      ],
    );
    await refetch();
    setAnimatingId(id);
    setAnimStatus("uploaded");
    setExpanded(id);

    const schedule: Array<[string, number, Partial<Pickable>]> = [
      ["ocr_running", 800,  {}],
      ["ocr_done",    1500, { ocr_excerpt: p.ocr_excerpt }],
      ["coded",       900,  { extracted_icd: p.extracted_icd, extracted_cpt: p.extracted_cpt, extracted_drg: p.extracted_drg }],
    ];
    let acc = 0;
    schedule.forEach(([status, delay, patch]) => {
      acc += delay;
      const t = window.setTimeout(async () => {
        await exec(
          `UPDATE uploaded_docs SET status = ?,
              ocr_excerpt = COALESCE(?, ocr_excerpt),
              extracted_icd = COALESCE(?, extracted_icd),
              extracted_cpt = COALESCE(?, extracted_cpt),
              extracted_drg = COALESCE(?, extracted_drg)
            WHERE id = ?`,
          [status, patch.ocr_excerpt ?? null, patch.extracted_icd ?? null, patch.extracted_cpt ?? null, patch.extracted_drg ?? null, id],
        );
        setAnimStatus(status);
        await refetch();
        if (status === "coded") setAnimatingId(null);
      }, acc);
      timeouts.current.push(t);
    });
  }

  async function handleHandoff() {
    setHandedOff(true);
    // Cancel any in-flight upload animations — handoff is the terminal state.
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    setAnimatingId(null);
    // Mark every doc on this owner as handed_to_packet — including any that
    // were still mid-OCR. The packet agent now owns them.
    await exec(
      `UPDATE uploaded_docs SET status = 'handed_to_packet'
         WHERE owner_kind = ? AND owner_id = ?`,
      [ownerKind, ownerId],
    );
    await refetch();
    if (onRunAgent) onRunAgent();
  }

  // ── EMPTY STATE — actions stacked, never cramped ─────────────────────────
  if (isEmpty && !pickerOpen) {
    return (
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2">
          <span className="eyebrow">Documents</span>
          <span className="font-mono-tight text-[10px] text-ink-faint">none yet</span>
        </div>
        <div className="hairline-x mx-4" />
        <div className="flex flex-col gap-1.5 px-4 py-3">
          <Button size="sm" variant="primary" className="w-full" onClick={() => setPickerOpen(true)}>
            <Upload size={11} /> Upload document
          </Button>
          {ownerKind === "claim" && onRunAgent && (
            <Button size="sm" variant="outline" className="w-full" onClick={onRunAgent}>
              <Play size={11} /> Run agent
            </Button>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden">
      {/* ── Single-row header — count + status pill ─────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <span className="text-[12.5px] text-ink">Documents</span>
        <span className="font-mono-tight text-[10.5px] text-ink-faint">{codedCount}/{docs.length} coded</span>
        <Pill tone={allHandedOff ? "good" : maxRank === 5 ? "good" : "champagne"} dot size="xs" className="ml-auto">
          {allHandedOff ? "Built" : maxRank === 5 ? "Ready" : "In flight"}
        </Pill>
      </div>

      {/* ── Thin pipeline bar — one line, no chunk ──────────────────────── */}
      <div className="border-t border-line-soft px-4 py-1.5">
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
          <motion.div
            initial={false}
            animate={{ width: `${(maxRank / STEPS.length) * 100}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 18 }}
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-azure)] via-[var(--color-champagne)] to-[var(--color-emerald)]"
          />
        </div>
        <div className="mt-1 flex items-center justify-between font-mono-tight text-[9px] uppercase tracking-[0.12em] text-ink-faint">
          {STEPS.map((s) => (
            <span key={s} className={maxRank >= STATUS_RANK[s] ? "text-ink-soft" : ""}>{STEP_LABEL[s]}</span>
          ))}
        </div>
      </div>

      {/* ── INLINE PICKER (replaces overlay) — anchored, won't escape ──── */}
      <AnimatePresence initial={false}>
        {pickerOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 28 }}
            className="overflow-hidden border-t border-line-soft bg-[var(--color-panel-2)]/40"
          >
            <div className="flex items-center justify-between px-4 py-2">
              <div className="font-mono-tight text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                Pick a paper document to upload
              </div>
              <button onClick={() => setPickerOpen(false)} className="text-ink-faint hover:text-ink"><X size={12} /></button>
            </div>
            <ul className="flex flex-col">
              {pickable.map((p) => {
                const Icon = KIND_ICON[p.kind] ?? FileText;
                return (
                  <li key={p.kind} className="border-t border-line-soft">
                    <button
                      type="button"
                      onClick={() => handlePick(p)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-[var(--color-panel-2)]/60"
                    >
                      <Icon size={11} className="text-ink-mute" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-ink truncate">{KIND_LABEL[p.kind] ?? p.kind}</div>
                        <div className="font-mono-tight text-[10px] text-ink-faint truncate">{p.filename} · {p.pages}p</div>
                      </div>
                      <ArrowRight size={11} className="text-[var(--color-champagne)]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Doc list (capped — internal scroll so panel never grows past ~280px) ── */}
      <ul className="flex max-h-[280px] flex-col overflow-y-auto">
        {docs.map((d) => {
          const Icon = KIND_ICON[d.kind] ?? FileText;
          const meta = STATUS_META[d.status] ?? STATUS_META.uploaded;
          const isAnimating = animatingId === d.id;
          const liveStatus = isAnimating ? animStatus : d.status;
          const liveMeta = STATUS_META[liveStatus] ?? meta;
          const isOpen = expanded === d.id;
          const running = liveStatus === "ocr_running";

          return (
            <li key={d.id} className="border-t border-line-soft">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : d.id)}
                className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-[var(--color-panel-2)]/30"
              >
                <Icon size={11} className="shrink-0 text-ink-mute" />
                <span className="flex-1 truncate text-[12px] text-ink">{KIND_LABEL[d.kind] ?? d.kind}</span>
                <Pill tone={liveMeta.tone} size="xs" dot={liveMeta.tone !== "neutral"}>
                  {running ? <span className="inline-flex items-center gap-1"><Loader2 size={8} className="animate-spin" /> {liveMeta.label}</span> : liveMeta.label}
                </Pill>
                <ChevronDown size={11} className={`shrink-0 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 240, damping: 28 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-[var(--color-canvas-deep)]/30 px-4 py-2.5">
                      <div className="font-mono-tight text-[10px] text-ink-faint truncate">
                        {d.filename} · {d.pages}p{d.source_clinic ? ` · ${d.source_clinic}` : ""}
                      </div>
                      {d.ocr_excerpt && (
                        <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">
                          <span className="font-mono-tight text-[9px] uppercase tracking-[0.12em] text-ink-faint mr-1">OCR</span>
                          {d.ocr_excerpt}
                        </p>
                      )}
                      {(d.extracted_icd || d.extracted_cpt || d.extracted_drg) && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {d.extracted_icd && <Pill tone="champagne" size="xs">ICD-10 {d.extracted_icd}</Pill>}
                          {(d.extracted_cpt ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((c) => (
                            <Pill key={c} tone="violet" size="xs">CPT {c}</Pill>
                          ))}
                          {d.extracted_drg && <Pill tone="info" size="xs">DRG {d.extracted_drg}</Pill>}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      {/* ── Action footer — stacked so text never clips ─────────────────── */}
      {!allHandedOff && (
        <div className="flex flex-col gap-1.5 border-t border-line-soft px-4 py-3">
          {readyForHandoff && (
            <Button size="sm" variant="primary" className="w-full" onClick={handleHandoff}>
              <Layers size={11} /> Hand off to Packet agent
              <ArrowRight size={10} className="ml-auto" />
            </Button>
          )}
          {pickable.length > 0 && (
            <Button
              size="sm"
              variant={readyForHandoff ? "outline" : "primary"}
              className="w-full"
              onClick={() => setPickerOpen(true)}
            >
              <Upload size={11} /> Upload {docs.length > 0 ? "more" : "document"}
            </Button>
          )}
        </div>
      )}
      {allHandedOff && ownerKind === "claim" && (
        <div className="border-t border-line-soft bg-[var(--color-emerald)]/5 px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono-tight text-[10.5px] text-[var(--color-emerald)]">
            <CheckCircle2 size={11} />
            Handed to Packet agent · acceptance running below
          </div>
        </div>
      )}
    </Panel>
  );
}
