import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, PaxFlowDB } from "./db";
import { rememberCrewMember, searchKnownCrew } from "./known-crew";

describe("known-crew (§4.5/§7)", () => {
  beforeEach(async () => {
    const db = new PaxFlowDB();
    await db.delete();
    db.close();
  });

  it("does not suggest a name saved under a different role", async () => {
    await rememberCrewMember("u1", "captain", "Sayeesh");
    expect(await searchKnownCrew("u1", "marine_hostess", "say")).toEqual([]);
    expect(await searchKnownCrew("u1", "captain", "say")).toHaveLength(1);
  });

  it("upserts by (owner_id, role, name) instead of duplicating", async () => {
    await rememberCrewMember("u1", "mechanic", "Dinesh");
    await rememberCrewMember("u1", "mechanic", "Dinesh");

    const db = getDb();
    const all = await db.known_crew.where("owner_id").equals("u1").toArray();
    expect(all).toHaveLength(1);
  });

  it("is strictly private per owner", async () => {
    await rememberCrewMember("u1", "ab", "Alpha");
    expect(await searchKnownCrew("u2", "ab", "alp")).toEqual([]);
  });
});
