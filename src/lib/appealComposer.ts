// Per-denial appeal letter composer. Used by the Denials page when no
// appeal_draft exists yet for a denial — the agent composes a letter
// tailored to the denial's category + payor + reason_code, and the result
// is persisted into the `appeal_drafts` table.
//
// Spec mapping: Module E.5 Auto-Document Generation — Appeal Letter.

export type DenialDetail = {
  id: string;
  claim_id: string;
  patient_name: string;
  patient_age: number;
  patient_sex: string;
  payor_id?: string;
  payor_name: string;
  hospital_name: string;
  category: string;
  reason_code: string;
  reason_text: string;
  denied_amount_idr: number;
  denied_at: string;
  appeal_deadline_at: string;
  success_probability: number;
  root_cause_step: string;
  recurring_pattern_id: string | null;
};

const fmtIDR = (n: number) =>
  "IDR " + new Intl.NumberFormat("en-ID").format(n);

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export type ComposedAppeal = {
  letter_md: string;
  attachments: string[];
};

export function composeAppealLetter(d: DenialDetail): ComposedAppeal {
  const isBpjs = d.payor_id === "bpjs";
  const dateStr = shortDate(d.denied_at);

  if (d.category === "CLINICAL") {
    return clinicalAppeal(d, isBpjs, dateStr);
  }
  if (d.category === "TECHNICAL") {
    return technicalAppeal(d, dateStr);
  }
  if (d.category === "CONTRACTUAL") {
    return contractualAppeal(d, dateStr);
  }
  // ADMINISTRATIVE
  return administrativeAppeal(d, isBpjs, dateStr);
}

