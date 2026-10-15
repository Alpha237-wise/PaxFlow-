// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getDb, PaxFlowDB } from "@/lib/db";
import type { LocalKnownPerson } from "@/lib/db/schema";
import { PassengerSheet } from "./passenger-sheet";

// Real PassengerSheet, real Dexie (fake-indexeddb), simulated taps/typing —
// not just static markup.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const onClose = vi.fn();

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
    root.render(<PassengerSheet crossingId="c1" seatNumber={3} userId="u1" onClose={onClose} />);
  });
  await flush();
}

function input(id: string): HTMLInputElement {
  return container.querySelector(`#${id}`) as HTMLInputElement;
}

async function type(id: string, value: string) {
  const el = input(id);
  await act(async () => {
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim().startsWith(label),
  );
  if (!found) throw new Error(`No button "${label}" in: ${container.textContent}`);
  return found as HTMLButtonElement;
}

async function tap(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.click();
  });
  await flush();
}

const text = () => container.textContent ?? "";

function known(over: Partial<LocalKnownPerson> & { id: string; name: string }): LocalKnownPerson {
  return {
    owner_id: "u1",
    company_id_number: null,
    department: null,
    company_name: null,
    last_used_at: "2026-10-10T00:00:00Z",
    created_at: "2026-10-10T00:00:00Z",
    sync_status: "synced",
    sync_error: null,
    ...over,
  };
}

async function seed(people: LocalKnownPerson[]) {
  await getDb().known_people.bulkPut(people);
}

