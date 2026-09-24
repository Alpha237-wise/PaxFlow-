import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, PaxFlowDB } from "./db";
import {
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
