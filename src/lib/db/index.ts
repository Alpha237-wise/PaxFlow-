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
  LocalProfile,
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
  profiles!: EntityTable<LocalProfile, "id">;

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
    // v5: indexes sync_status on known_people/known_crew — missed when
    // sync_status was added to those two tables, even though
    // pushKnownPeople()/pushKnownCrew() in sync.ts have queried
    // `.where("sync_status").equals("pending")` since this feature was
    // first built. Every call threw "KeyPath sync_status on object store
    // known_people is not indexed" (a Dexie SchemaError), which — since
    // nothing in runSync() catches it — aborted that entire sync cycle at
    // that exact point: pushKnownCrew() and every pull (pullCrossings,
    // pullPassengers, pullKnownPeople, pullKnownCrew) and
    // purgeExpiredLocal() after it in the same runSync() call never ran,
    // silently, on every single sync trigger since 2026-08-20. Found while
    // investigating a field report (2026-09-17) of in-place header edits
    // reverting shortly after being made; this and the crossings/
    // passengers set_updated_at trigger fix (see the 2026-09-17 migration)
    // are two independent bugs that were likely compounding — a pull that
    // never ran couldn't overwrite a local edit, but the two together
    // produced inconsistent, timing-dependent symptoms during testing.
    this.version(5).stores({
      vessels: "id, name",
      crossings: "id, created_by, vessel_id, sync_status, expires_at",
      passengers: "id, crossing_id, sync_status, &[crossing_id+seat_number]",
      known_people: "id, owner_id, name, sync_status",
      known_crew: "id, owner_id, role, sync_status",
      pending_deletes: "id, table_name",
      manifest_template: "id",
      sync_meta: "id",
    });
    // v6: adds profiles — caches the signed-in user's own name/role
    // locally so Home's greeting and role-gated nav links (Supervision/
    // Admin) no longer need the server-side profiles query that used to
    // run on every single Home load (2026-09-18, alongside removing that
    // query and Home's redundant vessels query from page.tsx — see
    // LocalProfile's docstring in schema.ts). Purely additive.
    this.version(6).stores({
      vessels: "id, name",
      crossings: "id, created_by, vessel_id, sync_status, expires_at",
      passengers: "id, crossing_id, sync_status, &[crossing_id+seat_number]",
      known_people: "id, owner_id, name, sync_status",
      known_crew: "id, owner_id, role, sync_status",
      pending_deletes: "id, table_name",
      manifest_template: "id",
      sync_meta: "id",
      profiles: "id",
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
