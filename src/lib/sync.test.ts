import "fake-indexeddb/auto";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, PaxFlowDB } from "./db";
import type { LocalCrossing, LocalKnownCrew, LocalKnownPerson } from "./db/schema";
import {
  clearMyHistory,
  deleteCrossing,
  purgeExpiredLocal,
  resetAllMyData,
} from "./sync";

function crossing(overrides: Partial<LocalCrossing>): LocalCrossing {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    vessel_id: null,
    created_by: "u1",
    status: "draft" as const,
    crossing_date: "2026-08-20",
    time_of_departure: null,
    time_of_arrival: null,
    port_of_origin: null,
    destination: null,
    vessel_name_override: null,
    captain_on_board: null,
    mechanic: null,
    ab_name: null,
    marine_hostess: null,
    total_guests: null,
    expires_at: now,
    created_at: now,
    updated_at: now,
    sync_status: "synced" as const,
    ...overrides,
  };
}

describe("purgeExpiredLocal (§15.1, mirrors the server-side pg_cron job locally)", () => {
  beforeEach(async () => {
    const db = new PaxFlowDB();
    await db.delete();
    db.close();
  });

  it("deletes a crossing whose expires_at has passed, cascading its passengers", async () => {
    const db = getDb();
    const expired = crossing({
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });
    await db.crossings.add(expired);
    await db.passengers.add({
      id: crypto.randomUUID(),
      crossing_id: expired.id,
      seat_number: 1,
      name: "Old Passenger",
      company_id_number: null,
      department: "FNB",
      company_name: null,
      classification_computed: "TM",
      classification_final: "TM",
      classification_overridden: false,
      created_at: expired.created_at,
      updated_at: expired.updated_at,
      sync_status: "synced",
    });

    await purgeExpiredLocal();

    expect(await db.crossings.get(expired.id)).toBeUndefined();
    expect(
      await db.passengers.where("crossing_id").equals(expired.id).count(),
    ).toBe(0);
  });

  it("keeps a crossing whose expires_at is still in the future", async () => {
    const db = getDb();
    const fresh = crossing({
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    await db.crossings.add(fresh);

    await purgeExpiredLocal();

    expect(await db.crossings.get(fresh.id)).toBeDefined();
  });
});

function passengerFor(crossingId: string, seat: number) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    crossing_id: crossingId,
    seat_number: seat,
    name: `Passenger ${seat}`,
    company_id_number: null,
    department: "FNB",
    company_name: null,
    classification_computed: "TM" as const,
    classification_final: "TM" as const,
    classification_overridden: false,
    created_at: now,
    updated_at: now,
    sync_status: "synced" as const,
  };
}

function knownPerson(overrides: Partial<LocalKnownPerson>): LocalKnownPerson {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    owner_id: "u1",
    name: "Someone",
    company_id_number: null,
    department: "FNB",
    company_name: null,
    last_used_at: now,
    created_at: now,
    sync_status: "synced",
    ...overrides,
  };
}

function knownCrewMember(overrides: Partial<LocalKnownCrew>): LocalKnownCrew {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    owner_id: "u1",
    role: "captain",
    name: "Someone",
    last_used_at: now,
    created_at: now,
    sync_status: "synced",
    ...overrides,
  };
}

describe("deleteCrossing (History screen's per-row delete)", () => {
  beforeEach(async () => {
    const db = new PaxFlowDB();
    await db.delete();
    db.close();
  });

  it("removes the crossing and its passengers locally, and queues the remote delete", async () => {
    const db = getDb();
    const c = crossing({});
    await db.crossings.add(c);
    await db.passengers.add(passengerFor(c.id, 1));
    await db.passengers.add(passengerFor(c.id, 2));

    await deleteCrossing(c.id);

    expect(await db.crossings.get(c.id)).toBeUndefined();
    expect(await db.passengers.where("crossing_id").equals(c.id).count()).toBe(0);
    expect(await db.pending_deletes.get(c.id)).toMatchObject({
      id: c.id,
      table_name: "crossings",
    });
  });
});

describe("clearMyHistory (\"Vider mon historique\", §4.7)", () => {
  beforeEach(async () => {
    const db = new PaxFlowDB();
    await db.delete();
    db.close();
  });

  it("deletes only the given user's crossings, leaving other users' untouched", async () => {
    const db = getDb();
    const mine = crossing({ created_by: "u1" });
    const someoneElses = crossing({ created_by: "u2" });
    await db.crossings.bulkAdd([mine, someoneElses]);
    await db.passengers.add(passengerFor(mine.id, 1));
    await db.passengers.add(passengerFor(someoneElses.id, 1));

    await clearMyHistory("u1");

    expect(await db.crossings.get(mine.id)).toBeUndefined();
    expect(await db.crossings.get(someoneElses.id)).toBeDefined();
    expect(await db.passengers.where("crossing_id").equals(mine.id).count()).toBe(0);
    expect(
      await db.passengers.where("crossing_id").equals(someoneElses.id).count(),
    ).toBe(1);
  });

  it("does not touch known_people/known_crew", async () => {
    const db = getDb();
    const mine = crossing({ created_by: "u1" });
    await db.crossings.add(mine);
    const person = knownPerson({ owner_id: "u1" });
    const crew = knownCrewMember({ owner_id: "u1" });
    await db.known_people.add(person);
    await db.known_crew.add(crew);

    await clearMyHistory("u1");

    expect(await db.known_people.get(person.id)).toBeDefined();
    expect(await db.known_crew.get(crew.id)).toBeDefined();
  });
});

describe("resetAllMyData (Full reset, §4.7)", () => {
  beforeEach(async () => {
    const db = new PaxFlowDB();
    await db.delete();
    db.close();
  });

  it("deletes crossings, passengers, known_people, and known_crew for that user only", async () => {
    const db = getDb();
    const mine = crossing({ created_by: "u1" });
    const someoneElses = crossing({ created_by: "u2" });
    await db.crossings.bulkAdd([mine, someoneElses]);
    await db.passengers.add(passengerFor(mine.id, 1));

    const myPerson = knownPerson({ owner_id: "u1" });
    const otherPerson = knownPerson({ owner_id: "u2" });
    await db.known_people.bulkAdd([myPerson, otherPerson]);

    const myCrew = knownCrewMember({ owner_id: "u1" });
    const otherCrew = knownCrewMember({ owner_id: "u2" });
    await db.known_crew.bulkAdd([myCrew, otherCrew]);

    await resetAllMyData("u1");

    expect(await db.crossings.get(mine.id)).toBeUndefined();
    expect(await db.crossings.get(someoneElses.id)).toBeDefined();
    expect(await db.known_people.get(myPerson.id)).toBeUndefined();
    expect(await db.known_people.get(otherPerson.id)).toBeDefined();
    expect(await db.known_crew.get(myCrew.id)).toBeUndefined();
    expect(await db.known_crew.get(otherCrew.id)).toBeDefined();

    const queuedTables = (await db.pending_deletes.toArray()).map((d) => d.table_name);
    expect(queuedTables).toContain("crossings");
    expect(queuedTables).toContain("known_people");
    expect(queuedTables).toContain("known_crew");
  });
});
