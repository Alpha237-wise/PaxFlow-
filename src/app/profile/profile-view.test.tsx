// @vitest-environment jsdom
import "fake-indexeddb/auto";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getDb, PaxFlowDB } from "@/lib/db";

// Keep the real setManifestInk (local write); don't let the background sync
// try to reach a network in a unit test.
const runSync = vi.fn(async () => {});
vi.mock("@/lib/sync", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sync")>()),
  runSync: (...args: unknown[]) => runSync(...(args as [])),
}));

import { ProfileView } from "./profile-view";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 40));
  });
}

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<ProfileView userId="u1" fullName="Ann" email="ann@x.test" role="user" />);
  });
  await flush();
}

const radios = () => Array.from(container.querySelectorAll('[role="radio"]')) as HTMLButtonElement[];
const checked = () => radios().filter((r) => r.getAttribute("aria-checked") === "true").map((r) => r.textContent);

describe("Profile — manifest writing colour selector", () => {
  beforeEach(async () => {
    runSync.mockClear();
    const db = new PaxFlowDB();
    await db.delete();
    db.close();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("offers the 3 inks and defaults to Bleu marine when the AB never touched it", async () => {
    await mount();
    expect(radios().map((r) => r.textContent)).toEqual(["Bleu marine", "Vert bouteille", "Bordeaux"]);
    expect(checked()).toEqual(["Bleu marine"]);
    expect(await getDb().profiles.count()).toBe(0); // viewing changes nothing
  });

  it("previews the colour with the signed-in AB's own name, not an invented one", async () => {
    await mount();
    expect(container.textContent).toContain("AB Ann · 06:30");
    expect(container.textContent).not.toContain("Mohammed");
  });

  it("shows the stored colour for an AB who already chose one", async () => {
    await getDb().profiles.put({ id: "u1", full_name: "Ann", role: "user", manifest_ink: "burgundy" });
    await mount();
    expect(checked()).toEqual(["Bordeaux"]);
  });

  it("one tap on a swatch selects it, saves it locally (pending push) and kicks a background sync", async () => {
    await getDb().profiles.put({ id: "u1", full_name: "Ann", role: "user", manifest_ink: "navy" });
    await mount();

    await act(async () => {
      radios()[1].click(); // Vert bouteille
    });
    await flush();

    expect(checked()).toEqual(["Vert bouteille"]);
    expect(await getDb().profiles.get("u1")).toMatchObject({
      manifest_ink: "green",
      manifest_ink_pending: true,
    });
    expect(runSync).toHaveBeenCalledWith("u1");
  });

  it("works for an AB whose profile isn't cached on this device yet", async () => {
    await mount();
    await act(async () => {
      radios()[2].click(); // Bordeaux
    });
    await flush();
    expect(checked()).toEqual(["Bordeaux"]);
    expect(await getDb().profiles.get("u1")).toMatchObject({
      id: "u1", full_name: "Ann", role: "user", manifest_ink: "burgundy", manifest_ink_pending: true,
    });
  });
});
