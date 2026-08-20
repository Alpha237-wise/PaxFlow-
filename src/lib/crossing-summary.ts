// Totaux TM/CC et répartition par département/compagnie —
// docs/cahier-des-charges.md §4.3/§8.1/UC6. Pure function, no Dexie/React
// dependency, so it's directly reusable by the WhatsApp summary (§21 step
// 11) and the manifest (§21 step 12) without recomputing this logic twice.

export interface GroupCount {
  label: string;
  count: number;
}

export interface CrossingSummary {
  totalTM: number;
  totalCC: number;
  tmByDepartment: GroupCount[];
  ccByGroup: GroupCount[];
}

export interface PassengerForSummary {
  classification_final: "TM" | "CC";
  department: string | null;
  company_name: string | null;
}

function normalize(value: string | null): string {
  return (value ?? "").trim();
}

// TM is always grouped by department alone (§8.1: "7fnb", "3Eng"...).
function tmGroupLabel(p: PassengerForSummary): string {
  return normalize(p.department) || "—";
}

// CC combines department + company when both are set ("Kit/UHS"), or falls
// back to whichever one is present ("Valet" alone has no department) —
// confirmed against the real WhatsApp example, docs/cahier-des-charges.md §4.1.
function ccGroupLabel(p: PassengerForSummary): string {
  const department = normalize(p.department);
  const company = normalize(p.company_name);
  if (department && company) return `${department}/${company}`;
  return company || department || "—";
}

// Groups are merged case-insensitively (§4.3) but displayed using the
// casing of the first occurrence, rather than forcing a canonical case.
function groupAndCount(
  passengers: PassengerForSummary[],
  labelFor: (p: PassengerForSummary) => string,
): GroupCount[] {
  const groups = new Map<string, GroupCount>();
  for (const p of passengers) {
    const label = labelFor(p);
    const key = label.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { label, count: 1 });
    }
  }
  return Array.from(groups.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}

export function summarizeCrossing(
  passengers: PassengerForSummary[],
): CrossingSummary {
  const tm = passengers.filter((p) => p.classification_final === "TM");
  const cc = passengers.filter((p) => p.classification_final === "CC");
  return {
    totalTM: tm.length,
    totalCC: cc.length,
    tmByDepartment: groupAndCount(tm, tmGroupLabel),
    ccByGroup: groupAndCount(cc, ccGroupLabel),
  };
}
