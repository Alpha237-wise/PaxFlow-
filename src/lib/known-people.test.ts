import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, PaxFlowDB } from "./db";
import {
  findMatriculeConflict,
  hasHomonyms,
  rememberPerson,
  searchKnownPeople,
  searchKnownPeopleByCompanyId,
} from "./known-people";

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

  it("upserts by (owner_id, name) when there is no matricule, instead of creating a duplicate", async () => {
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

  it("upserts by matricule when present, updating that same person's details", async () => {
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: "1234",
      department: "ENG",
      companyName: null,
    });
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: "1234",
      department: "FNB",
      companyName: null,
    });

    const db = getDb();
    const all = await db.known_people.where("owner_id").equals("u1").toArray();
    expect(all).toHaveLength(1);
    expect(all[0].department).toBe("FNB");
  });

  it("keeps homonyms (same name, different matricule) as separate people — two TMs never share a matricule (§4.1)", async () => {
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: "1111",
      department: "ENG",
      companyName: null,
    });
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: "2222",
      department: "FNB",
      companyName: null,
    });

    const db = getDb();
    const all = await db.known_people.where("owner_id").equals("u1").toArray();
    expect(all).toHaveLength(2);
    expect(all.map((p) => p.company_id_number).sort()).toEqual(["1111", "2222"]);
  });

  it("does not let a no-matricule entry clobber a homonym's matriculed memory", async () => {
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: "1111",
      department: "ENG",
      companyName: null,
    });
    // A different Malik, entered later as a Contractor with no matricule.
    await rememberPerson("u1", {
      name: "Malik",
      companyIdNumber: null,
      department: null,
      companyName: "Valet",
    });

    const db = getDb();
    const all = await db.known_people.where("owner_id").equals("u1").toArray();
    expect(all).toHaveLength(2);
    const withId = all.find((p) => p.company_id_number === "1111");
    expect(withId?.department).toBe("ENG");
  });

  describe("findMatriculeConflict", () => {
    const malik = { name: "Malik", companyIdNumber: "1111", department: "ENG", companyName: null };

    it("returns the remembered person a save under another name would rename", async () => {
      await rememberPerson("u1", malik);
      const clash = await findMatriculeConflict("u1", "1111", "Zed");
      expect(clash?.name).toBe("Malik");
    });

    it("returns null for the same name (case/padding aside), no matricule, or an unknown matricule", async () => {
      await rememberPerson("u1", malik);
      expect(await findMatriculeConflict("u1", "1111", "  malik ")).toBeNull();
      expect(await findMatriculeConflict("u1", "", "Zed")).toBeNull();
      expect(await findMatriculeConflict("u1", null, "Zed")).toBeNull();
      expect(await findMatriculeConflict("u1", "2222", "Zed")).toBeNull();
      expect(await findMatriculeConflict("u1", "1111", "   ")).toBeNull();
    });

    it("never sees another owner's remembered people (strictly private)", async () => {
      await rememberPerson("u1", malik);
      expect(await findMatriculeConflict("u2", "1111", "Zed")).toBeNull();
    });

    it("flags exactly the row rememberPerson would overwrite", async () => {
      await rememberPerson("u1", malik);
      const clash = await findMatriculeConflict("u1", "1111", "Zed");
      await rememberPerson("u1", { ...malik, name: "Zed" });
      const all = await getDb().known_people.where("owner_id").equals("u1").toArray();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(clash?.id);
      expect(all[0].name).toBe("Zed");
    });
  });

  describe("hasHomonyms", () => {
    it("is true when two people share a name, whatever the case or padding", () => {
      expect(hasHomonyms([{ name: "Malik" }, { name: "Sofia" }, { name: " malik " }])).toBe(true);
    });

    it("is false when every name is distinct (even if one contains another)", () => {
      expect(hasHomonyms([{ name: "Malik" }, { name: "Malika" }])).toBe(false);
      expect(hasHomonyms([])).toBe(false);
    });

    it("sees a TM and a CC with the same name as homonyms", async () => {
      await rememberPerson("u1", { name: "Malik", companyIdNumber: "1111", department: "ENG", companyName: null });
      await rememberPerson("u1", { name: "Malik", companyIdNumber: null, department: null, companyName: "Valet" });
      expect(hasHomonyms(await searchKnownPeople("u1", "malik"))).toBe(true);
    });
  });

  describe("searchKnownPeopleByCompanyId (reverse lookup, TM-only)", () => {
    it("finds the exact matricule match", async () => {
      await rememberPerson("u1", {
        name: "Malik",
        companyIdNumber: "5678",
        department: "ENG",
        companyName: null,
      });
      const results = await searchKnownPeopleByCompanyId("u1", "5678");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Malik");
      expect(results[0].department).toBe("ENG");
    });

    it("returns EVERY entry sharing a matricule (a past entry error), never just one", async () => {
      // rememberPerson merges by matricule on one device, but two devices (or
      // old data) can leave two rows with the same matricule and different
      // names — the sheet must be able to show both, not pick one.
      const db = getDb();
      const base = {
        owner_id: "u1",
        company_id_number: "9999",
        company_name: null,
        created_at: "2026-10-01T00:00:00Z",
        sync_status: "synced" as const,
        sync_error: null,
      };
      await db.known_people.put({ ...base, id: "a", name: "Malik", department: "ENG", last_used_at: "2026-10-02T00:00:00Z" });
      await db.known_people.put({ ...base, id: "b", name: "Sofia", department: "FNB", last_used_at: "2026-10-03T00:00:00Z" });

      const results = await searchKnownPeopleByCompanyId("u1", "9999");
      expect(results.map((p) => p.name)).toEqual(["Sofia", "Malik"]);
    });

    it("requires an exact match, not a substring", async () => {
      await rememberPerson("u1", {
        name: "Malik",
        companyIdNumber: "5678",
        department: "ENG",
        companyName: null,
      });
      expect(await searchKnownPeopleByCompanyId("u1", "567")).toEqual([]);
    });

    it("never matches a Contractor (no matricule at all, §4.1)", async () => {
      await rememberPerson("u1", {
        name: "Sofia",
        companyIdNumber: null,
        department: null,
        companyName: "Valet",
      });
      expect(await searchKnownPeopleByCompanyId("u1", "")).toEqual([]);
    });

    it("never returns another owner's people (strictly private, §13.2)", async () => {
      await rememberPerson("u1", {
        name: "Malik",
        companyIdNumber: "5678",
        department: "ENG",
        companyName: null,
      });
      expect(await searchKnownPeopleByCompanyId("u2", "5678")).toEqual([]);
    });
  });
});
