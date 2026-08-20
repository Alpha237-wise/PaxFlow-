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

describe("buildManifestData (§9.2)", () => {
  it("sorts rows by seat number, not entry order", () => {
    const passengers: ManifestPassenger[] = [
      { seat_number: 5, name: "B", company_id_number: null, department: "FNB", company_name: null },
      { seat_number: 1, name: "A", company_id_number: null, department: "FNB", company_name: null },
    ];
    const result = buildManifestData(crossing, "BIRD 1", passengers);
    expect(result.rows.map((r) => r.seat)).toEqual([1, 5]);
  });

  it("only includes seats that actually have a passenger (no blank rows)", () => {
    const result = buildManifestData(crossing, "BIRD 1", []);
    expect(result.rows).toEqual([]);
  });

  it("shows department alone for a TM row, department/company for a CC row", () => {
    const passengers: ManifestPassenger[] = [
      { seat_number: 1, name: "TM Person", company_id_number: "123", department: "FNB", company_name: null },
      { seat_number: 2, name: "CC Person", company_id_number: null, department: "Kit", company_name: "UHS" },
    ];
    const result = buildManifestData(crossing, "BIRD 1", passengers);
    expect(result.rows[0]).toMatchObject({ companyIdNumber: "123", departmentCompany: "FNB" });
    expect(result.rows[1]).toMatchObject({ companyIdNumber: "", departmentCompany: "Kit/UHS" });
  });

  it("carries header fields through, defaulting nulls to empty strings", () => {
    const result = buildManifestData(
      { ...crossing, time_of_arrival: null, total_guests: null },
      "BIRD 1",
      [],
    );
    expect(result.timeOfArrival).toBe("");
    expect(result.totalGuests).toBe("");
    expect(result.marineHostess).toBe("Sarah");
    expect(result.vesselName).toBe("BIRD 1");
  });
});
