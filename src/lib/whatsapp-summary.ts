// Résumé WhatsApp — docs/cahier-des-charges.md §8.1. ONE message since
// 2026-10-14 (was two separate messages, decision of 2026-08-20): the
// header block, then the TM-by-department group, then the CC group, each
// separated by a blank line.
//
// The header's exact line order/format was revised by the project owner on
// 2026-08-20, overriding the format originally matched against the real
// reference screenshot (docs/reference/whatsapp-summary-example.jpg —
// that photo still governs the department groups' content).
import { summarizeCrossing, type PassengerForSummary } from "./crossing-summary";

export interface WhatsAppSummaryInput {
  portOfOrigin: string | null;
  destination: string | null;
  timeOfDeparture: string | null;
  marineHostess: string | null;
  captainOnBoard: string | null;
  totalGuests: number | null;
  // false for boats that carry no guests (BIRD 9/10): the "<n>guests" line
  // is left out entirely. Defaults to true (line always shown, even at 0).
  includeGuestsLine?: boolean;
  vesselName: string;
  passengers: PassengerForSummary[];
}

export interface WhatsAppSummary {
  message: string;
}

// "BIRD 1" -> "B1" (§6 note); anything else (a custom vessel_name_override)
// passes through unchanged. No longer used by the summary itself (the
// merged message's header already carries the compact vessel name).
export function abbreviateVesselName(name: string): string {
  const match = /^BIRD\s+(\d+)$/i.exec(name.trim());
  return match ? `B${match[1]}` : name;
}

// "BIRD 1" -> "BIRD1" (the header's own vessel format — no abbreviation,
// just the space removed). Distinct from abbreviateVesselName above.
function vesselNameCompact(name: string): string {
  return name.replace(/\s+/g, "");
}

// "07:00" -> "0700hrs"; blank if no time is set yet.
function formatDepartureTime(time: string | null): string {
  if (!time) return "";
  return `${time.replace(":", "")}hrs`;
}

export function buildWhatsAppSummary(input: WhatsAppSummaryInput): WhatsAppSummary {
  const summary = summarizeCrossing(input.passengers);

  // The "Mh <name>" line exists only when a Marine Hostess was entered for
  // this crossing — no empty line or placeholder otherwise (any vessel).
  const marineHostess = input.marineHostess?.trim();

  const header = [
    vesselNameCompact(input.vesselName),
    `Dep@:${formatDepartureTime(input.timeOfDeparture)}`,
    `${input.portOfOrigin ?? ""} to ${input.destination ?? ""}`,
    `${summary.totalTM}TM`,
    `${summary.totalCC}CC`,
    ...(input.includeGuestsLine === false ? [] : [`${input.totalGuests ?? 0}guests`]),
    ...(marineHostess ? [`Mh ${marineHostess}`] : []),
    `Capt ${input.captainOnBoard ?? ""} team`,
  ].join("\n");

  // "<count>- <label>" for both groups (format corrected by the project
  // owner 2026-10-14). The label is injected exactly as entered/combined by
  // crossing-summary.ts (e.g. "Eng/Qsp") — never reformatted here.
  const tmLines = summary.tmByDepartment.map((g) => `${g.count}- ${g.label}`);
  const ccLines = summary.ccByGroup.map((g) => `${g.count}- ${g.label}`);

  // A group with no passengers is skipped along with its blank line, so an
  // empty crossing doesn't end in stray blank lines.
  const sections = [header];
  if (tmLines.length > 0) sections.push(tmLines.join("\n"));
  if (ccLines.length > 0) sections.push(ccLines.join("\n"));

  return { message: sections.join("\n\n") };
}
