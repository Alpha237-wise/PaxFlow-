import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, PaxFlowDB } from "./db";
import { rememberPerson, searchKnownPeople } from "./known-people";

describe("known-people (§4.5)", () => {
  beforeEach(async () => {
    const db = new PaxFlowDB();
    await db.delete();
    db.close();
  });

  it("does not suggest anything below 2 characters", async () => {
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: null,
      department: "ENG",
      companyName: null,
    });
    expect(await searchKnownPeople("u1", "M")).toEqual([]);
  });

  it("finds a case-insensitive substring match", async () => {
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: null,
      department: "ENG",
      companyName: null,
    });
    const results = await searchKnownPeople("u1", "mal");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Malik");
  });

  it("never returns another owner's people (strictly private, §13.2)", async () => {
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: null,
      department: "ENG",
      companyName: null,
    });
    expect(await searchKnownPeople("u2", "mal")).toEqual([]);
  });

  it("upserts by (owner_id, name) instead of creating a duplicate", async () => {
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: null,
      department: "ENG",
      companyName: null,
    });
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: null,
      department: "FNB",
      companyName: null,
    });

    const db = getDb();
    const all = await db.known_people.where("owner_id").equals("u1").toArray();
    expect(all).toHaveLength(1);
    expect(all[0].department).toBe("FNB");
  });

  it("does nothing for a blank name", async () => {
    await rememberPerson("u1", {
      name: "   ",
      companyIdNumber: null,
      department: "ENG",
      companyName: null,
    });
    const db = getDb();
    expect(await db.known_people.where("owner_id").equals("u1").count()).toBe(
      0,
    );
  });
});
