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

// Cached copy of the signed-in user's OWN profile row — same purpose as
// LocalVessel: Home's greeting/role-gated nav links used to depend on a
// server-side profiles query on every single page load (2026-09-18 field
// report: this, plus the equally redundant server-side vessels query, was
// adding a real, measured ~600ms of network-blocking delay to Home, and
// made it fail outright when actually offline — see the same date's
// migration to getSession() for the auth check itself). Read-only from the
// client: nothing in this app currently lets a user edit their own
// full_name/role through the UI, so this only ever needs pulling, never
// pushing.
export interface LocalProfile {
  id: string;
  full_name: string | null;
  role: "user" | "admin" | "super_admin";
}

// Same narrowing need as toLocalVessel — Supabase's generated type for
// `role` widens the CHECK-constrained column to plain `string`.
export function toLocalProfile(row: {
  id: string;
  full_name: string | null;
  role: string;
}): LocalProfile {
  return row as LocalProfile;
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
  // The real Postgrest error message from the last failed push, so a
  // persistent "Sync error" can be diagnosed by reading this row instead
  // of writing a one-off debug script against the live project (field
  // report 2026-09-10 — pushCrossings() used to discard the error
  // entirely). null once synced; also null while sync_status is
  // "pending" and needs_reauth is true (see sync_meta) — in that case the
  // push was skipped rather than attempted, so there's no per-row error.
  sync_error: string | null;
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
  sync_error: string | null; // see LocalCrossing.sync_error
}

// Same narrowing need as toLocalVessel, for passenger rows read straight
// from Supabase (e.g. the admin supervision screens, which query the
// server directly rather than Dexie — §21 step 15). No sync_status/
// sync_error here: that's local-only bookkeeping these rows never had.
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
}): Omit<LocalPassenger, "sync_status" | "sync_error"> {
  return row as Omit<LocalPassenger, "sync_status" | "sync_error">;
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
  sync_error: string | null; // see LocalCrossing.sync_error
}

export interface LocalKnownCrew {
  id: string;
  owner_id: string;
  role: "captain" | "mechanic" | "ab" | "marine_hostess";
  name: string;
  last_used_at: string;
  created_at: string;
  sync_status: SyncStatus;
  sync_error: string | null; // see LocalCrossing.sync_error
}

// Single-row (id fixed to "status") app-wide sync session state — separate
// from any one table's sync_status/sync_error because it's not about a
// particular row failing to push, it's about the auth session itself being
// unusable. Written by runSync()'s ensureFreshSession() check, read by any
// screen that wants to show "reconnect" messaging instead of a per-row
// status that would otherwise misleadingly look like a data problem
// (field report 2026-09-10 — a session left offline long enough that its
// refresh token no longer works should read as "log back in", not as N
// separate "Sync error"s across every pending row).
export interface LocalSyncMeta {
  id: "status";
  needs_reauth: boolean;
  updated_at: string;
}

// Cached copy of a shared manifest reference photo/PDF — one row per paper
// form, mirroring the Supabase manifest_template table's one-row-per-form
// design: "current" is the 51-seat form (BIRD 1-8, key kept from before
// there was a second form), "50-seats" is the BIRD 9/10 form (see
// manifest-template.ts's MANIFEST_TEMPLATES). Stores the Blob directly;
// IndexedDB supports this natively. Enables offline manifest generation
// once the template has been fetched at least once (§16.7 pattern — see
// vessels/known_people). The key is the table's primary key only, so adding
// a form needs no Dexie schema version bump.
export interface LocalManifestTemplate {
  id: "current" | "50-seats";
  blob: Blob;
  storage_path: string;
  updated_at: string;
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
