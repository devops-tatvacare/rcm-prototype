// Per-payor submission channel definitions used by the Submission Receipt
// view + the dispatch trace steps. Each channel mirrors the spec's C.6 step 8:
// "Submission dispatched via appropriate channel (electronic/portal/paper)".
//
// BPJS  — V-Claim REST API (electronic, structured JSON)
// AIA   — Provider portal upload + email cover (semi-electronic)
// Allianz — Provider portal bundle upload (semi-electronic)

import type { AgentStep } from "./agent";

export type SubmissionChannel = {
  kind: "rest_api" | "portal_upload" | "email";
  label: string;
  endpoint_host: string;
  endpoint_path: string;
  format: string;
  payload: string;            // multiline preview
  attachments_summary: string;
  ack_id: string;             // mock acknowledgement id
  sla_days: number;
  submission_method_blurb: string;
};

type ClaimContext = {
  patient_name: string;
  policy_number: string;
  drg: string;
  dx: string;
  los_days: number;
  gross_idr: number;
  expected_reimb_idr: number;
  hospital_name: string;
};

function pad(n: number): string {
  return String(n).padStart(6, "0");
}

function ackId(prefix: string): string {
  return `${prefix}${new Date().getFullYear()}-${pad(Math.floor(Math.random() * 999999))}`;
}

function shortDx(dx: string): string {
  return dx.split(" · ")[0].split(" — ")[0];
}

export function buildChannel(payorId: string, c: ClaimContext): SubmissionChannel {
  if (payorId === "bpjs") {
    return {
      kind: "rest_api",
      label: "BPJS V-Claim REST API",
      endpoint_host: "api.bpjs-kesehatan.go.id",
      endpoint_path: "POST /vclaim/2.0/Klaim/insert",
      format: "JSON · TLS 1.3 · HMAC-SHA256",
      payload: [
        "{",
        `  "no_kartu":      "${c.policy_number}",`,
        `  "tgl_masuk":     "2026-04-29",`,
        `  "tgl_pulang":    "2026-05-03",`,
        `  "ina_cbg":       "${c.drg}",`,
        `  "diagnosa_primer":"${shortDx(c.dx)}",`,
        `  "los_hari":      ${c.los_days},`,
        `  "biaya_total":   ${c.gross_idr},`,
        `  "biaya_klaim":   ${c.expected_reimb_idr},`,
        `  "lampiran_count": 12`,
        "}",
      ].join("\n"),
      attachments_summary: "12 artifacts bundled · 4.2 MB total · MRI report, OT note, anaesthesia log + 9 more",
      ack_id: ackId("BPJS-ACK-"),
      sla_days: 2,
      submission_method_blurb:
        "Real-time REST · synchronous ack · clean-claim adjudication 24–48h.",
    };
  }
  if (payorId === "aia") {
    return {
      kind: "email",
      label: "AIA Claims Portal · email cover",
      endpoint_host: "provider.aia.co.id",
      endpoint_path: "PUT /claims/upload",
      format: "PDF bundle (12 attachments) + EML cover",
      payload: [
        `Subject: Claim Submission · ${c.patient_name} · ${c.drg}`,
        `To:      claims.id@aia.com`,
        `Cc:      utilization-mgmt@cendana.id`,
        ``,
        `Patient:    ${c.patient_name}  ·  Policy ${c.policy_number}`,
        `Diagnosis:  ${shortDx(c.dx)}`,
        `LOS:        ${c.los_days}d  ·  ${c.hospital_name}`,
        `Charges:    IDR ${(c.gross_idr / 1_000_000).toFixed(1)}M`,
        ``,
        `Bundle: claim_packet.pdf — 12 attachments · 4.6 MB`,
        `Cardiology endorsement note included as required by AIA template v3.1.`,
      ].join("\n"),
      attachments_summary: "12 artifacts inside one signed PDF · 4.6 MB · cardiology endorsement included",
      ack_id: ackId("AIA-CLM-"),
      sla_days: 3,
      submission_method_blurb:
        "Portal upload + email cover dispatched together · ack within 4h · clean-claim adjudication 2–3d.",
    };
  }
  // alli (Allianz Care)
  return {
    kind: "portal_upload",
    label: "Allianz Provider Portal",
    endpoint_host: "providers.allianz.co.id",
    endpoint_path: "PUT /claims/submit",
    format: "PDF bundle (12 attachments) · structured form metadata",
    payload: [
      `Bundle:     claim_packet.pdf — 12 attachments · 5.8 MB`,
      `Includes:   discharge summary, OT record, anaesthesia log,`,
      `            implant invoice + lot/serial, pre-auth letter,`,
      `            GOP, itemized charges, e-signature certificate.`,
      ``,
      `Patient:    ${c.patient_name}  ·  Policy ${c.policy_number}`,
      `Procedure:  ${c.drg}`,
      `LOS:        ${c.los_days}d  ·  ${c.hospital_name}`,
      `Implant ID match against PA: VERIFIED`,
    ].join("\n"),
    attachments_summary: "12 artifacts in one structured PDF bundle · 5.8 MB · implant lot verified against pre-auth",
    ack_id: ackId("ALZ-RCV-"),
    sla_days: 4,
    submission_method_blurb:
      "Allianz portal · synchronous ack · clean-claim adjudication 3–4d.",
  };
}

// The 3-step dispatch arc that streams into the agent trace after Submit.
export function buildDispatchPlan(channel: SubmissionChannel): AgentStep[] {
  return [
    {
      id: "d1",
      kind: "dispatch",
      narration: `Encrypting + signing packet · ${channel.format}. Connecting ${channel.endpoint_host} (${channel.endpoint_path}).`,
      probDelta: 0,
      ms: 900,
    },
    {
      id: "d2",
      kind: "ack",
      narration: `Acknowledgement received · ${channel.ack_id}. Payor systems have logged the claim for adjudication.`,
      probDelta: 0,
      ms: 1100,
    },
    {
      id: "d3",
      kind: "tracking",
      narration: `Status tracking armed · adjudication SLA ${channel.sla_days} days. Auto-escalation if no movement by day ${Math.ceil(channel.sla_days * 0.7)}.`,
      probDelta: 0,
      ms: 700,
    },
  ];
}

export function expectedAdjudicationDate(slaDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + slaDays);
  return d.toISOString().slice(0, 10);
}
