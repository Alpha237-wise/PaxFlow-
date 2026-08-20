import { describe, expect, it } from "vitest";
import { buildManifestData, type ManifestPassenger } from "./manifest";

const crossing = {
  crossing_date: "2026-08-19",
  time_of_departure: "10:00",
  time_of_arrival: "10:30",
  port_of_origin: "Island",
  destination: "Skyourk",
  marine_hostess: "Sarah",
  total_guests: 2,
};

describe("buildManifestData (§9.2, revised 2026-08-20: full seat table, no longer dynamic)", () => {
  it("shows every seat of the layout, in order, occupied or not", () => {
    const passengers: ManifestPassenger[] = [
      { seat_number: 5, name: "B", company_id_number: null, department: "FNB", company_name: null },
      { seat_number: 1, name: "A", company_id_number: null, department: "FNB", company_name: null },
    ];
    const result = buildManifestData(crossing, "BIRD 1", passengers, "51-seats");
    expect(result.rows).toHaveLength(51);
    expect(result.rows.map((r) => r.seat)).toEqual(
      Array.from({ length: 51 }, (_, i) => i + 1),
    );
    expect(result.rows[0]).toMatchObject({ seat: 1, name: "A" });
    expect(result.rows[4]).toMatchObject({ seat: 5, name: "B" });
  });

  it("leaves blank rows for unoccupied seats rather than omitting them", () => {
    const result = buildManifestData(crossing, "BIRD 1", [], "50-seats");
    expect(result.rows).toHaveLength(50);
    expect(result.rows[0]).toEqual({
      seat: 1,
      name: "",
      companyIdNumber: "",
      departmentCompany: "",
    });
  });

  it("uses the 50-seat count for BIRD 9/10, 51 otherwise", () => {
    expect(buildManifestData(crossing, "BIRD 9", [], "50-seats").rows).toHaveLength(50);
    expect(buildManifestData(crossing, "BIRD 1", [], "51-seats").rows).toHaveLength(51);
  });

  it("shows department alone for a TM row, department/company for a CC row", () => {
    const passengers: ManifestPassenger[] = [
      { seat_number: 1, name: "TM Person", company_id_number: "123", department: "FNB", company_name: null },
      { seat_number: 2, name: "CC Person", company_id_number: null, department: "Kit", company_name: "UHS" },
    ];
    const result = buildManifestData(crossing, "BIRD 1", passengers, "51-seats");
    expect(result.rows[0]).toMatchObject({ companyIdNumber: "123", departmentCompany: "FNB" });
    expect(result.rows[1]).toMatchObject({ companyIdNumber: "", departmentCompany: "Kit/UHS" });
  });

  it("carries header fields through, including marine hostess and guests, defaulting nulls to empty strings", () => {
    const result = buildManifestData(
      { ...crossing, time_of_arrival: null, total_guests: null },
      "BIRD 1",
      [],
      "51-seats",
    );
    expect(result.timeOfArrival).toBe("");
    expect(result.totalGuests).toBe("");
    expect(result.marineHostess).toBe("Sarah");
    expect(result.vesselName).toBe("BIRD 1");
  });

  it("shows the actually-entered marine hostess and guest count", () => {
    const result = buildManifestData(crossing, "BIRD 1", [], "51-seats");
    expect(result.marineHostess).toBe("Sarah");
    expect(result.totalGuests).toBe("2");
  });
});
