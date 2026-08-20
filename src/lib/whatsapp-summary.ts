// Résumé WhatsApp — docs/cahier-des-charges.md §8.1. Two separate messages
// (decision validated 2026-08-20).
//
// Message 1's exact line order/format was revised by the project owner on
// 2026-08-20, overriding the format originally matched against the real
// reference screenshot (docs/reference/whatsapp-summary-example.jpg —
// that photo still governs Message 2, unchanged).
import { summarizeCrossing, type PassengerForSummary } from "./crossing-summary";

export interface WhatsAppSummaryInput {
  portOfOrigin: string | null;
  destination: string | null;
  timeOfDeparture: string | null;
  marineHostess: string | null;
  captainOnBoard: string | null;
  totalGuests: number | null;
  vesselName: string;
  passengers: PassengerForSummary[];
}

export interface WhatsAppSummary {
  message1: string;
  message2: string;
}

// "BIRD 1" -> "B1" (§6 note); anything else (a custom vessel_name_override)
// passes through unchanged. Used by Message 2's header.
export function abbreviateVesselName(name: string): string {
  const match = /^BIRD\s+(\d+)$/i.exec(name.trim());
  return match ? `B${match[1]}` : name;
}

// "BIRD 1" -> "BIRD1" (Message 1's own vessel format — no abbreviation,
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

  const message1 = [
    vesselNameCompact(input.vesselName),
    `Dep@:${formatDepartureTime(input.timeOfDeparture)}`,
    `${input.portOfOrigin ?? ""} to ${input.destination ?? ""}`,
    `${summary.totalTM}TM`,
    `${summary.totalCC}CC`,
    `${input.totalGuests ?? 0}guests`,
    `Mh ${input.marineHostess ?? ""}`,
    `Capt ${input.captainOnBoard ?? ""} team`,
  ].join("\n");

  const tmLines = summary.tmByDepartment.map((g) => `${g.count}${g.label}`);
  const ccLines = summary.ccByGroup.map((g) => `${g.count}${g.label}`);

  const message2 = [
    abbreviateVesselName(input.vesselName),
    ...tmLines,
    "",
    ...ccLines,
  ].join("\n");

  return { message1, message2 };
}