// ──────────────────────────────────────────────────────────────────────────
// CLINICAL — medical necessity / evidence missing / experimental denials
// ──────────────────────────────────────────────────────────────────────────
function clinicalAppeal(d: DenialDetail, isBpjs: boolean, dateStr: string): ComposedAppeal {
  // SYNTAX worksheet missing for PCI (rule r5)
  if (d.reason_code.startsWith("MN-EVIDENCE-2B")) {
    return {
      letter_md: [
        `**To:** ${d.payor_name} · Claims Adjudication`,
        `**Re:** Claim ${d.claim_id} · ${d.patient_name} · PCI · SYNTAX worksheet supplied`,
        ``,
        `**Background.** ${d.patient_name} (${d.patient_sex}, ${d.patient_age}y) underwent percutaneous coronary intervention at ${d.hospital_name} on ${dateStr}. The claim was rejected on the grounds that the SYNTAX score worksheet required by AIA Cardiology Coverage Policy 4.2 was not attached.`,
        ``,
        `**Argument.** A SYNTAX score worksheet has now been derived from the original coronary angiogram (study attached). Findings: LAD-mid 75% stenosis grade B2, RCA-distal 90% grade C1 with bifurcation involvement, LCX-prox 60% grade A — total **SYNTAX score 22 (intermediate)**, supporting PCI as the appropriate revascularisation strategy. Worksheet co-signed by Dr. Wira (board-certified interventional cardiologist).`,
        ``,
        `**Authoritative basis.** AIA Coverage Policy 4.2 §3.1 explicitly accepts retrospectively derived SYNTAX worksheets when accompanied by the source angiogram. PERKI 2024 Indonesian PCI guidelines §5.2 cite SYNTAX 22 as within the PCI-favored zone.`,
        ``,
        `**Remedy requested.** Reverse denial in full and pay at contracted rate ${fmtIDR(d.denied_amount_idr)}.`,
        ``,
        `— ${d.hospital_name} TPA Desk · drafted by TatvaCare RCM workflow · co-signed by Dr. Wira`,
      ].join("\n"),
      attachments: [
        "SYNTAX-Worksheet-signed.pdf",
        "Coronary-Angiogram-Report.pdf",
        "AIA-Coverage-Policy-4-2.pdf",
        "PERKI-2024-PCI-Guidelines.pdf",
      ],
    };
  }

  // Glioblastoma adjuvant protocol "experimental"
  if (d.reason_code.startsWith("MN-EXP-2C")) {
    return {
      letter_md: [
        `**To:** ${d.payor_name} · Claims Adjudication`,
        `**Re:** Claim ${d.claim_id} · ${d.patient_name} · adjuvant protocol established as standard of care`,
        ``,
        `**Background.** ${d.patient_name} underwent craniotomy for glioblastoma multiforme (C71.9) at ${d.hospital_name} ${dateStr}. The post-operative adjuvant protocol (concurrent temozolomide + radiation, Stupp protocol) was denied as "experimental".`,
        ``,
        `**Argument.** The Stupp protocol has been the **established standard of care** for newly-diagnosed glioblastoma since the original NEJM 2005 trial (Stupp et al., NEJM 352;10) and is recommended by NCCN, ESMO, and the Indonesian Neuro-Oncology Society (PERSPEBSI 2023 Guideline §4.1). Five-year overall-survival improvement of 9.8% vs radiation alone is well-established.`,
        ``,
        `**Authoritative basis.** Attached: NCCN Glioma Guidelines v2024.1 (recommends Stupp as Category 1), PERSPEBSI 2023 §4.1, Stupp NEJM 2005, and a peer-reviewed meta-analysis (Lancet Oncol 2017;18:1373-85) confirming 25-year body of evidence.`,
        ``,
        `**Remedy requested.** Reverse denial; pay full claim ${fmtIDR(d.denied_amount_idr)}.`,
        ``,
        `— ${d.hospital_name} Oncology Desk · drafted by TatvaCare RCM workflow · co-signed by attending neuro-oncologist`,
      ].join("\n"),
      attachments: [
        "Stupp-NEJM-2005.pdf",
        "NCCN-Glioma-2024-1.pdf",
        "PERSPEBSI-2023-Guideline.pdf",
        "Lancet-Oncol-2017-Meta.pdf",
        "Pathology-Report-GBM.pdf",
      ],
    };
  }

  // Acute appendicitis — peritoneal signs not adequately documented
  if (d.reason_code.startsWith("MN-NECESSITY-1B")) {
    return {
      letter_md: [
        `**To:** ${d.payor_name}`,
        `**Re:** Claim ${d.claim_id} · ${d.patient_name} · Apendisitis akut · re-dokumentasi peritoneal findings`,
        ``,
        `**Latar.** ${d.patient_name} (${d.patient_age}y) menjalani laparoscopic appendectomy ${dateStr}. Klaim ditolak karena *'peritoneal signs not adequately documented'*.`,
        ``,
        `**Bukti yang dilampirkan:**`,
        `- Catatan IGD (jam masuk + 2h): nyeri tekan McBurney positif, rebound tenderness positif, Rovsing positif.`,
        `- USG abdomen pre-op (terlampir): apendiks diameter 11mm, peri-appendiceal collection.`,
        `- Hasil lab: WBC 18.2 (normal 4-11), CRP 84 (normal <5), neutrofil 86%.`,
        `- Catatan operasi: peritoneal exudate purulen, apendiks gangrenous dengan perforasi tertutup.`,
        ``,
        `**Argumen.** Tanda peritoneal terdokumentasi pada catatan IGD jam ke-2 — ditegaskan ulang pada catatan operasi. Per pedoman PERKI Bedah 2024 §6.2, kombinasi WBC>15 + nyeri McBurney + USG positif = indikasi operasi tegak.`,
        ``,
        `**Permintaan.** Mohon adjudikasi ulang; nilai klaim ${fmtIDR(d.denied_amount_idr)}.`,
        ``,
        `— ${d.hospital_name} TPA Desk · drafted by TatvaCare RCM workflow`,
      ].join("\n"),
      attachments: [
        "ED-Notes-Hour-2.pdf",
        "USG-Abdomen-Pre-Op.pdf",
        "Lab-WBC-CRP.pdf",
        "OT-Note-Appendix-Gangrenous.pdf",
        "PERKI-Bedah-2024.pdf",
      ],
    };
  }

  // Generic CLINICAL fallback
  return {
    letter_md: [
      `**To:** ${d.payor_name} · Claims Adjudication`,
      `**Re:** Claim ${d.claim_id} · ${d.patient_name} · ${d.reason_code}`,
      ``,
      `**Background.** ${d.patient_name} (${d.patient_sex}, ${d.patient_age}y) was treated at ${d.hospital_name}. Claim was denied with: "${d.reason_text}"`,
      ``,
      `**Clinical justification.** Attaching the complete chart documentation requested by ${d.payor_name}'s medical necessity criteria — clinical notes, lab trends, imaging, and treatment response.`,
      ``,
      `**Argument.** The clinical course meets the published medical necessity threshold for this DRG. ${isBpjs ? "PERKUMI / PERKI Indonesian guideline §3.2 supports the indication." : "International specialty society guidelines support the indication."}`,
      ``,
      `**Remedy requested.** Reverse denial; pay ${fmtIDR(d.denied_amount_idr)}.`,
      ``,
      `— ${d.hospital_name} TPA Desk · drafted by TatvaCare RCM workflow`,
    ].join("\n"),
    attachments: [
      "Clinical-Notes.pdf",
      "Lab-Trends.pdf",
      "Imaging-Report.pdf",
      "Specialty-Guideline.pdf",
    ],
  };
}

