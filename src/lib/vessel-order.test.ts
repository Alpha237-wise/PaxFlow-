import { describe, expect, it } from "vitest";
import { compareVesselNames } from "./vessel-order";

const sort = (names: string[]) => [...names].sort(compareVesselNames);

describe("compareVesselNames", () => {
  it("keeps BIRD 1..10 numeric (BIRD 10 after BIRD 9)", () => {
    expect(sort(["BIRD 10", "BIRD 2", "BIRD 1", "BIRD 9"])).toEqual(["BIRD 1", "BIRD 2", "BIRD 9", "BIRD 10"]);
  });

  it("puts a boat outside the BIRD convention after them, whatever digit its name contains", () => {
    expect(sort(["ARPM2", "BIRD 3", "BIRD 1", "BIRD 10", "BIRD 2"])).toEqual([
      "BIRD 1", "BIRD 2", "BIRD 3", "BIRD 10", "ARPM2",
    ]);
  });

  it("orders several non-BIRD boats alphabetically", () => {
    expect(sort(["ZED", "ARPM2", "ARPM10", "ARPM1"])).toEqual(["ARPM1", "ARPM2", "ARPM10", "ZED"]);
  });
});
