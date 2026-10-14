import { describe, expect, it } from "vitest";
import { SEAT_LAYOUTS } from "./seat-layouts";

function seats(ref: "51-seats" | "50-seats") {
  return SEAT_LAYOUTS[ref].blocks.flat(2);
}

describe("SEAT_LAYOUTS", () => {
  for (const [ref, total] of [
    ["51-seats", 51],
    ["50-seats", 50],
  ] as const) {
    it(`${ref}: every seat 1..${total} appears exactly once`, () => {
      expect([...seats(ref)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: total }, (_, i) => i + 1),
      );
    });
  }

  it("50-seats matches the real BIRD 9/10 printed plan", () => {
    const [left, right] = SEAT_LAYOUTS["50-seats"].blocks;
    expect(SEAT_LAYOUTS["50-seats"].blocks).toHaveLength(2);
    expect(left).toEqual([
      [1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
    ]);
    expect(right).toEqual([
      [24, 25], [26, 27, 28], [29, 30, 31], [32, 33, 34], [35, 36, 37], [38, 39, 40],
      [41, 42, 43], [44, 45, 46], [47, 48], [49, 50],
    ]);
  });

  it("51-seats is unchanged (9 pairs, 5 triplets, 9 pairs)", () => {
    expect(SEAT_LAYOUTS["51-seats"].blocks.map((b) => b.length)).toEqual([9, 5, 9]);
  });
});
