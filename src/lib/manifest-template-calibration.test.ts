import { describe, expect, it } from "vitest";
import {
  MANIFEST_CALIBRATIONS,
  seatRowYPct,
  type SeatBlockCalibration,
} from "./manifest-template-calibration";
import { MANIFEST_TEMPLATES, SEAT_LAYOUT_REFS } from "./manifest-template";
import { LAYOUT_CARRIES_GUESTS } from "./seat-layouts";

describe("manifest templates per seat layout", () => {
  it("gives every layout its own Supabase row, storage path and local cache key", () => {
    const slots = SEAT_LAYOUT_REFS.map((r) => MANIFEST_TEMPLATES[r]);
    expect(new Set(slots.map((s) => s.rowId)).size).toBe(slots.length);
    expect(new Set(slots.map((s) => s.storagePath)).size).toBe(slots.length);
    expect(new Set(slots.map((s) => s.localId)).size).toBe(slots.length);
  });

  it("keeps the original 51-seat identifiers unchanged (already-synced devices)", () => {
    expect(MANIFEST_TEMPLATES["51-seats"]).toEqual({
      rowId: "11111111-1111-1111-1111-111111111111",
      storagePath: "current.png",
      localId: "current",
    });
  });

  it("draws a guest field on the manifest exactly when the boat type carries guests", () => {
    for (const ref of SEAT_LAYOUT_REFS) {
      expect(!!MANIFEST_CALIBRATIONS[ref].footer.totalGuests).toBe(LAYOUT_CARRIES_GUESTS[ref]);
    }
  });

  it("has a calibration for every layout", () => {
    for (const ref of SEAT_LAYOUT_REFS) {
      expect(MANIFEST_CALIBRATIONS[ref]).toBeDefined();
    }
  });
});

describe("50-seat calibration (BIRD 9/10)", () => {
  const cal = MANIFEST_CALIBRATIONS["50-seats"];

  it("has no Total No. of Guest field â€” the paper form has no such line", () => {
    expect(cal.footer.totalGuests).toBeUndefined();
    expect(MANIFEST_CALIBRATIONS["51-seats"].footer.totalGuests).toBeDefined();
  });

  it("keeps the footer fields the paper does print: crew, Total No. of TM and Contractors", () => {
    for (const k of [
      "captainOnBoard",
      "mechanic",
      "abName",
      "marineHostess",
      "totalTM",
      "totalContractors",
    ] as const) {
      expect(cal.footer[k]).toBeDefined();
    }
  });

  it("splits 25 + 25 rows", () => {
    expect(cal.leftBlockMaxSeat).toBe(25);
  });

  const blocks: [string, SeatBlockCalibration][] = [
    ["left", cal.leftBlock],
    ["right", cal.rightBlock],
  ];
  for (const [label, block] of blocks) {
    for (const col of ["name", "companyId", "department"] as const) {
      it(`${label}.${col}: 25 strictly increasing row centers inside the image`, () => {
        const rows = block[col].rowYPct!;
        expect(rows).toHaveLength(25);
        for (let i = 1; i < rows.length; i++) expect(rows[i]).toBeGreaterThan(rows[i - 1]);
        expect(rows[0]).toBe(block[col].firstRowYPct);
        expect(rows[24]).toBe(block[col].lastRowYPct);
        expect(rows[0]).toBeGreaterThan(0);
        expect(rows[24]).toBeLessThan(100);
      });
    }
  }

  it("seatRowYPct uses the measured rows, and still interpolates when none are given", () => {
    expect(seatRowYPct(cal.leftBlock.name, 7, 25)).toBe(cal.leftBlock.name.rowYPct![7]);
    const plain = { xPct: 1, firstRowYPct: 10, lastRowYPct: 20 };
    expect(seatRowYPct(plain, 1, 3)).toBe(15);
  });
});

describe("45-seat calibration (ARPM2 / A2)", () => {
  const cal = MANIFEST_CALIBRATIONS["45-seats"];

  it("has the Total No. of Guest field — this form prints that line (unlike the 50-seat)", () => {
    expect(cal.footer.totalGuests).toBeDefined();
  });

  it("splits 23 + 22 rows, matching the two printed tables (1-23 / 24-45)", () => {
    expect(cal.leftBlockMaxSeat).toBe(23);
  });

  it("has all seven footer fields, stacked top to bottom in the printed order", () => {
    const f = cal.footer;
    const ys = [f.captainOnBoard, f.mechanic, f.abName, f.marineHostess, f.totalTM, f.totalGuests!, f.totalContractors]
      .map((p) => p.yPct);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
  });

  const blocks: [string, SeatBlockCalibration, number][] = [
    ["left", cal.leftBlock, 23],
    ["right", cal.rightBlock, 22],
  ];
  for (const [label, block, n] of blocks) {
    for (const col of ["name", "companyId", "department"] as const) {
      it(`${label}.${col}: ${n} strictly increasing row centers inside the image`, () => {
        const rows = block[col].rowYPct!;
        expect(rows).toHaveLength(n);
        for (let i = 1; i < rows.length; i++) expect(rows[i]).toBeGreaterThan(rows[i - 1]);
        expect(rows[0]).toBe(block[col].firstRowYPct);
        expect(rows[n - 1]).toBe(block[col].lastRowYPct);
        expect(rows[0]).toBeGreaterThan(0);
        expect(rows[n - 1]).toBeLessThan(100);
      });
    }
  }
});
