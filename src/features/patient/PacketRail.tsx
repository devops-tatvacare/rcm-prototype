import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronDown,
  CircleCheck,
  HelpCircle,
  Info,
  Sparkles,
  Loader2,
  FlaskConical,
} from "lucide-react";
import { Panel, PanelDivider, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Gauge } from "@/components/ui/Gauge";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/cn";
import { query, exec } from "@/lib/db";
import type { StageKey } from "./JourneyTimeline";

// Three packet "buckets" — each maps to a stage in the patient journey and
// to a real-world insurer interaction (initial GL, mid-stay top-up, final
// claim). The rail's required-docs checklist is grouped by these three.
type BucketKey = "gl" | "topup" | "final";

type DocItem = { id: string; label: string; clause?: string };
type DocStatus = "clean" | "missing";

const BUCKET_LABEL: Record<BucketKey, string> = {
  gl: "GL set",
  topup: "Top-up set",
  final: "Final claim set",
};

// ── Mocked extracted policy (Mode A) ─────────────────────────────────────
// A realistic-looking object the demo can present as "rules extracted from
// patient's PRUSolusi Sehat Tier-3 policy PDF". P5 may swap this per
// patient; for P4 it's a single shared mock so the flip looks real.
const MOCKED_EXTRACTED = {
  payorLabel: "PRUSolusi Sehat Tier-3",
  sumInsured: "IDR 500M",
  roomCap: "IDR 1.2M / day",
  icuCap: "IDR 2.4M / day",
  coPay: "0% in network",
  pedWaiting: "12 months (cleared — patient on policy 36 months)",
  preAuthRequired: "Yes for all surgeries",
  // Each doc has a clause reference shown on hover. Numbers are mocked but
  // shaped like real policy clause references.
  docsByBucket: {
    gl: [
      { id: "preauth", label: "Pre-auth Form", clause: "Page 7, clause 4.3" },
      { id: "lma", label: "LMA", clause: "Page 8, clause 4.4.1" },
      { id: "lmn", label: "Letter of Medical Necessity", clause: "Page 8, clause 4.4.2" },
      { id: "preopanaes", label: "Pre-op Anaesthesia Note", clause: "Page 9, clause 4.5" },
    ],
    topup: [
      { id: "intraop", label: "Intraoperative Finding Note", clause: "Page 11, clause 5.2" },
      { id: "addlma", label: "Top-up LMA addendum", clause: "Page 11, clause 5.3" },
      { id: "rce", label: "Revised Cost Estimate", clause: "Page 12, clause 5.4" },
    ],
    final: [
      { id: "opnote", label: "Op Note", clause: "Page 14, clause 6.1" },
      { id: "ds", label: "Discharge Summary", clause: "Page 14, clause 6.2" },
      { id: "inv", label: "Final Itemised Invoice", clause: "Page 15, clause 6.3" },
    ],
  } as Record<BucketKey, DocItem[]>,
};

const MOCKED_RULE_COUNT =
  MOCKED_EXTRACTED.docsByBucket.gl.length +
  MOCKED_EXTRACTED.docsByBucket.topup.length +
  MOCKED_EXTRACTED.docsByBucket.final.length;

// Map active stage → which bucket is "current". Drives the default-expanded
// section, action button label, and per-doc status stubs.
function bucketForStage(stage: StageKey): BucketKey {
  if (stage === "consultation" || stage === "diagnostics" || stage === "preadmission") return "gl";
  if (stage === "admission" || stage === "surgery") return "topup";
  return "final"; // postop, discharge
}

const BUCKET_ORDER: BucketKey[] = ["gl", "topup", "final"];