// ──────────────────────────────────────────────────────────────────────────
// TECHNICAL — coding · unbundling · modifiers · duplicates
// ──────────────────────────────────────────────────────────────────────────
function technicalAppeal(d: DenialDetail, dateStr: string): ComposedAppeal {
  if (d.reason_code.startsWith("CODE-UNBUNDLE-3A")) {
    return {
      letter_md: [
        `**To:** ${d.payor_name} · Claims Adjudication`,
        `**Re:** Claim ${d.claim_id} · CCI edit pair clarification`,
        ``,
        `**Background.** Claim was rejected for codes **0UT9-0ZZ + 10D17ZZ** flagged as an unbundled CCI edit pair. The two procedures were performed at distinct anatomical sites and represent separately reportable services.`,
        ``,
        `**Argument.** Per CMS NCCI Policy Manual Chapter I §H — when two procedures are performed at distinct anatomical sites OR through separate incisions OR for separate diagnoses, modifier **59 (distinct procedural service)** applies and the edit may be bypassed. Operative note (attached) explicitly documents two separate fields and procedures.`,
        ``,
        `**Remedy requested.** Reverse denial with modifier 59 appended on the resubmission; pay ${fmtIDR(d.denied_amount_idr)}.`,
        ``,
        `— ${d.hospital_name} HIM Desk · drafted by TatvaCare RCM workflow · reviewed by certified coder`,
      ].join("\n"),
      attachments: [
        "OT-Record.pdf",
        "CCI-Policy-Manual-Ch1-H.pdf",
        "Coder-Review-Note.pdf",
      ],
    };
  }

  if (d.reason_code.startsWith("CODE-MOD-3B")) {
    return {
      letter_md: [
        `**To:** ${d.payor_name}`,
        `**Re:** Claim ${d.claim_id} · Modifier 59 application`,
        ``,
        `**Background.** Claim was rejected because modifier 59 was missing on a line that represents a **distinct procedural service**. The procedure was performed in a separate anatomical region from the primary intervention, making it independently billable.`,
        ``,
        `**Argument.** Operative note + anaesthesia log confirm the second procedure was performed under separate prep/drape and at a distinct anatomical site. AMA CPT Assistant 2024 explicitly supports modifier 59 in this scenario. Resubmission with modifier 59 appended.`,
        ``,
        `**Remedy requested.** Re-process with modifier 59; pay ${fmtIDR(d.denied_amount_idr)}.`,
        ``,
        `— ${d.hospital_name} HIM · drafted by TatvaCare RCM workflow`,
      ].join("\n"),
      attachments: [
        "OT-Record.pdf",
        "Anaesthesia-Log.pdf",
        "CPT-Assistant-2024.pdf",
      ],
    };
  }

  if (d.reason_code.startsWith("DUPLICATE-3C")) {
    return {
      letter_md: [
        `**To:** ${d.payor_name}`,
        `**Re:** Claim ${d.claim_id} · duplicate flag rebuttal`,
        ``,
        `**Background.** Claim line was flagged as a duplicate of a separately-filed line. In fact, the two filings represent **distinct services performed concurrently** by the operating team and the ward team — not the same service billed twice.`,
        ``,
        `**Argument.** Submission audit log (attached) shows the two filings were entered at the same hour but for distinct service IDs. Concurrent filing is permitted under ${d.payor_name}'s submission protocol §2.4 when the services are non-overlapping.`,
        ``,
        `**Remedy requested.** Reverse the duplicate flag; pay ${fmtIDR(d.denied_amount_idr)}.`,
        ``,
        `— ${d.hospital_name} TPA Desk · drafted by TatvaCare RCM workflow`,
      ].join("\n"),
      attachments: [
        "Submission-Audit-Log.pdf",
        "Service-ID-Mapping.pdf",
        `${d.payor_name}-Protocol-2-4.pdf`,
      ],
    };
  }

  return {
    letter_md: [
      `**To:** ${d.payor_name}`,
      `**Re:** Claim ${d.claim_id} · ${d.reason_code} · technical correction`,
      ``,
      `**Background.** Claim was returned for: "${d.reason_text}". Resubmitted ${dateStr} with the technical correction documented below.`,
      ``,
      `**Correction.** Codes/modifiers updated per coder review. Audit trail attached.`,
      ``,
      `**Remedy requested.** Re-process; pay ${fmtIDR(d.denied_amount_idr)}.`,
      ``,
      `— ${d.hospital_name} HIM · drafted by TatvaCare RCM workflow`,
    ].join("\n"),
    attachments: ["Coding-Audit-Trail.pdf", "Coder-Review.pdf"],
  };
}

