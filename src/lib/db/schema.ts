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
