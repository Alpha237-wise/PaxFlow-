// Local (IndexedDB) row shapes. Field names deliberately mirror the
// Supabase columns (docs/cahier-des-charges.md §12) — snake_case, same
// names — so the sync layer (§21 step 13) can read/write rows without a
// translation layer that could silently drift out of sync.

export type SyncStatus = "synced" | "pending" | "error";

export interface LocalVessel {
  id: string;
  name: string;
  total_seats: number;
  status: "active" | "out_of_service";
  seat_layout_ref: "51-seats" | "50-seats";
}

// Supabase's generated types widen CHECK-constrained text columns to plain
// `string` (only real Postgres enums produce literal unions) — narrow at
// the boundary instead of loosening LocalVessel's type everywhere it's used.
export function toLocalVessel(row: {
  id: string;
  name: string;
  total_seats: number;
  status: string;
  seat_layout_ref: string;
}): LocalVessel {
  return row as LocalVessel;
}

export interface LocalCrossing {
  id: string;
  vessel_id: string | null;
  created_by: string;
  status: "draft" | "finalized";
  crossing_date: string; // ISO date, e.g. "2026-08-20"
  time_of_departure: string | null; // "HH:MM"
  time_of_arrival: string | null;
  port_of_origin: string | null;
  destination: string | null;
  vessel_name_override: string | null;
  captain_on_board: string | null;
  mechanic: string | null;
  ab_name: string | null;
  marine_hostess: string | null;
  total_guests: number | null;
  expires_at: string; // ISO datetime
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

export interface LocalPassenger {
  id: string;
  crossing_id: string;
  seat_number: number;
  name: string;
  company_id_number: string | null;
  department: string | null;
  company_name: string | null;
  classification_computed: "TM" | "CC";
  classification_final: "TM" | "CC";
  classification_overridden: boolean;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

// Same narrowing need as toLocalVessel, for passenger rows read straight
// from Supabase (e.g. the admin supervision screens, which query the
// server directly rather than Dexie — §21 step 15). No sync_status here:
// that's local-only bookkeeping these rows never had.
export function toPassengerRow(row: {
  id: string;
  crossing_id: string;
  seat_number: number;
  name: string;
  company_id_number: string | null;
  department: string | null;
  company_name: string | null;
  classification_computed: string;
  classification_final: string;
  classification_overridden: boolean;
  created_at: string;
  updated_at: string;
}): Omit<LocalPassenger, "sync_status"> {
  return row as Omit<LocalPassenger, "sync_status">;
}

export interface LocalKnownPerson {
  id: string;
  owner_id: string;
  name: string;
  company_id_number: string | null;
  department: string | null;
  company_name: string | null;
  last_used_at: string;
  created_at: string;
  sync_status: SyncStatus;
}

export interface LocalKnownCrew {
  id: string;
  owner_id: string;
  role: "captain" | "mechanic" | "ab" | "marine_hostess";
  name: string;
  last_used_at: string;
  created_at: string;
  sync_status: SyncStatus;
}

// Local-only tombstone queue: a manual delete (History screen, "Clear my
// history", "Full reset" — §4.7) removes the row from Dexie immediately
// for instant UI feedback, but the matching Supabase row can only be
// deleted once online. Without tracking that intent here, the next sync's
// pull would silently re-download the "deleted" row from the server and
// resurrect it locally. Never synced to Supabase itself — purely local
// bookkeeping consumed by sync.ts's processPendingDeletes().
export interface LocalPendingDelete {
  id: string; // the id of the row to delete
  table_name: "crossings" | "known_people" | "known_crew";
  created_at: string;
}