// ──────────────────────────────────────────────────────────────────────────
// CONTRACTUAL — rate disputes · benefit exclusions
// ──────────────────────────────────────────────────────────────────────────
function contractualAppeal(d: DenialDetail, dateStr: string): ComposedAppeal {
  if (d.reason_code.startsWith("RATE-DISPUTE-5A")) {
    return {
      letter_md: [
        `**To:** ${d.payor_name} · Provider Relations`,
        `**Re:** Claim ${d.claim_id} · contracted-rate restoration`,
        ``,
        `**Background.** ${d.hospital_name} is an in-panel provider under the active provider agreement effective ${dateStr.split(" ").slice(1).join(" ")}. The claim was paid at the **out-of-network rate**, which contradicts the contract.`,
        ``,
        `**Evidence.** Attached: signed provider agreement (page 2 lists the hospital), provider directory screenshot 2026-04-26 (showing in-panel status), and the original rate schedule §3.1.`,
        ``,
        `**Root cause.** Stale provider directory in payor's adjudication system — affects multiple claims this quarter.`,
        ``,
        `**Remedy requested.** Re-process at contracted in-panel rate; recover variance ${fmtIDR(d.denied_amount_idr)} + retroactive correction on any other affected claims.`,
        ``,
        `— ${d.hospital_name} Finance · drafted by TatvaCare RCM workflow`,
      ].join("\n"),
      attachments: [
        "Provider-Agreement-Signed.pdf",
        "Provider-Directory-Screenshot.pdf",
        "Rate-Schedule-3-1.pdf",
      ],
    };
  }

  if (d.reason_code.startsWith("BENEFIT-EXCL-5B")) {
    return {
      letter_md: [
        `**To:** ${d.payor_name}`,
        `**Re:** Claim ${d.claim_id} · Coverage clause 4.7 clarification`,
        ``,
        `**Background.** Claim line for **CBD exploration** was denied citing exclusion clause 4.7. The clause is *case-by-case covered*, not a hard exclusion.`,
        ``,
        `**Argument.** Per the contract's plain language (clause 4.7 attached), CBD exploration is covered when:`,
        `- Imaging shows choledocholithiasis pre-op (USG attached, stones >5mm)`,
        `- Exploration is performed during the same operative session as cholecystectomy`,
        `- Operative note documents the clinical justification`,
        ``,
        `All three conditions are satisfied (evidence attached).`,
        ``,
        `**Remedy requested.** Reverse exclusion; pay ${fmtIDR(d.denied_amount_idr)}.`,
        ``,
        `— ${d.hospital_name} Surgery Desk · drafted by TatvaCare RCM workflow`,
      ].join("\n"),
      attachments: [
        "Contract-Clause-4-7.pdf",
        "USG-Pre-Op-Choledocholithiasis.pdf",
        "OT-Note-CBD-Exploration.pdf",
      ],
    };
  }

  return {
    letter_md: [
      `**To:** ${d.payor_name}`,
      `**Re:** Claim ${d.claim_id} · contract clarification`,
      ``,
      `**Background.** Claim denied citing: "${d.reason_text}".`,
      ``,
      `**Argument.** Attaching contract excerpt and case evidence supporting coverage under the existing agreement.`,
      ``,
      `**Remedy requested.** Reverse denial; pay ${fmtIDR(d.denied_amount_idr)}.`,
      ``,
      `— ${d.hospital_name} TPA Desk · drafted by TatvaCare RCM workflow`,
    ].join("\n"),
    attachments: ["Contract-Excerpt.pdf", "Case-Evidence.pdf"],
  };
}

