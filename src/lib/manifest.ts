// Données du manifeste — docs/cahier-des-charges.md §9. Pure function: the
// rendering layer (manifest-view.tsx) just injects these values into a
// fixed template, never reformulating them (§9.5 — no alteration).
import { formatDepartmentCompany, summarizeCrossing } from "./crossing-summary";

export interface ManifestPassenger {
  seat_number: number;
  name: string;
  company_id_number: string | null;
  department: string | null;
  company_name: string | null;
  classification_final: "TM" | "CC";
}

export interface ManifestRow {
  seat: number;
  name: string;
  companyIdNumber: string;
  departmentCompany: string;
}

export interface ManifestData {
  vesselName: string;
  date: string;
  timeOfDeparture: string;
  timeOfArrival: string;
  portOfOrigin: string;
  destination: string;
  captainOnBoard: string;
  mechanic: string;
  abName: string;
  marineHostess: string;
  totalGuests: string;
  totalTM: string;
  totalContractors: string;
  rows: ManifestRow[];
}

export interface ManifestCrossingInput {
  crossing_date: string;
  time_of_departure: string | null;
  time_of_arrival: string | null;
  port_of_origin: string | null;
  destination: string | null;
  captain_on_board: string | null;
  mechanic: string | null;
  ab_name: string | null;
  marine_hostess: string | null;
  total_guests: number | null;
}

// Revised 2026-08-20 (project owner): the manifest must show every seat of
// the BIRD used, blank rows included, matching the paper original exactly
// — not just the occupied ones. Replaces the earlier "dynamic table"
// behaviour (§9.2 as originally written).
const SEAT_COUNT: Record<"51-seats" | "50-seats", number> = {
  "51-seats": 51,
  "50-seats": 50,
};

export function buildManifestData(
  crossing: ManifestCrossingInput,
  vesselName: string,
  passengers: ManifestPassenger[],
  seatLayoutRef: "51-seats" | "50-seats",
): ManifestData {
  const bySeat = new Map(passengers.map((p) => [p.seat_number, p]));
  const totalSeats = SEAT_COUNT[seatLayoutRef];

  const rows: ManifestRow[] = [];
  for (let seat = 1; seat <= totalSeats; seat++) {
    const p = bySeat.get(seat);
    rows.push({
      seat,
      name: p?.name ?? "",
      companyIdNumber: p?.company_id_number ?? "",
      departmentCompany: p
        ? formatDepartmentCompany(p.department, p.company_name)
        : "",
    });
  }

  const summary = summarizeCrossing(passengers);

  return {
    vesselName,
    date: crossing.crossing_date,
    timeOfDeparture: crossing.time_of_departure ?? "",
    timeOfArrival: crossing.time_of_arrival ?? "",
    portOfOrigin: crossing.port_of_origin ?? "",
    destination: crossing.destination ?? "",
    captainOnBoard: crossing.captain_on_board ?? "",
    mechanic: crossing.mechanic ?? "",
    abName: crossing.ab_name ?? "",
    marineHostess: crossing.marine_hostess ?? "",
    totalGuests: crossing.total_guests != null ? String(crossing.total_guests) : "",
    totalTM: String(summary.totalTM),
    totalContractors: String(summary.totalCC),
    rows,
  };
}
