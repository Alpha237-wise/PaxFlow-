// TM / Contractor classification engine — docs/cahier-des-charges.md §4.1.
// Pure and framework-free by design: runs entirely client-side, no network
// dependency (§16.1/§16.7). The server persists what this computes; it
// never recomputes it as the sole source of truth (§12 notes).

export type Classification = "TM" | "CC";

function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

export interface ClassificationInput {
  companyIdNumber?: string | null;
  companyName?: string | null;
}

/**
 * §4.1 rule:
 * - company_id_number set            -> TM (company_name irrelevant)
 * - both blank (only department set) -> TM (Director/Manager, new joiner)
 * - company_id_number blank, company_name set -> CC (Contractor)
 */
export function classifyPassenger({
  companyIdNumber,
  companyName,
}: ClassificationInput): Classification {
  if (!isBlank(companyIdNumber)) return "TM";
  if (isBlank(companyName)) return "TM";
  return "CC";
}

export interface ResolvedClassification {
  computed: Classification;
  final: Classification;
  overridden: boolean;
}

/**
 * Combines the computed classification with an optional manual override
 * (§4.1: the AB can correct the automatic result). Both values are kept —
 * `computed` for audit (§14), `final` for actual use.
 */
export function resolveClassification(
  input: ClassificationInput,
  manualOverride?: Classification | null,
): ResolvedClassification {
  const computed = classifyPassenger(input);
  if (manualOverride && manualOverride !== computed) {
    return { computed, final: manualOverride, overridden: true };
  }
  return { computed, final: computed, overridden: false };
}
