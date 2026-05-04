import { Mail, Paperclip, Lock, Send, FileText, Globe } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Pill } from "@/components/ui/Pill";
import type { SubmissionChannel } from "@/lib/submission";
import type { Artifact } from "@/lib/agent";

// Channel-aware "what was sent" overlay. Three layouts:
//   rest_api     → developer-style request inspector (BPJS V-Claim)
//   email        → email client preview (AIA portal + email cover)
//   portal_upload → portal upload card (Allianz bundle)
export function PayloadOverlay({
  open,
  onClose,
  channel,
  artifacts,
  patientName,
}: {
  open: boolean;
  onClose: () => void;
  channel: SubmissionChannel | null;
  artifacts: Artifact[];
  patientName?: string;
}) {
  if (!channel) return null;
  return (
    <Drawer open={open} onClose={onClose} width={680} level={2}>
      {channel.kind === "rest_api" ? (
        <RestApiView channel={channel} artifacts={artifacts} />
      ) : channel.kind === "email" ? (
        <EmailView channel={channel} artifacts={artifacts} patientName={patientName} />
      ) : (
        <PortalView channel={channel} artifacts={artifacts} />
      )}
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// REST API (BPJS V-Claim) — request inspector
// ─────────────────────────────────────────────────────────────────────────
function RestApiView({ channel, artifacts }: { channel: SubmissionChannel; artifacts: Artifact[] }) {
  const [verb, ...rest] = channel.endpoint_path.split(" ");
  const path = rest.join(" ");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line-soft px-6 pt-5 pb-4 pr-12">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Globe size={11} className="text-ink-faint" />
            <span className="eyebrow">Outgoing API request</span>
          </div>
          <h2 className="mt-1 font-display text-[18px] tracking-tight text-ink">{channel.label}</h2>
          <div className="mt-0.5 flex items-center gap-2 font-mono-tight text-[11px] text-ink-faint">
            <Lock size={10} /> {channel.format}
          </div>
        </div>
        <Pill tone="good" dot size="sm">200 OK · {channel.ack_id}</Pill>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">
        {/* Endpoint line */}
        <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/60 px-3 py-2.5">
          <div className="flex items-center gap-2 font-mono-tight text-[11.5px]">
            <span className="rounded-sm bg-[var(--color-emerald)]/15 px-1.5 py-0.5 text-[var(--color-emerald)]">{verb}</span>
            <span className="text-ink">https://{channel.endpoint_host}{path}</span>
          </div>
        </div>

        {/* Headers */}
        <div className="mt-4">
          <div className="eyebrow">Headers</div>
          <table className="mt-1.5 w-full font-mono-tight text-[11px]">
            <tbody>
              <HeaderRow k="Content-Type" v="application/json; charset=utf-8" />
              <HeaderRow k="X-Cons-ID" v="13212" />
              <HeaderRow k="X-Timestamp" v={new Date().toISOString()} />
              <HeaderRow k="X-Signature" v="HMAC-SHA256 ⋯ (256-bit)" />
              <HeaderRow k="Authorization" v="Bearer eyJhbGciOi… (TLS 1.3)" />
            </tbody>
          </table>
        </div>

        {/* Body */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Body · application/json</span>
            <span className="font-mono-tight text-[10px] text-ink-faint">{channel.payload.length} bytes</span>
          </div>
          <pre className="mt-1.5 overflow-x-auto rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/70 px-4 py-3 font-mono-tight text-[11.5px] leading-relaxed text-ink-soft">
{channel.payload}
          </pre>
        </div>

        {/* Response */}
        <div className="mt-4">
          <div className="eyebrow">Response · 200 OK</div>
          <pre className="mt-1.5 overflow-x-auto rounded-md border border-[var(--color-emerald)]/30 bg-[var(--color-emerald)]/[0.04] px-4 py-3 font-mono-tight text-[11.5px] leading-relaxed text-ink-soft">
{`{
  "status":   "RECEIVED",
  "ack_id":   "${channel.ack_id}",
  "ts":       "${new Date().toISOString()}",
  "queue":    "adjudication",
  "sla_days": ${channel.sla_days}
}`}
          </pre>
        </div>

        {/* Attachments */}
        {artifacts.length > 0 && (
          <div className="mt-4">
            <div className="eyebrow">Attachments referenced in body · {artifacts.length}</div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {artifacts.map((a) => <ArtifactChip key={a.id} a={a} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// EMAIL (AIA + email cover) — email client preview
// ─────────────────────────────────────────────────────────────────────────
function EmailView({ channel, artifacts, patientName }: { channel: SubmissionChannel; artifacts: Artifact[]; patientName?: string }) {
  const subject = `Claim Submission · ${patientName ?? "Patient"} · ${channel.ack_id}`;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line-soft px-6 pt-5 pb-4 pr-12">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Mail size={11} className="text-ink-faint" />
            <span className="eyebrow">Outgoing email · with portal upload</span>
          </div>
          <h2 className="mt-1 font-display text-[18px] tracking-tight text-ink">{channel.label}</h2>
          <div className="mt-0.5 font-mono-tight text-[11px] text-ink-faint">{channel.format}</div>
        </div>
        <Pill tone="good" dot size="sm">Delivered · {channel.ack_id}</Pill>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">
        {/* Email header */}
        <div className="rounded-lg border border-line-soft bg-[var(--color-canvas-deep)]/40">
          <EmailHeaderRow label="From" value="rcm-agent@cendana.id" mono />
          <EmailHeaderRow label="To" value="claims.id@aia.com" mono />
          <EmailHeaderRow label="Cc" value="utilization-mgmt@cendana.id" mono />
          <EmailHeaderRow label="Date" value={new Date().toString().slice(0, 33)} mono />
          <EmailHeaderRow label="Subject" value={subject} bold />
        </div>

        {/* Body */}
        <div className="mt-3 rounded-lg border border-line-soft bg-[var(--color-panel)]/60 px-4 py-3.5">
          <pre className="whitespace-pre-wrap font-mono-tight text-[11.5px] leading-relaxed text-ink-soft">
{channel.payload}
          </pre>
        </div>

        {/* Attachments — paperclip-style */}
        <div className="mt-3 rounded-lg border border-line-soft bg-[var(--color-canvas-deep)]/40 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Paperclip size={11} className="text-ink-faint" />
            <span className="eyebrow">Attached · 1 bundle</span>
          </div>
          <div className="mt-2 flex items-center gap-3 rounded-md border border-line-soft bg-[var(--color-panel-2)]/60 px-3 py-2">
            <FileText size={20} className="text-[var(--color-coral)]" />
            <div className="flex-1">
              <div className="text-[12.5px] text-ink">claim_packet.pdf</div>
              <div className="font-mono-tight text-[10.5px] text-ink-faint">{channel.attachments_summary}</div>
            </div>
            <span className="font-mono-tight text-[10.5px] text-ink-faint">PDF</span>
          </div>
          {artifacts.length > 0 && (
            <>
              <div className="mt-3 eyebrow">Bundle contents · {artifacts.length} files</div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {artifacts.map((a) => <ArtifactChip key={a.id} a={a} />)}
              </div>
            </>
          )}
        </div>

        {/* Delivery log */}
        <div className="mt-3 flex items-center gap-2 rounded-md border border-[var(--color-emerald)]/25 bg-[var(--color-emerald)]/[0.05] px-3 py-2 font-mono-tight text-[11px]">
          <Send size={11} className="text-[var(--color-emerald)]" />
          <span className="text-[var(--color-emerald)]">Delivered</span>
          <span className="text-ink-faint">·</span>
          <span className="text-ink-soft">portal upload returned 201 Created</span>
          <span className="text-ink-faint">·</span>
          <span className="text-ink-soft">SMTP relay confirmed receipt</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PORTAL UPLOAD (Allianz) — bundle inspector
// ─────────────────────────────────────────────────────────────────────────
function PortalView({ channel, artifacts }: { channel: SubmissionChannel; artifacts: Artifact[] }) {
  const [verb, ...rest] = channel.endpoint_path.split(" ");
  const path = rest.join(" ");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line-soft px-6 pt-5 pb-4 pr-12">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Globe size={11} className="text-ink-faint" />
            <span className="eyebrow">Provider portal · bundle upload</span>
          </div>
          <h2 className="mt-1 font-display text-[18px] tracking-tight text-ink">{channel.label}</h2>
          <div className="mt-0.5 font-mono-tight text-[11px] text-ink-faint">{channel.format}</div>
        </div>
        <Pill tone="good" dot size="sm">Uploaded · {channel.ack_id}</Pill>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">
        {/* Endpoint */}
        <div className="rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/60 px-3 py-2.5">
          <div className="flex items-center gap-2 font-mono-tight text-[11.5px]">
            <span className="rounded-sm bg-[var(--color-azure)]/15 px-1.5 py-0.5 text-[var(--color-azure)]">{verb}</span>
            <span className="text-ink">https://{channel.endpoint_host}{path}</span>
          </div>
        </div>

        {/* Bundle card — looks like a real document object */}
        <div className="mt-4 rounded-lg border border-line-soft bg-[var(--color-canvas-deep)]/40 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <FileText size={32} className="shrink-0 text-[var(--color-coral)]" />
            <div className="flex-1">
              <div className="font-display text-[14px] text-ink">claim_packet.pdf</div>
              <div className="mt-0.5 font-mono-tight text-[10.5px] text-ink-faint">{channel.attachments_summary}</div>
            </div>
            <Pill tone="good" dot size="xs">Verified</Pill>
          </div>
        </div>

        {/* Structured metadata */}
        <div className="mt-4">
          <div className="eyebrow">Structured form metadata</div>
          <pre className="mt-1.5 overflow-x-auto rounded-md border border-line-soft bg-[var(--color-canvas-deep)]/70 px-4 py-3 font-mono-tight text-[11.5px] leading-relaxed text-ink-soft">
{channel.payload}
          </pre>
        </div>

        {/* Attachments */}
        {artifacts.length > 0 && (
          <div className="mt-4">
            <div className="eyebrow">Bundle contents · {artifacts.length} files</div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {artifacts.map((a) => <ArtifactChip key={a.id} a={a} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────
function HeaderRow({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-line-soft last:border-b-0">
      <td className="w-[120px] py-1.5 pr-3 text-ink-faint align-top">{k}</td>
      <td className="py-1.5 text-ink-soft break-all">{v}</td>
    </tr>
  );
}

function EmailHeaderRow({ label, value, mono, bold }: { label: string; value: string; mono?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-line-soft px-4 py-2 last:border-b-0">
      <span className="w-[60px] shrink-0 font-mono-tight text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">{label}</span>
      <span className={`flex-1 truncate ${mono ? "font-mono-tight text-[11.5px]" : "text-[12.5px]"} ${bold ? "font-medium text-ink" : "text-ink-soft"}`}>{value}</span>
    </div>
  );
}

function ArtifactChip({ a }: { a: Artifact }) {
  return (
    <div className="flex items-center gap-2 rounded-sm border border-line-soft bg-[var(--color-panel-2)]/40 px-2 py-1.5">
      <FileText size={11} className="shrink-0 text-ink-faint" />
      <div className="flex-1 truncate">
        <div className="truncate font-mono-tight text-[10.5px] text-ink-soft">{a.label}</div>
      </div>
      {a.bytes && <span className="font-mono-tight text-[9.5px] text-ink-faint">{a.bytes}</span>}
    </div>
  );
}
