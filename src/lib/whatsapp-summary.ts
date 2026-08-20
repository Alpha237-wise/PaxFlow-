// Résumé WhatsApp — docs/cahier-des-charges.md §8.1. Two separate messages
// (decision validated 2026-08-20). Exact spacing/casing below is not a
// typo — it matches docs/reference/whatsapp-summary-example.jpg precisely
// ("39TM" glued, "12 cc" with a space; message 2 glues the count directly
// to the label, no colon).
import { summarizeCrossing, type PassengerForSummary } from "./crossing-summary";

export interface WhatsAppSummaryInput {
  portOfOrigin: string | null;
  destination: string | null;
  marineHostess: string | null;
  captainOnBoard: string | null;
  vesselName: string;
  passengers: PassengerForSummary[];
}

export interface WhatsAppSummary {
  message1: string;
  message2: string;
}

// "BIRD 1" -> "B1" (§6 note); anything else (a custom vessel_name_override)
// passes through unchanged.
export function abbreviateVesselName(name: string): string {
  const match = /^BIRD\s+(\d+)$/i.exec(name.trim());
  return match ? `B${match[1]}` : name;
}

export function buildWhatsAppSummary(input: WhatsAppSummaryInput): WhatsAppSummary {
  const summary = summarizeCrossing(input.passengers);

  const message1 = [
    `${input.portOfOrigin ?? ""} to ${input.destination ?? ""}`,
    `${summary.totalTM}TM`,
    `${summary.totalCC} cc`,
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
