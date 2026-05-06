import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, FileImage, FlaskConical, ScrollText, Receipt, ShieldCheck,
  Upload, ChevronDown, CheckCircle2, Loader2, Play, Layers, ArrowRight, X, FolderOpen,
} from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
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
  policy_certificate: ShieldCheck,
};
const KIND_LABEL: Record<string, string> = {
  handwritten_referral: "Handwritten GP referral", ed_note: "ED admission note",
  handwritten_progress: "Daily progress notes", handwritten_anesthesia: "Anaesthesia record",
  discharge_summary: "Discharge summary", op_report: "Operative report",
  pathology: "Pathology report", lab_result: "Lab result", imaging: "Imaging",
  invoice: "Final invoice", consult_note: "Consult note", echo_report: "Echo report",
  abg: "ABG result", culture: "Culture result",
  policy_certificate: "Insurance policy certificate",
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

export type Pickable = { kind: string; filename: string; pages: number; source_clinic: string; ocr_excerpt: string; extracted_icd: string | null; extracted_cpt: string | null; extracted_drg: string | null };

const PICKABLE_BY_OWNER: Record<string, Pickable[]> = {
  "patient:p43": [
    { kind: "handwritten_referral", filename: "OBGYN_referral_Ayu_scan.jpg", pages: 1, source_clinic: "Klinik Harapan Ibu · Bogor", ocr_excerpt: "Rujukan SpOG: Ny. Ayu Lestari, 42 th. Menorrhagia kronis + fibroid uterus multipel. Mohon evaluasi histerektomi laparoskopik cashless.", extracted_icd: "D25", extracted_cpt: null, extracted_drg: "PRIV-GYN-HYST-S" },
    { kind: "imaging", filename: "Pelvic_MRI_Ayu.pdf", pages: 3, source_clinic: "Klinik Harapan Ibu · Radiology", ocr_excerpt: "MRI pelvis: multiple intramural fibroids, dominant lesion 7.8 cm. Uterus enlarged. No adnexal mass. Surgical planning advised.", extracted_icd: "D25", extracted_cpt: null, extracted_drg: "PRIV-GYN-HYST-S" },
    { kind: "lab_result", filename: "CBC_CMP_Ayu.pdf", pages: 2, source_clinic: "Klinik Harapan Ibu · Lab", ocr_excerpt: "Hb 10.8, platelets normal, creatinine 0.8, INR 1.0. Cleared for elective surgery with anaesthesia review.", extracted_icd: null, extracted_cpt: "85027,80053", extracted_drg: "PRIV-GYN-HYST-S" },
    { kind: "handwritten_anesthesia", filename: "Preop_anaesthesia_Ayu_scan.jpg", pages: 1, source_clinic: "Klinik Harapan Ibu · Anaesthesia", ocr_excerpt: "Pre-op anaesthesia assessment completed. ASA II. Cleared for elective laparoscopic hysterectomy with routine monitoring.", extracted_icd: null, extracted_cpt: null, extracted_drg: "PRIV-GYN-HYST-S" },
    { kind: "policy_certificate", filename: "PRUSolusi_Sehat_Ayu.pdf", pages: 8, source_clinic: "Patient upload", ocr_excerpt: "PRUSolusi Sehat Tier 3. Elective surgery requires pre-auth form, LMA, medical necessity letter, anaesthesia note, and final invoice bundle.", extracted_icd: null, extracted_cpt: null, extracted_drg: null },
  ],
  "patient:p-siti": [
    { kind: "policy_certificate", filename: "BPJS_Membership_Certificate_Siti.pdf", pages: 4, source_clinic: "Patient upload", ocr_excerpt: "Kartu peserta BPJS · Kelas I · aktif. Dokumen manfaat dibagikan pasien untuk verifikasi cashless.", extracted_icd: null, extracted_cpt: null, extracted_drg: null },
    { kind: "handwritten_progress", filename: "Antenatal_notes_Siti_scan.pdf", pages: 2, source_clinic: "Bidan Ratna · antenatal clinic", ocr_excerpt: "G2P1A0 · usia kehamilan 38+4 minggu · breech persists · prior C-section scar · plan repeat C-section under BPJS.", extracted_icd: "O64", extracted_cpt: null, extracted_drg: "INA-CBG O-6-10-I" },
    { kind: "handwritten_anesthesia", filename: "Preop_anaesthesia_clearance_Siti.jpg", pages: 1, source_clinic: "RS Cendana Jakarta · anaesthesia", ocr_excerpt: "ASA II. Previous spinal tolerated. Cleared for elective repeat C-section. Hb 11.6, platelets normal.", extracted_icd: null, extracted_cpt: null, extracted_drg: "INA-CBG O-6-10-I" },
  ],
  "patient:p-ravi": [
    { kind: "policy_certificate", filename: "AIA_policy_schedule_Ravi.pdf", pages: 6, source_clinic: "Patient upload", ocr_excerpt: "AIA Tier-3 schedule · monitored room cap IDR 2.0M/day · PCI requires pre-auth and final invoice package.", extracted_icd: null, extracted_cpt: null, extracted_drg: null },
    { kind: "handwritten_progress", filename: "Cardiology_progress_note_Ravi_scan.jpg", pages: 2, source_clinic: "Mayapada Hospital · cardiac ward", ocr_excerpt: "Post PCI arrhythmia-watch protocol continued overnight. Monitored single room requested to permit telemetry and prompt rhythm review.", extracted_icd: "I20.0", extracted_cpt: "92928", extracted_drg: "PRIV-CARDIO-PCI-S" },
  ],
};

const HANDOFF_THRESHOLD = 1;

export function getPickableDocs(ownerKind: "claim" | "inpatient" | "patient", ownerId: string): Pickable[] {
  return PICKABLE_BY_OWNER[`${ownerKind}:${ownerId}`] ?? [];
}

export function UploadedDocsPanel({
  ownerKind, ownerId, patientId, onRunAgent,
}: {
  ownerKind: "claim" | "inpatient" | "patient";
  ownerId: string;
  patientId?: string;
  patientName?: string;
  onRunAgent?: () => void;
}) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedKinds, setSelectedKinds] = useState<string[]>([]);
  const [animatingStatusById, setAnimatingStatusById] = useState<Record<string, string>>({});
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

  const allPickable = getPickableDocs(ownerKind, ownerId);
  const usedKinds = useMemo(() => new Set(docs?.map((d) => d.kind) ?? []), [docs]);
  const pickable = allPickable.filter((p) => !usedKinds.has(p.kind));
  const isPatientOwner = ownerKind === "patient";

  if (!docs) return null;
  // Hide entirely if no pre-populated docs AND no upload paths defined for this owner
  if (docs.length === 0 && allPickable.length === 0) return null;

  const codedCount = docs.filter((d) => STATUS_RANK[d.status] >= 4).length;
  const maxRank = docs.length === 0 ? 0 : Math.max(...docs.map((d) => STATUS_RANK[d.status] ?? 0));
  const isEmpty = docs.length === 0;
  const readyForHandoff = codedCount >= HANDOFF_THRESHOLD && !handedOff && maxRank < 5;
  const allHandedOff = docs.length > 0 && docs.every((d) => d.status === "handed_to_packet");

  function togglePick(kind: string) {
    setSelectedKinds((prev) => (
      prev.includes(kind) ? prev.filter((item) => item !== kind) : [...prev, kind]
    ));
  }

  async function handleSubmitSelected() {
    const selected = pickable.filter((p) => selectedKinds.includes(p.kind));
    if (selected.length === 0) return;
    const uploaded = selected.map((p, index) => ({
      pickable: p,
      id: `ud_${Date.now()}_${index}`,
      sort: (docs?.length ?? 0) + 100 + index,
    }));

    for (const item of uploaded) {
      await exec(
        `INSERT INTO uploaded_docs
          (id, owner_kind, owner_id, patient_id, kind, filename, source_clinic, uploaded_by,
           uploaded_at, pages, ocr_excerpt, extracted_icd, extracted_cpt, extracted_drg, status, sort)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          item.id,
          ownerKind,
          ownerId,
          patientId ?? ownerId,
          item.pickable.kind,
          item.pickable.filename,
          item.pickable.source_clinic,
          isPatientOwner ? "patient" : "associate",
          new Date().toISOString(),
          item.pickable.pages,
          "",
          null,
          null,
          null,
          "uploaded",
          item.sort,
        ],
      );
    }

    setPickerOpen(false);
    setSelectedKinds([]);
    setExpanded(uploaded[0]?.id ?? null);
    setAnimatingStatusById((prev) => ({
      ...prev,
      ...Object.fromEntries(uploaded.map((item) => [item.id, "uploaded"])),
    }));
    await refetch();

    uploaded.forEach((item, itemIndex) => {
      const schedule: Array<[string, number, Partial<Pickable>]> = [
        ["ocr_running", 800, {}],
        ["ocr_done", 1500, { ocr_excerpt: item.pickable.ocr_excerpt }],
        ["coded", 900, {
          extracted_icd: item.pickable.extracted_icd,
          extracted_cpt: item.pickable.extracted_cpt,
          extracted_drg: item.pickable.extracted_drg,
        }],
      ];
      let acc = itemIndex * 350;
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
            [status, patch.ocr_excerpt ?? null, patch.extracted_icd ?? null, patch.extracted_cpt ?? null, patch.extracted_drg ?? null, item.id],
          );
          setAnimatingStatusById((prev) => {
            const next = { ...prev, [item.id]: status };
            if (status === "coded") delete next[item.id];
            return next;
          });
          await refetch();
        }, acc);
        timeouts.current.push(t);
      });
    });
  }

  async function handleHandoff() {
    setHandedOff(true);
    // Cancel any in-flight upload animations — handoff is the terminal state.
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    setAnimatingStatusById({});
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

  async function handleRemove(docId: string) {
    await exec(`DELETE FROM uploaded_docs WHERE id = ?`, [docId]);
    if (expanded === docId) setExpanded(null);
    await refetch();
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
            <Upload size={11} /> Upload {isPatientOwner ? "patient document" : "document"}
          </Button>
          {ownerKind === "claim" && onRunAgent && (
            <Button size="sm" variant="outline" className="w-full" onClick={onRunAgent}>
              <Play size={11} /> Build packet
            </Button>
          )}
        </div>
      </Panel>
    );
  }

  return (
    <>
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

        {/* ── Doc list (capped — internal scroll so panel never grows past ~280px) ── */}
        <ul className="flex max-h-[280px] flex-col overflow-y-auto">
          {docs.map((d) => {
            const Icon = KIND_ICON[d.kind] ?? FileText;
            const meta = STATUS_META[d.status] ?? STATUS_META.uploaded;
            const liveStatus = animatingStatusById[d.id] ?? d.status;
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
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-mono-tight text-[10px] text-ink-faint truncate">
                            {d.filename} · {d.pages}p{d.source_clinic ? ` · ${d.source_clinic}` : ""}
                          </div>
                          {isPatientOwner && d.kind === "policy_certificate" && (
                            <button
                              type="button"
                              onClick={() => handleRemove(d.id)}
                              className="shrink-0 font-mono-tight text-[10px] text-ink-faint transition-colors hover:text-[var(--color-coral)]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {d.ocr_excerpt && (
                          <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">
                            <span className="mr-1 font-mono-tight text-[9px] uppercase tracking-[0.12em] text-ink-faint">OCR</span>
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
        {!allHandedOff && ownerKind !== "patient" && (
          <div className="flex flex-col gap-1.5 border-t border-line-soft px-4 py-3">
            {readyForHandoff && (
              <Button size="sm" variant="primary" className="w-full" onClick={handleHandoff}>
                <Layers size={11} /> Send to packet build
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
        {!allHandedOff && ownerKind === "patient" && pickable.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-line-soft px-4 py-3">
            <Button size="sm" variant="primary" className="w-full" onClick={() => setPickerOpen(true)}>
              <Upload size={11} /> Upload {docs.length > 0 ? "more documents" : "document"}
            </Button>
          </div>
        )}
        {allHandedOff && ownerKind === "claim" && (
          <div className="border-t border-line-soft bg-[var(--color-emerald)]/5 px-4 py-2.5">
            <div className="flex items-center gap-2 font-mono-tight text-[10.5px] text-[var(--color-emerald)]">
              <CheckCircle2 size={11} />
              Sent to packet build · acceptance updating below
            </div>
          </div>
        )}
      </Panel>

      <AnimatePresence>
        {pickerOpen && (
          <MockFilePicker
            files={pickable}
            selectedKinds={selectedKinds}
            onToggle={togglePick}
            onClose={() => {
              setPickerOpen(false);
              setSelectedKinds([]);
            }}
            onSubmit={handleSubmitSelected}
            isPatientOwner={isPatientOwner}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function MockFilePicker({
  files,
  selectedKinds,
  onToggle,
  onClose,
  onSubmit,
  isPatientOwner,
}: {
  files: Pickable[];
  selectedKinds: string[];
  onToggle: (kind: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPatientOwner: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(7,12,20,0.62)] p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        className="w-full max-w-[720px] rounded-2xl border border-line-soft bg-panel shadow-lift"
      >
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line-soft bg-[var(--color-panel-2)]/35 text-ink-faint">
              <FolderOpen size={16} />
            </span>
            <div>
              <div className="eyebrow">Document folder</div>
              <div className="text-[13px] text-ink-soft">
                {isPatientOwner ? "Patient packet uploads" : "Paper packet uploads"}
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-ink-faint transition-colors hover:text-ink">
            <X size={15} />
          </button>
        </div>

        <div className="border-b border-line-soft px-5 py-3">
          <div className="font-mono-tight text-[10px] uppercase tracking-[0.12em] text-ink-faint">
            Select one or more files to upload
          </div>
        </div>

        <ul className="max-h-[340px] overflow-y-auto">
          {files.map((file) => {
            const Icon = KIND_ICON[file.kind] ?? FileText;
            const checked = selectedKinds.includes(file.kind);
            return (
              <li key={file.kind} className="border-b border-line-soft last:border-b-0">
                <button
                  type="button"
                  onClick={() => onToggle(file.kind)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--color-panel-2)]/35"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      checked
                        ? "border-[var(--color-champagne)] bg-[var(--color-champagne)] text-[var(--color-canvas-deep)]"
                        : "border-line-soft bg-[var(--color-canvas-deep)]/50 text-transparent",
                    )}
                  >
                    <CheckCircle2 size={10} />
                  </span>
                  <Icon size={12} className="shrink-0 text-ink-mute" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-ink">{KIND_LABEL[file.kind] ?? file.kind}</div>
                    <div className="font-mono-tight text-[10px] text-ink-faint">
                      {file.filename} · {file.pages}p · {file.source_clinic}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="font-mono-tight text-[10.5px] text-ink-faint">
            {selectedKinds.length === 0
              ? "No files selected"
              : `${selectedKinds.length} file${selectedKinds.length === 1 ? "" : "s"} selected`}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={onSubmit} disabled={selectedKinds.length === 0}>
              <Upload size={11} />
              Upload selected
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
