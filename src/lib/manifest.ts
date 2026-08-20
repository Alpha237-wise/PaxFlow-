// Données du manifeste — docs/cahier-des-charges.md §9. Pure function: the
// rendering layer (manifest-view.tsx) just injects these values into a
// fixed template, never reformulating them (§9.5 — no alteration).
import { formatDepartmentCompany } from "./crossing-summary";

export interface ManifestPassenger {
  seat_number: number;
  name: string;
  company_id_number: string | null;
  department: string | null;
  company_name: string | null;
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
  marineHostess: string;
  totalGuests: string;
  rows: ManifestRow[];
}

export interface ManifestCrossingInput {
  crossing_date: string;
  time_of_departure: string | null;
  time_of_arrival: string | null;
  port_of_origin: string | null;
  destination: string | null;
  marine_hostess: string | null;
  total_guests: number | null;
}

export function buildManifestData(
  crossing: ManifestCrossingInput,
  vesselName: string,
  passengers: ManifestPassenger[],
): ManifestData {
  const rows: ManifestRow[] = [...passengers]
    .sort((a, b) => a.seat_number - b.seat_number)
    .map((p) => ({
      seat: p.seat_number,
      name: p.name,
      companyIdNumber: p.company_id_number ?? "",
      departmentCompany: formatDepartmentCompany(p.department, p.company_name),
    }));

  return {
    vesselName,
    date: crossing.crossing_date,
    timeOfDeparture: crossing.time_of_departure ?? "",
    timeOfArrival: crossing.time_of_arrival ?? "",
    portOfOrigin: crossing.port_of_origin ?? "",
    destination: crossing.destination ?? "",
    marineHostess: crossing.marine_hostess ?? "",
    totalGuests: crossing.total_guests != null ? String(crossing.total_guests) : "",
    rows,
  };
}
