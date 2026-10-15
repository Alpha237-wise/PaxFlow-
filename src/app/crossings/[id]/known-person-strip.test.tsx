import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LocalKnownPerson } from "@/lib/db/schema";
import { KnownPersonStrip } from "./known-person-strip";

function person(over: Partial<LocalKnownPerson>): LocalKnownPerson {
  return {
    id: "p",
    owner_id: "u1",
    name: "Malik",
    company_id_number: null,
    department: null,
    company_name: null,
    last_used_at: "2026-10-15T00:00:00Z",
    created_at: "2026-10-15T00:00:00Z",
    sync_status: "synced",
    sync_error: null,
    ...over,
  };
}

describe("KnownPersonStrip", () => {
  const html = renderToStaticMarkup(
    <KnownPersonStrip
      people={[
        person({ id: "a", company_id_number: "1111", department: "ENG" }),
        person({ id: "b", company_id_number: "2222", department: "FNB" }),
        person({ id: "c", company_name: "Valet" }),
      ]}
      onSelect={() => {}}
      onCancel={() => {}}
    />,
  );

  it("renders one card per homonym with name, matricule and department/company", () => {
    expect(html.match(/Malik/g)).toHaveLength(3);
    expect(html).toContain("ID 1111");
    expect(html).toContain("ID 2222");
    expect(html).toContain("ENG");
    expect(html).toContain("FNB");
    expect(html).toContain("Valet");
    expect(html).toContain("No ID"); // the contractor has no matricule
  });

  it("tags each card TM or CC from the classification rule (§4.1)", () => {
    expect(html.match(/>TM</g)).toHaveLength(2);
    expect(html.match(/>CC</g)).toHaveLength(1);
  });

  it("is a horizontally scrolling strip, not a <select>/<ul> dropdown", () => {
    expect(html).toContain("overflow-x-auto");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("<ul");
  });

  it("shows the given title, or the same-name default", () => {
    expect(html).toContain("Several people share this name");
    const withTitle = renderToStaticMarkup(
      <KnownPersonStrip
        title="Several people are saved with this ID — pick one"
        people={[person({ id: "a", name: "Malik", company_id_number: "9999" }), person({ id: "b", name: "Sofia", company_id_number: "9999" })]}
        onSelect={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(withTitle).toContain("saved with this ID");
    expect(withTitle).toContain("Malik");
    expect(withTitle).toContain("Sofia");
  });

  it("has an Annuler button, pinned (sticky) inside the strip", () => {
    expect(html).toContain(">Annuler</button>");
    expect(html).toMatch(/sticky right-0[^"]*"[^>]*>Annuler/);
  });
});