// Stub per-doc status. For P3.3 we mark active-bucket docs as 60% clean / 40%
// missing, pre-active buckets as all clean, post-active as all missing. P5
// will wire to real per-patient packet readiness data.
function statusFor(bucket: BucketKey, active: BucketKey, idx: number, total: number): DocStatus {
  const order = BUCKET_ORDER.indexOf(bucket);
  const activeIdx = BUCKET_ORDER.indexOf(active);
  if (order < activeIdx) return "clean";
  if (order > activeIdx) return "missing";
  // Active bucket: ~60% clean, ~40% missing. Take the first 60% as clean.
  const cleanCount = Math.ceil(total * 0.6);
  return idx < cleanCount ? "clean" : "missing";
}

function actionLabelFor(stage: StageKey): string {
  if (stage === "consultation" || stage === "diagnostics" || stage === "preadmission") return "Submit GL";
  if (stage === "admission" || stage === "surgery") return "Submit top-up";
  return "Submit final claim";
}

type Mode = "A" | "B";

// ── Mode B: payor rule rows from DB ──────────────────────────────────────
type PayorRuleRow = {
  id: string;
  payor_id: string;
  category: string;
  description: string;
  threshold_value: string;
  source_confidence: string;
  evidence_threads: number;
  lift_pct: number;
};

type PayorMeta = { name: string };

type DerivationKind = "extracted" | "industry_typical" | "admin_added" | "promoted_from_denial";

const DERIV_META: Record<
  DerivationKind,
  { label: string; tone: "champagne" | "neutral" | "info" | "good"; tooltip: string }
> = {
  extracted: {
    label: "Extracted",
    tone: "champagne",
    tooltip: "Extracted from official payor policy / regulation source.",
  },
  industry_typical: {
    label: "Industry-typical",
    tone: "neutral",
    tooltip: "Industry-typical rule observed across Indonesian payors.",
  },
  admin_added: {
    label: "Admin",
    tone: "info",
    tooltip: "Hospital admin added this rule from local experience.",
  },
  promoted_from_denial: {
    label: "Learned",
    tone: "good",
    tooltip: "Auto-learned from prior denial outcomes at this payor.",
  },
};

// Map payor_rules.category → display bucket
function bucketForCategory(cat: string): BucketKey {
  if (cat === "documentation") return "gl";
  if (cat === "financial") return "topup";
  return "final"; // 'process' and any other
}

const POLL_INTERVAL_MS = 1500;
const ANIM_DURATION_MS = 1500;

