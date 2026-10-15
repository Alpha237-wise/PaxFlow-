import "fake-indexeddb/auto";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, PaxFlowDB } from "./db";

// Fake server: profiles table with one row, update() recorded.
const server = {
  row: { id: "u1", full_name: "Ann", role: "user", manifest_ink: "navy" },
  updates: [] as Array<{ manifest_ink: string }>,
  failUpdate: false,
};
vi.mock("./supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { ...server.row }, error: null }) }) }),
      update: (patch: { manifest_ink: string }) => ({
        eq: async () => {
          if (server.failUpdate) return { error: { message: "offline" } };
          server.updates.push(patch);
          server.row.manifest_ink = patch.manifest_ink;
          return { error: null };
        },
      }),
    }),
  }),
}));

import { pullProfile, pushProfileInk, setManifestInk } from "./sync";

describe("manifest ink sync (§9.7): local first, pushed in the background", () => {
  beforeEach(async () => {
    const db = new PaxFlowDB();
    await db.delete();
    db.close();
    server.row = { id: "u1", full_name: "Ann", role: "user", manifest_ink: "navy" };
    server.updates = [];
    server.failUpdate = false;
  });

  it("a pulled profile without a stored colour defaults to navy", async () => {
    await pullProfile("u1");
    expect((await getDb().profiles.get("u1"))?.manifest_ink).toBe("navy");
  });

  it("setManifestInk writes locally at once, marked pending, without any network", async () => {
    await pullProfile("u1");
    server.failUpdate = true;
    await setManifestInk("u1", "green");
    expect(await getDb().profiles.get("u1")).toMatchObject({ manifest_ink: "green", manifest_ink_pending: true });
    await pushProfileInk("u1"); // offline: stays pending, nothing lost
    expect(await getDb().profiles.get("u1")).toMatchObject({ manifest_ink: "green", manifest_ink_pending: true });
    expect(server.updates).toEqual([]);
  });

  it("pushes the pending colour once online, then clears the flag", async () => {
    await pullProfile("u1");
    await setManifestInk("u1", "burgundy");
    await pushProfileInk("u1");
    expect(server.updates).toEqual([{ manifest_ink: "burgundy" }]);
    expect(await getDb().profiles.get("u1")).toMatchObject({ manifest_ink: "burgundy", manifest_ink_pending: false });
  });

  it("a pull never reverts a colour that hasn't been pushed yet", async () => {
    await pullProfile("u1");
    await setManifestInk("u1", "green"); // server still says navy
    await pullProfile("u1");
    expect(await getDb().profiles.get("u1")).toMatchObject({ manifest_ink: "green", manifest_ink_pending: true });
  });

  it("once pushed, a pull adopts the server value (e.g. changed on another device)", async () => {
    await pullProfile("u1");
    await setManifestInk("u1", "green");
    await pushProfileInk("u1");
    server.row.manifest_ink = "burgundy"; // picked on another device
    await pullProfile("u1");
    expect((await getDb().profiles.get("u1"))?.manifest_ink).toBe("burgundy");
  });

  it("seeds a local profile row when none is cached yet, so the choice isn't lost", async () => {
    await setManifestInk("u1", "green", { full_name: "Ann", role: "user" });
    expect(await getDb().profiles.get("u1")).toMatchObject({
      id: "u1", full_name: "Ann", role: "user", manifest_ink: "green", manifest_ink_pending: true,
    });
  });
});
