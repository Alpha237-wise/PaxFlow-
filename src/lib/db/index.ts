import Dexie, { type EntityTable } from "dexie";
import type {
  LocalVessel,
  LocalCrossing,
  LocalPassenger,
  LocalKnownPerson,
  LocalKnownCrew,
} from "./schema";

export class PaxFlowDB extends Dexie {
  vessels!: EntityTable<LocalVessel, "id">;
  crossings!: EntityTable<LocalCrossing, "id">;
  passengers!: EntityTable<LocalPassenger, "id">;
  known_people!: EntityTable<LocalKnownPerson, "id">;
  known_crew!: EntityTable<LocalKnownCrew, "id">;

  constructor() {
    super("paxflow");
    this.version(1).stores({
      vessels: "id, name",
      crossings: "id, created_by, vessel_id, sync_status, expires_at",
      passengers: "id, crossing_id, sync_status, &[crossing_id+seat_number]",
      known_people: "id, owner_id, name",
      known_crew: "id, owner_id, role",
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
