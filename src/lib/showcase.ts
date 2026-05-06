export const SHOWCASE_PATIENT_IDS = ["p-budi", "p-siti", "p-ravi", "p43", "p7"] as const;

const SHOWCASE_PATIENT_SET = new Set<string>(SHOWCASE_PATIENT_IDS);
const SHOWCASE_PATIENT_ORDER = new Map<string, number>(
  SHOWCASE_PATIENT_IDS.map((id, index) => [id, index]),
);

export function isShowcasePatient(id: string | null | undefined): boolean {
  return Boolean(id && SHOWCASE_PATIENT_SET.has(id));
}

export function showcasePatientOrder(id: string | null | undefined): number {
  if (!id) return Number.MAX_SAFE_INTEGER;
  return SHOWCASE_PATIENT_ORDER.get(id) ?? Number.MAX_SAFE_INTEGER;
}
