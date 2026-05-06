import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, ExternalLink, ChevronDown } from "lucide-react";
import { Panel } from "@/components/ui/Panel";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { exec, query } from "@/lib/db";
import { cn } from "@/lib/cn";

type Payor = { id: string; name: string; color: string };

type Rule = {
  id: string;
  payor_id: string;
  payor_name: string;
  payor_color: string;
  category: string;
  kind: string | null;
  drg_pattern: string | null;
  description: string;
  threshold_value: string | null;
  source_confidence: string;
  evidence_url: string | null;
  evidence_threads: number;
  lift_pct: number;
  added_by: string | null;
};

type PayorFilter = "all" | "bpjs" | "pru" | "aia";
type CategoryFilter = "all" | "documentation" | "financial" | "process";
type SourceFilter = "all" | "extracted" | "industry_typical" | "admin_added" | "promoted_from_denial";

const PAYOR_FILTERS: { value: PayorFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "bpjs", label: "BPJS" },
  { value: "pru", label: "Prudential" },
  { value: "aia", label: "AIA" },
];

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "documentation", label: "Documentation" },
  { value: "financial", label: "Financial" },
  { value: "process", label: "Process" },
];

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "extracted", label: "Extracted" },
  { value: "industry_typical", label: "Industry typical" },
  { value: "admin_added", label: "Admin added" },
  { value: "promoted_from_denial", label: "Promoted" },
];

const SOURCE_TONE: Record<string, "champagne" | "neutral" | "info" | "good"> = {
  extracted: "champagne",
  industry_typical: "neutral",
  admin_added: "info",
  promoted_from_denial: "good",
};

const SOURCE_LABEL: Record<string, string> = {
  extracted: "Extracted",
  industry_typical: "Industry typical",
  admin_added: "Admin added",
  promoted_from_denial: "Promoted",
};

const CATEGORY_TONE: Record<string, "champagne" | "good" | "violet"> = {
  documentation: "champagne",
  financial: "good",
  process: "violet",
};

const CATEGORY_ORDER: Record<string, number> = {
  documentation: 0,
  financial: 1,
  process: 2,
};

