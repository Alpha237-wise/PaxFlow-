import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, PaxFlowDB } from "./db";
import type { LocalCrossing } from "./db/schema";
import { purgeExpiredLocal } from "./sync";

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
