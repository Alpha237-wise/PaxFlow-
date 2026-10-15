import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildManifestData, type ManifestPassenger } from "@/lib/manifest";
import { MANIFEST_CALIBRATIONS } from "@/lib/manifest-template-calibration";
import { MANIFEST_INKS, MANIFEST_INK_KEYS } from "@/lib/manifest-ink";
import type { SeatLayoutRef } from "@/lib/seat-layouts";
import { PhotoOverlayManifest } from "./manifest-view";

function pax(n: number): ManifestPassenger[] {
  return Array.from({ length: n }, (_, i) => {
    const cc = i % 3 === 2; // a mix of TM and CC
    return {
      seat_number: i + 1,
      name: `Person ${i + 1}`,
      company_id_number: cc ? null : String(1000 + i),
      department: cc ? null : "ENG",
      company_name: cc ? "Valet" : null,
      classification_final: cc ? "CC" : "TM",
    };
  });
}

function render(ref: SeatLayoutRef, ink?: string | null) {
  const manifest = buildManifestData(
    {
      crossing_date: "2026-10-15", time_of_departure: "06:30", time_of_arrival: "06:55",
      port_of_origin: "A", destination: "B", captain_on_board: "Capt", mechanic: "Mech",
      ab_name: "AB", marine_hostess: "MH", total_guests: ref === "51-seats" ? 2 : null,
    },
    "BIRD 1", pax(ref === "51-seats" ? 51 : 50), ref,
  );
  return renderToStaticMarkup(
    <PhotoOverlayManifest templateUrl="t.png" manifest={manifest} calibration={MANIFEST_CALIBRATIONS[ref]} ink={ink} />,
  );
}

const colorsUsed = (html: string) => new Set(html.match(/color:#[0-9a-f]{6}/gi));

describe("manifest writing colour is applied to ALL injected text, on both forms", () => {
  for (const ref of ["51-seats", "50-seats"] as const) {
    for (const ink of MANIFEST_INK_KEYS) {
      it(`${ref} / ${ink}: every injected value uses that one colour — no TM/CC distinction`, () => {
        const html = render(ref, ink);
        expect(colorsUsed(html)).toEqual(new Set([`color:${MANIFEST_INKS[ink].color}`]));
        // Names, ids, departments and footer values are all there (TM and CC).
        expect(html).toContain("Person 1");
        expect(html).toContain("Person 3");
        expect(html).toContain("Valet");
      });
    }

    it(`${ref}: no ink chosen -> navy, exactly as before`, () => {
      for (const ink of [undefined, null, "not-an-ink"]) {
        expect(colorsUsed(render(ref, ink))).toEqual(new Set(["color:#0a2472"]));
      }
    });
  }

  it("changing the colour changes nothing but the colour (same layout, same text)", () => {
    const strip = (h: string) => h.replace(/color:#[0-9a-f]{6}/gi, "color:X");
    expect(strip(render("50-seats", "green"))).toBe(strip(render("50-seats", "burgundy")));
    expect(strip(render("51-seats", "navy"))).toBe(strip(render("51-seats", "green")));
  });
});