export function PacketRail({
  patientId,
  payorId,
  activeStage,
}: {
  patientId: string;
  payorId: string | null;
  activeStage: StageKey;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [policyCount, setPolicyCount] = useState<number>(0);
  const [animState, setAnimState] = useState<"idle" | "animating" | "ready">("idle");
  const prevModeRef = useRef<Mode | null>(null);
  const animTimer = useRef<number | null>(null);

  // Mode resolution: Mode A iff this patient has uploaded a policy_certificate.
  // Polls every ~1.5s so an upload (or the dev toggle) flips the rail live.
  useEffect(() => {
    let cancelled = false;
    async function fetchOnce() {
      const rows = await query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM uploaded_docs
          WHERE owner_kind = 'patient'
            AND owner_id = ?
            AND kind = 'policy_certificate'`,
        [patientId],
      );
      if (cancelled) return;
      const n = rows[0]?.n ?? 0;
      setPolicyCount(n);
      const next: Mode = n > 0 ? "A" : "B";
      setMode((prev) => {
        if (prev === next) return prev;
        // Trigger extraction animation only on the 0→1 transition during
        // this session — not on first mount when policy was already there.
        if (prev === "B" && next === "A") {
          setAnimState("animating");
          if (animTimer.current) window.clearTimeout(animTimer.current);
          animTimer.current = window.setTimeout(() => {
            setAnimState("ready");
          }, ANIM_DURATION_MS);
        } else if (next === "A") {
          // First load with policy already present — skip animation.
          setAnimState("ready");
        } else {
          setAnimState("idle");
        }
        prevModeRef.current = next;
        return next;
      });
    }
    fetchOnce();
    const interval = window.setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (animTimer.current) window.clearTimeout(animTimer.current);
    };
  }, [patientId]);

  const activeBucket = useMemo(() => bucketForStage(activeStage), [activeStage]);

  // ── Mode B: load payor rules + meta ────────────────────────────────────
  const [payorRules, setPayorRules] = useState<PayorRuleRow[]>([]);
  const [payorMeta, setPayorMeta] = useState<PayorMeta | null>(null);
  useEffect(() => {
    if (!payorId) return;
    let cancelled = false;
    (async () => {
      const [rules, payors] = await Promise.all([
        query<PayorRuleRow>(
          `SELECT id, payor_id, category, description, threshold_value,
                  source_confidence, evidence_threads, lift_pct
             FROM payor_rules
            WHERE payor_id = ?
            ORDER BY lift_pct DESC`,
          [payorId],
        ),
        query<PayorMeta>(`SELECT name FROM payors WHERE id = ?`, [payorId]),
      ]);
      if (cancelled) return;
      setPayorRules(rules);
      setPayorMeta(payors[0] ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [payorId]);

  // Group rules by display bucket, ordered by lift_pct desc, capped at 10.
  const rulesByBucket = useMemo(() => {
    const out: Record<BucketKey, PayorRuleRow[]> = { gl: [], topup: [], final: [] };
    for (const r of payorRules) out[bucketForCategory(r.category)].push(r);
    (Object.keys(out) as BucketKey[]).forEach((k) => {
      out[k] = out[k].slice(0, 10);
    });
    return out;
  }, [payorRules]);

  const totalThreads = useMemo(
    () => payorRules.reduce((acc, r) => acc + (r.evidence_threads ?? 0), 0),
    [payorRules],
  );

  function onSubmit() {
    const label = actionLabelFor(activeStage);
    console.info(`[packet-rail] mocked: ${label.toLowerCase()}`);
    if (typeof window !== "undefined") {
      window.alert(`Mocked: ${label.replace(/^Submit /, "")} submitted`);
    }
  }

  // ── Dev toggle: insert/remove a mocked policy_certificate row ──────────
  async function toggleMode() {
    if (policyCount > 0) {
      await exec(
        `DELETE FROM uploaded_docs
          WHERE owner_kind = 'patient' AND owner_id = ? AND kind = 'policy_certificate'`,
        [patientId],
      );
    } else {
      const id = `ud_policy_${Date.now()}`;
      await exec(
        `INSERT INTO uploaded_docs
          (id, owner_kind, owner_id, patient_id, kind, filename, source_clinic, uploaded_by,
           uploaded_at, pages, ocr_excerpt, extracted_icd, extracted_cpt, extracted_drg, status, sort)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id,
          "patient",
          patientId,
          patientId,
          "policy_certificate",
          "PRUSolusi_Sehat_Tier3_certificate.pdf",
          "Patient upload",
          "patient",
          new Date().toISOString(),
          18,
          "",
          null,
          null,
          null,
          "uploaded",
          0,
        ],
      );
    }
    // The poll will pick it up within ~1.5s; force an immediate refresh too.
    const rows = await query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM uploaded_docs
        WHERE owner_kind = 'patient' AND owner_id = ? AND kind = 'policy_certificate'`,
      [patientId],
    );
    const n = rows[0]?.n ?? 0;
    setPolicyCount(n);
  }

  if (mode === null) {
    return (
      <div className="flex flex-col gap-3">
        <Panel tone="raised">
          <div className="px-4 py-3 font-mono-tight text-[11px] text-ink-faint">Loading…</div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mode badge + sub-banner */}
      <Panel tone="raised">
        <PanelHeader
          eyebrow="Rule mode"
          title="Operating mode"
          density="compact"
          right={<Info size={12} className="text-ink-faint" />}
        />
        <PanelDivider />
        <div className="flex flex-col gap-2 px-4 py-3">
          <ModeBadge mode={mode} />
          <ModeSubBanner
            mode={mode}
            animState={animState}
            ruleCount={MOCKED_RULE_COUNT}
            payorLabel={MOCKED_EXTRACTED.payorLabel}
            payorName={payorMeta?.name ?? "this payor"}
            threadCount={totalThreads}
          />
        </div>
      </Panel>

      {/* Acceptance gauge */}
      <Panel>
        <PanelHeader eyebrow="Readiness" title="Acceptance probability" density="compact" />
        <PanelDivider />
        <div className="flex flex-col items-center gap-1 px-4 py-3">
          <Gauge value={78} />
          <div className="font-mono-tight text-[10.5px] text-ink-faint">
            Acceptance probability
          </div>
        </div>
      </Panel>

      {/* SLA bar */}
      <Panel>
        <PanelHeader eyebrow="SLA" title="Time remaining" density="compact" />
        <PanelDivider />
        <div className="flex flex-col gap-2 px-4 py-3">
          <SlaBar elapsedPct={60} remainingLabel="18h remaining" tone="ok" />
        </div>
      </Panel>

      {/* Required-docs checklist */}
      <Panel>
        <PanelHeader eyebrow="Checklist" title="Required documents" density="compact" />
        <PanelDivider />
        <div className="flex flex-col">
          {mode === "A" ? (
            <ChecklistAccordionA activeBucket={activeBucket} />
          ) : (
            <ChecklistAccordionB activeBucket={activeBucket} rulesByBucket={rulesByBucket} />
          )}
        </div>
      </Panel>

      {/* Blockers */}
      <Panel>
        <PanelHeader eyebrow="Blockers" title="What's holding things up" density="compact" />
        <PanelDivider />
        <ul className="flex flex-col gap-1.5 px-4 py-3 font-mono-tight text-[11px] leading-relaxed text-ink-soft">
          <li className="flex gap-2">
            <span className="mt-[5px] inline-block h-1 w-1 rounded-full bg-[var(--color-coral)]" />
            <span>Awaiting signed Pre-op Anaesthesia Note</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-[5px] inline-block h-1 w-1 rounded-full bg-[var(--color-coral)]" />
            <span>Pending CBC freshness — re-order if delayed past 14:00</span>
          </li>
        </ul>
      </Panel>

      {/* Action */}
      <div>
        <Button variant="primary" size="lg" className="w-full" onClick={onSubmit}>
          {actionLabelFor(activeStage)}
        </Button>
      </div>

      {/* Dev-only mode flip — faint, low visual weight */}
      <button
        type="button"
        onClick={toggleMode}
        title="Demo: toggle a mocked policy_certificate doc to flip Mode A/B"
        className="mx-auto inline-flex items-center gap-1.5 self-center rounded-full px-2 py-1 font-mono-tight text-[9.5px] uppercase tracking-[0.14em] text-ink-faint/70 transition-colors hover:text-ink-soft"
      >
        <FlaskConical size={10} />
        Demo: flip mode
      </button>
    </div>
  );
}

// ── Mode badge ────────────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: Mode }) {
  const isA = mode === "A";
  const tooltip = isA
    ? "Mode A: rules extracted from your uploaded policy PDF."
    : "Mode B: rules from your hospital's payor intelligence library — built from prior cases.";
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 4, scale: 0.98 }}
        animate={
          isA
            ? {
                opacity: 1,
                y: 0,
                scale: 1,
                boxShadow: [
                  "0 0 0 0 rgba(0,0,0,0)",
                  "0 0 0 6px var(--color-champagne, #d4a574)40",
                  "0 0 0 0 rgba(0,0,0,0)",
                ],
              }
            : { opacity: 1, y: 0, scale: 1 }
        }
        exit={{ opacity: 0, y: -4, scale: 0.98 }}
        transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
        title={tooltip}
        className={cn(
          "flex items-center gap-2.5 rounded-full border px-3 py-1.5",
          isA
            ? "border-[var(--color-champagne)]/40 bg-[var(--color-champagne)]/12"
            : "border-[var(--color-violet)]/40 bg-[var(--color-violet)]/12",
        )}
      >
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full px-2 font-mono-tight text-[10px] font-semibold uppercase tracking-wider",
            isA
              ? "bg-[var(--color-champagne)] text-[var(--color-canvas-deep)]"
              : "bg-[var(--color-violet)] text-[var(--color-canvas-deep)]",
          )}
        >
          Mode {mode}
        </span>
        <span className="font-mono-tight text-[11px] text-ink-soft">
          {isA ? "Policy on file" : "Payor Intelligence"}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Mode sub-banner ──────────────────────────────────────────────────────
function ModeSubBanner({
  mode,
  animState,
  ruleCount,
  payorLabel,
  payorName,
  threadCount,
}: {
  mode: Mode;
  animState: "idle" | "animating" | "ready";
  ruleCount: number;
  payorLabel: string;
  payorName: string;
  threadCount: number;
}) {
  if (mode === "B") {
    return (
      <div className="font-mono-tight text-[10.5px] leading-snug text-ink-faint">
        Based on{" "}
        <span className="text-ink-soft">{threadCount.toLocaleString()}</span> prior cases at{" "}
        <span className="text-ink-soft">{payorName}</span>
      </div>
    );
  }
  // Mode A
  if (animState === "animating") {
    return (
      <motion.div
        key="animating"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-1.5 font-mono-tight text-[10.5px] text-[var(--color-champagne)]"
      >
        <Sparkles size={11} className="animate-pulse" />
        <Loader2 size={10} className="animate-spin" />
        <span>Extracting rules from policy PDF…</span>
      </motion.div>
    );
  }
  return (
    <motion.div
      key="ready"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-1.5 font-mono-tight text-[10.5px] text-ink-faint"
    >
      <Sparkles size={11} className="text-[var(--color-champagne)]" />
      <span>
        Extracted <span className="text-ink-soft">{ruleCount}</span> rules from{" "}
        <span className="text-ink-soft">{payorLabel}</span>
      </span>
    </motion.div>
  );
}

// ── SLA bar ───────────────────────────────────────────────────────────────
function SlaBar({
  elapsedPct,
  remainingLabel,
  tone,
}: {
  elapsedPct: number;
  remainingLabel: string;
  tone: "ok" | "warn" | "danger";
}) {
  const fill =
    tone === "ok"
      ? "bg-[var(--color-emerald)]"
      : tone === "warn"
        ? "bg-[var(--color-champagne)]"
        : "bg-[var(--color-coral)]";
  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className="font-mono-tight text-[11px] text-ink-soft">{remainingLabel}</span>
        <span className="font-mono-tight text-[10px] text-ink-faint">
          {Math.round(elapsedPct)}% elapsed
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-canvas-deep)]">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", fill)}
          style={{ width: `${Math.max(0, Math.min(100, elapsedPct))}%` }}
        />
      </div>
    </>
  );
}

// ── Checklist accordion — Mode A (extracted policy) ──────────────────────
function ChecklistAccordionA({ activeBucket }: { activeBucket: BucketKey }) {
  const [openSet, setOpenSet] = useState<Record<BucketKey, boolean>>({
    gl: activeBucket === "gl",
    topup: activeBucket === "topup",
    final: activeBucket === "final",
  });

  function toggle(b: BucketKey) {
    setOpenSet((prev) => ({ ...prev, [b]: !prev[b] }));
  }

  return (
    <div className="flex flex-col">
      {BUCKET_ORDER.map((b, i) => {
        const docs = MOCKED_EXTRACTED.docsByBucket[b];
        const cleanCount = docs.reduce(
          (acc, _d, idx) => acc + (statusFor(b, activeBucket, idx, docs.length) === "clean" ? 1 : 0),
          0,
        );
        const open = openSet[b];
        return (
          <div key={b} className={cn(i > 0 && "border-t border-line-soft")}>
            <button
              type="button"
              onClick={() => toggle(b)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-panel-2)]/40"
            >
              <span className="flex items-center gap-2">
                <ChevronDown
                  size={12}
                  className={cn("text-ink-faint transition-transform", !open && "-rotate-90")}
                />
                <span className="font-mono-tight text-[11.5px] text-ink-soft">
                  {BUCKET_LABEL[b]}
                </span>
              </span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">
                {cleanCount} of {docs.length}
              </span>
            </button>
            {open && (
              <ul className="flex flex-col gap-1 px-4 pb-3">
                {docs.map((doc, idx) => {
                  const status = statusFor(b, activeBucket, idx, docs.length);
                  return (
                    <li
                      key={doc.id}
                      title={doc.clause}
                      className="flex items-center gap-2 font-mono-tight text-[11px] text-ink-soft"
                    >
                      {status === "clean" ? (
                        <CircleCheck size={12} className="text-[var(--color-emerald)]" />
                      ) : (
                        <HelpCircle size={12} className="text-ink-faint" />
                      )}
                      <span className={cn(status === "missing" && "text-ink-mute")}>
                        {doc.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Checklist accordion — Mode B (payor rules with derivation badges) ────
function ChecklistAccordionB({
  activeBucket,
  rulesByBucket,
}: {
  activeBucket: BucketKey;
  rulesByBucket: Record<BucketKey, PayorRuleRow[]>;
}) {
  const [openSet, setOpenSet] = useState<Record<BucketKey, boolean>>({
    gl: activeBucket === "gl",
    topup: activeBucket === "topup",
    final: activeBucket === "final",
  });

  function toggle(b: BucketKey) {
    setOpenSet((prev) => ({ ...prev, [b]: !prev[b] }));
  }

  return (
    <div className="flex flex-col">
      {BUCKET_ORDER.map((b, i) => {
        const rules = rulesByBucket[b] ?? [];
        const open = openSet[b];
        return (
          <div key={b} className={cn(i > 0 && "border-t border-line-soft")}>
            <button
              type="button"
              onClick={() => toggle(b)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-panel-2)]/40"
            >
              <span className="flex items-center gap-2">
                <ChevronDown
                  size={12}
                  className={cn("text-ink-faint transition-transform", !open && "-rotate-90")}
                />
                <span className="font-mono-tight text-[11.5px] text-ink-soft">
                  {BUCKET_LABEL[b]}
                </span>
              </span>
              <span className="font-mono-tight text-[10.5px] text-ink-faint">
                {rules.length} rules
              </span>
            </button>
            {open && (
              <ul className="flex flex-col gap-1.5 px-4 pb-3">
                {rules.length === 0 && (
                  <li className="font-mono-tight text-[10.5px] text-ink-faint">
                    No rules in this bucket.
                  </li>
                )}
                {rules.map((r) => {
                  const kind = (r.source_confidence as DerivationKind) ?? "industry_typical";
                  const meta = DERIV_META[kind] ?? DERIV_META.industry_typical;
                  return (
                    <li key={r.id} className="flex flex-col gap-1">
                      <div className="flex items-start gap-2">
                        <span
                          title={meta.tooltip}
                          className="mt-0.5 shrink-0"
                        >
                          <Pill tone={meta.tone} size="xs">
                            {meta.label}
                          </Pill>
                        </span>
                        <span
                          className="flex-1 font-mono-tight text-[10.5px] leading-snug text-ink-soft"
                          title={r.description}
                        >
                          {r.description}
                        </span>
                        <span
                          className="ml-1 shrink-0 font-mono-tight text-[10px] text-ink-faint"
                          title={r.threshold_value}
                        >
                          {truncate(r.threshold_value, 22)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