describe("PassengerSheet — homonym strip, matricule strip, replace confirmation", () => {
  beforeEach(async () => {
    onClose.mockClear();
    const db = new PaxFlowDB();
    await db.delete();
    db.close();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("shows the scrolling strip when several known people share the typed name, and tapping a card fills the form", async () => {
    await seed([
      known({ id: "a", name: "Malik", company_id_number: "1111", department: "ENG" }),
      known({ id: "b", name: "Malik", company_id_number: "2222", department: "FNB" }),
    ]);
    await mount();
    await type("passengerName", "Mal");

    expect(text()).toContain("Several people share this name");
    expect(container.querySelector(".overflow-x-auto")).not.toBeNull();
    expect(container.querySelector("ul")).toBeNull(); // not the dropdown list
    expect(text()).toContain("ID 1111");
    expect(text()).toContain("ID 2222");
    // Nothing was auto-selected: the matricule field is still empty.
    expect(input("companyIdNumber").value).toBe("");

    await tap(button("Malik")); // first card (most recent first)
    expect(input("passengerName").value).toBe("Malik");
    expect(input("companyIdNumber").value).not.toBe("");
    expect(text()).not.toContain("Several people share this name");
  });

  it("keeps the plain suggestion list when there is no homonym", async () => {
    await seed([known({ id: "a", name: "Malik", company_id_number: "1111", department: "ENG" })]);
    await mount();
    await type("passengerName", "Mal");
    expect(container.querySelector("ul")).not.toBeNull();
    expect(text()).not.toContain("Several people share this name");
  });

  it("'Annuler' applies nothing and switches this seat to 100% manual entry", async () => {
    await seed([
      known({ id: "a", name: "Malik", company_id_number: "1111", department: "ENG" }),
      known({ id: "b", name: "Malik", company_id_number: "2222", department: "FNB" }),
    ]);
    await mount();
    await type("passengerName", "Mal");
    await tap(button("Annuler"));

    // Every field starts from zero, strip gone.
    expect(input("passengerName").value).toBe("");
    expect(input("companyIdNumber").value).toBe("");
    expect(input("department").value).toBe("");
    expect(input("companyName").value).toBe("");
    expect(text()).not.toContain("Several people share this name");

    // No suggestions any more on this sheet, name or matricule.
    await type("passengerName", "Malik");
    expect(container.querySelector("ul")).toBeNull();
    expect(text()).not.toContain("Several people share this name");
    await type("companyIdNumber", "1111");
    expect(container.querySelector("ul")).toBeNull();
    await type("companyIdNumber", "");

    // Classification is computed normally from what is typed: a contractor.
    await type("passengerName", "Someone New");
    await type("companyName", "Valet");
    await act(async () => {
      (container.querySelector("button[type=submit]") as HTMLButtonElement).click();
    });
    await flush();
    const saved = await getDb().passengers.toArray();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: "Someone New",
      company_id_number: null,
      company_name: "Valet",
      classification_computed: "CC",
      classification_final: "CC",
      classification_overridden: false,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows ALL entries sharing a typed matricule in the same strip, never auto-selecting one", async () => {
    await seed([
      known({ id: "a", name: "Malik", company_id_number: "9999", department: "ENG" }),
      known({ id: "b", name: "Sofia", company_id_number: "9999", department: "FNB" }),
    ]);
    await mount();
    await type("companyIdNumber", "9999");

    expect(text()).toContain("saved with this ID");
    expect(container.querySelector(".overflow-x-auto")).not.toBeNull();
    expect(container.querySelector("ul")).toBeNull();
    expect(text()).toContain("Malik");
    expect(text()).toContain("Sofia");
    expect(input("passengerName").value).toBe(""); // nothing prefilled

    await tap(button("Sofia"));
    expect(input("passengerName").value).toBe("Sofia");
    expect(input("department").value).toBe("FNB");
  });

  describe("replace confirmation (same matricule, different name)", () => {
    async function fillAndSave(name: string, matricule: string) {
      await type("passengerName", name);
      await type("companyIdNumber", matricule);
      await act(async () => {
        (container.querySelector("button[type=submit]") as HTMLButtonElement).click();
      });
      await flush();
    }

    it("asks before replacing; 'Annuler' saves nothing and returns to the form with the old name untouched", async () => {
      await seed([known({ id: "a", name: "Malik", company_id_number: "1111", department: "ENG" })]);
      await mount();
      await fillAndSave("Zed", "1111");

      expect(text()).toContain("Ce matricule est déjà associé à Malik — remplacer par Zed ?");
      expect(await getDb().passengers.count()).toBe(0); // not saved yet
      expect(onClose).not.toHaveBeenCalled();

      const notice = container.querySelector('[role="alert"]') as HTMLElement;
      const cancel = Array.from(notice.querySelectorAll("button")).find((b) => b.textContent === "Annuler")!;
      await tap(cancel);

      expect(container.querySelector('[role="alert"]')).toBeNull();
      expect(onClose).not.toHaveBeenCalled(); // the sheet stays open to fix the matricule
      expect((await getDb().known_people.get("a"))?.name).toBe("Malik");
      expect(await getDb().passengers.count()).toBe(0);

      // Fix the matricule and carry on: no prompt, saved at once.
      await type("companyIdNumber", "4444");
      await act(async () => {
        (container.querySelector("button[type=submit]") as HTMLButtonElement).click();
      });
      await flush();
      expect(container.querySelector('[role="alert"]')).toBeNull();
      expect(await getDb().passengers.count()).toBe(1);
      expect(onClose).toHaveBeenCalled();
      expect((await getDb().known_people.get("a"))?.name).toBe("Malik");
    });

    it("'Confirmer' saves the passenger and replaces the remembered name in one tap", async () => {
      await seed([known({ id: "a", name: "Malik", company_id_number: "1111", department: "ENG" })]);
      await mount();
      await fillAndSave("Zed", "1111");

      const notice = container.querySelector('[role="alert"]') as HTMLElement;
      const confirm = Array.from(notice.querySelectorAll("button")).find((b) => b.textContent === "Confirmer")!;
      await tap(confirm);

      expect(onClose).toHaveBeenCalled();
      const passengers = await getDb().passengers.toArray();
      expect(passengers).toHaveLength(1);
      expect(passengers[0]).toMatchObject({ name: "Zed", company_id_number: "1111" });
      expect((await getDb().known_people.get("a"))?.name).toBe("Zed");
    });

    it("does not ask when the name is the same (case aside) or when there's no matricule", async () => {
      await seed([known({ id: "a", name: "Malik", company_id_number: "1111", department: "ENG" })]);
      await mount();
      await fillAndSave("malik", "1111");
      expect(container.querySelector('[role="alert"]')).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(await getDb().passengers.count()).toBe(1);
    });

    it("never prompts about another account's remembered matricule", async () => {
      await seed([known({ id: "x", owner_id: "someone-else", name: "Malik", company_id_number: "1111" })]);
      await mount();
      await fillAndSave("Zed", "1111");
      expect(container.querySelector('[role="alert"]')).toBeNull();
      expect(await getDb().passengers.count()).toBe(1);
    });
  });
});