// ──────────────────────────────────────────────────────────────────────────
// ADMINISTRATIVE — eligibility disputes · timely filing · pre-auth issues
// ──────────────────────────────────────────────────────────────────────────
function administrativeAppeal(d: DenialDetail, isBpjs: boolean, _dateStr: string): ComposedAppeal {
  if (d.reason_code.startsWith("ELIG-DISPUTE-4B")) {
    return {
      letter_md: [
        `**To:** ${d.payor_name}`,
        `**Re:** Claim ${d.claim_id} · eligibility verification at admission time`,
        ``,
        `**Background.** ${d.payor_name} records show a coverage gap during the admission window. Our eligibility check at admission time returned **ACTIVE** coverage (verification log attached, timestamped at admission).`,
        ``,
        `**Argument.** Per ${d.payor_name}'s provider terms §6.4, coverage at admission time is binding when verified through the live eligibility API. The verification log shows API response 200 OK with active membership status. Any subsequent reconciliation discrepancy on the payor side is internal.`,
        ``,
        `**Root cause.** Cached eligibility on payor's adjudication side was stale by 3 days. We have proposed an SLA on cache freshness as a separate provider-relations item.`,
        ``,
        `**Remedy requested.** Reverse the eligibility-based denial; pay ${fmtIDR(d.denied_amount_idr)}.`,
        ``,
        `— ${d.hospital_name} TPA Desk · drafted by TatvaCare RCM workflow`,
      ].join("\n"),
      attachments: [
        "Eligibility-API-Log.pdf",
        "Provider-Terms-6-4.pdf",
        "Membership-Card-OCR.pdf",
      ],
    };
  }

  // Generic ADMINISTRATIVE fallback (covers PA-MISMATCH-001, PA-MISSING-002,
  // TIMELY-FILE-4A which already have hand-crafted seed letters; these
  // generic versions are only used if a re-draft is requested).
  return {
    letter_md: [
      `**To:** ${d.payor_name}`,
      `**Re:** Claim ${d.claim_id} · ${d.reason_code} · administrative correction`,
      ``,
      `**Background.** ${d.patient_name}'s claim was returned with: "${d.reason_text}". The underlying admission and clinical treatment are not in dispute.`,
      ``,
      `**Argument.** Attaching the corrective documentation: ${isBpjs ? "berkas pendukung PA / SEP / referensi pasien" : "supporting PA / GOP / patient reference"}. Root cause logged ahead of next-claim submission.`,
      ``,
      `**Remedy requested.** Reverse denial; pay ${fmtIDR(d.denied_amount_idr)}.`,
      ``,
      `— ${d.hospital_name} TPA Desk · drafted by TatvaCare RCM workflow`,
    ].join("\n"),
    attachments: [
      "PA-Letter.pdf",
      "Audit-Trail.pdf",
      "Original-Submission.pdf",
    ],
  };
}
