import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb, PaxFlowDB } from "./db";
import { getCachedManifestTemplate, MANIFEST_TEMPLATES } from "./manifest-template";
import type { SeatLayoutRef } from "./seat-layouts";

const blob51 = new Blob(["template-51"], { type: "image/png" });
const blob50 = new Blob(["template-50"], { type: "image/png" });
const blob45 = new Blob(["template-45"], { type: "image/png" });

async function put(layout: SeatLayoutRef, blob: Blob) {
  const slot = MANIFEST_TEMPLATES[layout];
  await getDb().manifest_template.put({
    id: slot.localId,
    blob,
    storage_path: slot.storagePath,
    updated_at: "2026-10-14T00:00:00Z",
  });
}

async function resetDb() {
  const db = new PaxFlowDB();
  await db.delete();
  db.close();
}

describe("getCachedManifestTemplate — the right form for the right boat", () => {
  beforeEach(resetDb);

  it("returns each layout's own template when both are cached", async () => {
    await put("51-seats", blob51);
    await put("50-seats", blob50);
    // IndexedDB structured-clones Blobs, so compare content, not identity.
    expect(await (await getCachedManifestTemplate("51-seats"))?.blob.text()).toBe("template-51");
    expect(await (await getCachedManifestTemplate("50-seats"))?.blob.text()).toBe("template-50");
  });

  it("ARPM2 (45-seats) gets only its own template, and never borrows (or lends) another form's", async () => {
    await put("51-seats", blob51);
    await put("50-seats", blob50);
    expect(await getCachedManifestTemplate("45-seats")).toBeUndefined();
    await put("45-seats", blob45);
    expect(await (await getCachedManifestTemplate("45-seats"))?.blob.text()).toBe("template-45");
    expect(await (await getCachedManifestTemplate("51-seats"))?.blob.text()).toBe("template-51");
    expect(await (await getCachedManifestTemplate("50-seats"))?.blob.text()).toBe("template-50");
  });

  it("never falls back to the other layout's template when its own isn't cached", async () => {
    await put("51-seats", blob51);
    expect(await getCachedManifestTemplate("50-seats")).toBeUndefined();
    await resetDb();
    await put("50-seats", blob50);
    expect(await getCachedManifestTemplate("51-seats")).toBeUndefined();
  });

  it("returns nothing while the layout is unknown (vessel not resolved yet)", async () => {
    await put("51-seats", blob51);
    await put("50-seats", blob50);
    expect(await getCachedManifestTemplate(null)).toBeUndefined();
  });
});
