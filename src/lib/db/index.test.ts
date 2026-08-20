import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, PaxFlowDB } from "./index";

describe("PaxFlowDB (Dexie schema smoke test)", () => {
  beforeEach(async () => {
    // Fresh isolated instance per test rather than the getDb() singleton,
    // so tests don't share IndexedDB state.
    const db = new PaxFlowDB();
    await db.delete();
    db.close();
  });

  it("opens and stores a vessel", async () => {
    const db = getDb();
    await db.vessels.put({
      id: "v1",
      name: "BIRD 1",
      total_seats: 51,
      status: "active",
      seat_layout_ref: "51-seats",
    });
    expect(await db.vessels.get("v1")).toMatchObject({ name: "BIRD 1" });
  });

  it("stores a crossing and its passengers, queryable by crossing_id", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    await db.crossings.put({
      id: "c1",
      vessel_id: "v1",
      created_by: "u1",
      status: "draft",
      crossing_date: "2026-08-20",
      time_of_departure: null,
      time_of_arrival: null,
      port_of_origin: "Base",
      destination: "Site",
      vessel_name_override: null,
      captain_on_board: null,
      mechanic: null,
      ab_name: null,
      marine_hostess: null,
      total_guests: null,
      expires_at: now,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
    });

    await db.passengers.put({
      id: "p1",
      crossing_id: "c1",
      seat_number: 1,
      name: "Test Passenger",
      company_id_number: null,
      department: "FNB",
      company_name: null,
      classification_computed: "TM",
      classification_final: "TM",
      classification_overridden: false,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
    });

    const passengers = await db.passengers
      .where("crossing_id")
      .equals("c1")
      .toArray();
    expect(passengers).toHaveLength(1);
    expect(passengers[0].seat_number).toBe(1);
  });

  it("rejects a duplicate seat on the same crossing (mirrors the Postgres unique constraint, §12)", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    const base = {
      crossing_id: "c1",
      seat_number: 1,
      name: "A",
      company_id_number: null,
      department: "FNB",
      company_name: null,
      classification_computed: "TM" as const,
      classification_final: "TM" as const,
      classification_overridden: false,
      created_at: now,
      updated_at: now,
      sync_status: "pending" as const,
    };
    await db.passengers.add({ ...base, id: "p1" });
    await expect(
      db.passengers.add({ ...base, id: "p2", name: "B" }),
    ).rejects.toThrow();
  });

  it("finds pending known_people rows for sync", async () => {
    const db = getDb();
    const now = new Date().toISOString();
    await db.known_people.put({
      id: "kp1",
      owner_id: "u1",
      name: "Memorized Person",
      company_id_number: null,
      department: "FNB",
      company_name: null,
      last_used_at: now,
      created_at: now,
      sync_status: "pending",
    });
    const owned = await db.known_people
      .where("owner_id")
      .equals("u1")
      .toArray();
    expect(owned).toHaveLength(1);
  });
});