export function PayorRulesTable() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [payors, setPayors] = useState<Payor[]>([]);
  const [payorFilter, setPayorFilter] = useState<PayorFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  async function fetchRules() {
    const rows = await query<Rule>(
      `SELECT r.*, py.name AS payor_name, py.color AS payor_color
         FROM payor_rules r
         JOIN payors py ON py.id = r.payor_id`,
    );
    setRules(rows);
  }

  useEffect(() => {
    fetchRules();
    query<Payor>("SELECT id, name, color FROM payors ORDER BY name").then(setPayors);
  }, []);

  const filtered = useMemo(() => {
    const out = rules.filter((r) => {
      if (payorFilter !== "all" && r.payor_id !== payorFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (sourceFilter !== "all" && r.source_confidence !== sourceFilter) return false;
      return true;
    });
    out.sort((a, b) => {
      const ca = CATEGORY_ORDER[a.category] ?? 99;
      const cb = CATEGORY_ORDER[b.category] ?? 99;
      if (ca !== cb) return ca - cb;
      return b.lift_pct - a.lift_pct;
    });
    return out;
  }, [rules, payorFilter, categoryFilter, sourceFilter]);

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <Panel tone="raised" className="flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterRow label="Payor" options={PAYOR_FILTERS} value={payorFilter} onChange={setPayorFilter} />
          <FilterRow label="Category" options={CATEGORY_FILTERS} value={categoryFilter} onChange={setCategoryFilter} />
          <FilterRow label="Source" options={SOURCE_FILTERS} value={sourceFilter} onChange={setSourceFilter} />
          <div className="ml-auto">
            <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>
              <Plus size={12} />
              Add admin rule
            </Button>
          </div>
        </div>
      </Panel>

      {/* Table */}
      <Panel tone="raised" className="overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-12 gap-2 border-b border-line-soft bg-[var(--color-canvas-deep)]/40 px-4 py-2 font-mono-tight text-[10px] uppercase tracking-wider text-ink-faint">
          <div className="col-span-1">ID</div>
          <div className="col-span-1">Payor</div>
          <div className="col-span-1">Category</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Threshold</div>
          <div className="col-span-1">Source</div>
          <div className="col-span-1 text-right">Evidence</div>
          <div className="col-span-1 text-right">Lift</div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center px-4 py-10">
            <div className="font-mono-tight text-[11px] text-ink-faint">
              No rules match the current filters.
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((r, i) => {
              const expanded = expandedId === r.id;
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.015 * i }}
                  className="border-t border-[var(--color-line-soft)]/60 first:border-t-0"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : r.id)}
                    className={cn(
                      "grid w-full grid-cols-12 items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-panel-2)]/30",
                      expanded && "bg-[var(--color-panel-2)]/40",
                    )}
                  >
                    <span className="col-span-1 truncate font-mono-tight text-[10.5px] text-ink-faint" title={r.id}>
                      {r.id}
                    </span>
                    <span className="col-span-1 flex items-center gap-1.5 truncate">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: r.payor_color }}
                      />
                      <span className="truncate font-mono-tight text-[10.5px] text-ink-mute uppercase">
                        {r.payor_name.split(" ")[0]}
                      </span>
                    </span>
                    <span className="col-span-1">
                      <Pill tone={CATEGORY_TONE[r.category] ?? "neutral"} size="xs" className="capitalize">
                        {r.category}
                      </Pill>
                    </span>
                    <span className="col-span-4 truncate text-[12.5px] text-ink-soft" title={r.description}>
                      {r.description}
                    </span>
                    <span
                      className="col-span-2 truncate font-mono-tight text-[11px] text-ink-mute tabular-nums"
                      title={r.threshold_value ?? ""}
                    >
                      {r.threshold_value ?? "—"}
                    </span>
                    <span className="col-span-1">
                      <Pill tone={SOURCE_TONE[r.source_confidence] ?? "neutral"} size="xs">
                        {SOURCE_LABEL[r.source_confidence] ?? r.source_confidence}
                      </Pill>
                    </span>
                    <span className="col-span-1 text-right font-mono-tight text-[11px] text-ink-mute tabular-nums">
                      {r.evidence_threads}
                    </span>
                    <span className="col-span-1 flex items-center justify-end gap-1 font-mono-tight text-[11px] tabular-nums text-[var(--color-emerald)]">
                      +{(r.lift_pct * 100).toFixed(1)}%
                      <ChevronDown
                        size={11}
                        className={cn("text-ink-faint transition-transform", expanded && "rotate-180")}
                      />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden bg-[var(--color-canvas-deep)]/40"
                      >
                        <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 font-mono-tight text-[11px]">
                          {r.evidence_url ? (
                            <a
                              href={r.evidence_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[var(--color-azure)] hover:underline"
                            >
                              <ExternalLink size={11} />
                              Evidence URL
                            </a>
                          ) : (
                            <span className="text-ink-faint">No evidence URL</span>
                          )}
                          <span className="text-ink-faint">
                            Added by · <span className="text-ink-mute">{r.added_by ?? "—"}</span>
                          </span>
                          {r.drg_pattern && (
                            <span className="text-ink-faint">
                              DRG · <span className="text-ink-mute">{r.drg_pattern}</span>
                            </span>
                          )}
                          {r.kind && (
                            <span className="text-ink-faint">
                              Kind · <span className="text-ink-mute">{r.kind}</span>
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </Panel>

      <AddRuleModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        payors={payors}
        onSaved={async () => {
          setAddOpen(false);
          await fetchRules();
        }}
      />
    </div>
  );
}

function FilterRow<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="eyebrow shrink-0">{label}</span>
      <div className="flex flex-wrap items-center gap-1">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                "h-7 rounded-full border px-3 text-[12px] font-medium tracking-tight transition-colors",
                active
                  ? "border-[var(--color-champagne)]/50 bg-[var(--color-champagne)]/15 text-[var(--color-champagne)]"
                  : "border-line-soft bg-[var(--color-canvas-deep)]/60 text-ink-mute hover:text-ink-soft",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddRuleModal({
  open, onClose, payors, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  payors: Payor[];
  onSaved: () => void;
}) {
  const [payorId, setPayorId] = useState<string>(payors[0]?.id ?? "bpjs");
  const [category, setCategory] = useState<"documentation" | "financial" | "process">("documentation");
  const [description, setDescription] = useState("");
  const [thresholdValue, setThresholdValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-anchor default payor when payors load post-mount
  useEffect(() => {
    if (payors.length > 0 && !payors.some((p) => p.id === payorId)) {
      setPayorId(payors[0].id);
    }
  }, [payors, payorId]);

  function reset() {
    setPayorId(payors[0]?.id ?? "bpjs");
    setCategory("documentation");
    setDescription("");
    setThresholdValue("");
  }

  async function save() {
    if (!description.trim() || !payorId) return;
    setSaving(true);
    try {
      const id = `admin-${Date.now().toString(36)}`;
      await exec(
        `INSERT INTO payor_rules
          (id, payor_id, category, kind, drg_pattern, description, threshold_value,
           source_confidence, evidence_url, evidence_threads, lift_pct, added_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          payorId,
          category,
          category, // kind back-compat
          "*",
          description.trim(),
          thresholdValue.trim() || null,
          "admin_added",
          "",
          0,
          0.05,
          "YOU",
        ],
      );
      reset();
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={560}>
      <div className="flex flex-col">
        <div className="border-b border-line-soft px-5 py-3">
          <div className="eyebrow">New rule</div>
          <div className="font-display text-[18px] tracking-tight text-ink">Add admin rule</div>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <Field label="Payor">
            <select
              value={payorId}
              onChange={(e) => setPayorId(e.target.value)}
              className="h-9 w-full rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/60 px-3 text-[12.5px] text-ink focus:border-[var(--color-champagne)]/50 focus:outline-none"
            >
              {payors.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="h-9 w-full rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/60 px-3 text-[12.5px] text-ink focus:border-[var(--color-champagne)]/50 focus:outline-none"
            >
              <option value="documentation">Documentation</option>
              <option value="financial">Financial</option>
              <option value="process">Process</option>
            </select>
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What does this rule say?"
              className="block w-full resize-none rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/60 px-3 py-2 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-[var(--color-champagne)]/50 focus:outline-none"
            />
          </Field>
          <Field label="Threshold value">
            <input
              type="text"
              value={thresholdValue}
              onChange={(e) => setThresholdValue(e.target.value)}
              placeholder="e.g. 12 months PED, MRI mandatory pre-op"
              className="h-9 w-full rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/60 px-3 text-[12.5px] text-ink placeholder:text-ink-faint focus:border-[var(--color-champagne)]/50 focus:outline-none"
            />
          </Field>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line-soft bg-[var(--color-canvas-deep)]/40 px-5 py-3">
          <Button size="sm" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            size="sm"
            variant="primary"
            onClick={save}
            disabled={saving || !description.trim()}
          >
            {saving ? "Saving…" : "Save rule"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
