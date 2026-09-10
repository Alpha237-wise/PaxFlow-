import Dexie, { type EntityTable } from "dexie";
import type {
  LocalVessel,
  LocalCrossing,
  LocalPassenger,
  LocalKnownPerson,
  LocalKnownCrew,
  LocalPendingDelete,
  LocalManifestTemplate,
  LocalSyncMeta,
} from "./schema";

export class PaxFlowDB extends Dexie {
  vessels!: EntityTable<LocalVessel, "id">;
  crossings!: EntityTable<LocalCrossing, "id">;
  passengers!: EntityTable<LocalPassenger, "id">;
  known_people!: EntityTable<LocalKnownPerson, "id">;
  known_crew!: EntityTable<LocalKnownCrew, "id">;
  pending_deletes!: EntityTable<LocalPendingDelete, "id">;
  manifest_template!: EntityTable<LocalManifestTemplate, "id">;
  sync_meta!: EntityTable<LocalSyncMeta, "id">;

  constructor() {
    super("paxflow");
    this.version(1).stores({
      vessels: "id, name",
      crossings: "id, created_by, vessel_id, sync_status, expires_at",
      passengers: "id, crossing_id, sync_status, &[crossing_id+seat_number]",
      known_people: "id, owner_id, name",
      known_crew: "id, owner_id, role",
    });
    // v2: adds pending_deletes (§ manual delete/reset feature) — purely
    // additive, no changes to existing stores, so existing installs
    // upgrade with nothing to migrate.
    this.version(2).stores({
      vessels: "id, name",
      crossings: "id, created_by, vessel_id, sync_status, expires_at",
      passengers: "id, crossing_id, sync_status, &[crossing_id+seat_number]",
      known_people: "id, owner_id, name",
      known_crew: "id, owner_id, role",
      pending_deletes: "id, table_name",
    });
    // v3: adds manifest_template (photo-overlay manifest, §9 rewrite) —
    // again purely additive.
    this.version(3).stores({
      vessels: "id, name",
      crossings: "id, created_by, vessel_id, sync_status, expires_at",
      passengers: "id, crossing_id, sync_status, &[crossing_id+seat_number]",
      known_people: "id, owner_id, name",
      known_crew: "id, owner_id, role",
      pending_deletes: "id, table_name",
      manifest_template: "id",
    });
    // v4: adds sync_meta (app-wide "needs reauth" flag, §16.7 sync
    // reliability fix) — purely additive. sync_error is a new plain field
    // on crossings/passengers/known_people/known_crew, not an index, so it
    // needs no stores() entry of its own; existing rows simply read back
    // with sync_error undefined until their next push/pull sets it.
    this.version(4).stores({
      vessels: "id, name",
      crossings: "id, created_by, vessel_id, sync_status, expires_at",
      passengers: "id, crossing_id, sync_status, &[crossing_id+seat_number]",
      known_people: "id, owner_id, name",
      known_crew: "id, owner_id, role",
      pending_deletes: "id, table_name",
      manifest_template: "id",
      sync_meta: "id",
    });
  }
}

let instance: PaxFlowDB | null = null;

// Lazy singleton: IndexedDB doesn't exist in Node, so constructing PaxFlowDB
// at module scope would crash `next build` / any Server Component import.
// Only ever call this from Client Components (see CLAUDE.md — offline-first
// architecture constraint).
export function getDb(): PaxFlowDB {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "getDb() must only be called in the browser — offline-first data lives in IndexedDB, never on the server.",
    );
  }
  if (!instance) instance = new PaxFlowDB();
  return instance;
}
