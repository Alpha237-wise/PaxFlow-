import { describe, expect, it } from "vitest";
import { abbreviateVesselName, buildWhatsAppSummary } from "./whatsapp-summary";

describe("abbreviateVesselName (§6, used by Message 2)", () => {
  it("abbreviates BIRD N to BN", () => {
    expect(abbreviateVesselName("BIRD 1")).toBe("B1");
    expect(abbreviateVesselName("BIRD 10")).toBe("B10");
  });

  it("leaves a custom vessel_name_override untouched", () => {
    expect(abbreviateVesselName("Birdy McBoat")).toBe("Birdy McBoat");
    expect(abbreviateVesselName("B1")).toBe("B1");
  });
});

describe("buildWhatsAppSummary (§8.1)", () => {
  it("matches the format the project owner specified on 2026-08-20", () => {
    const passengers = [
      ...Array(7).fill({ classification_final: "TM" as const, department: "fnb", company_name: null }),
      ...Array(3).fill({ classification_final: "TM" as const, department: "Eng", company_name: null }),
      ...Array(2).fill({ classification_final: "CC" as const, department: "fnb", company_name: "shisha-souls" }),
      { classification_final: "CC" as const, department: null, company_name: "valet" },
    ];

    const result = buildWhatsAppSummary({
      portOfOrigin: "Island",
      destination: "Shyouk",
      timeOfDeparture: "07:00",
      marineHostess: "Mae",
      captainOnBoard: "Sayeesh",
      totalGuests: 15,
      vesselName: "BIRD 1",
      passengers,
    });

    expect(result.message1).toBe(
      [
        "BIRD1",
        "Dep@:0700hrs",
        "Island to Shyouk",
        "10TM",
        "3CC",
        "15guests",
        "Mh Mae",
        "Capt Sayeesh team",
      ].join("\n"),
    );
    expect(result.message2).toBe(
      ["B1", "7fnb", "3Eng", "", "2fnb/shisha-souls", "1valet"].join("\n"),
    );
  });

  it("always includes the guests line, even when the count is 0", () => {
    const result = buildWhatsAppSummary({
      portOfOrigin: "A",
      destination: "B",
      timeOfDeparture: "07:00",
      marineHostess: "Mae",
      captainOnBoard: "Sayeesh",
      totalGuests: 0,
      vesselName: "BIRD 1",
      passengers: [],
    });
    expect(result.message1.split("\n")).toContain("0guests");
  });

  it("treats a missing guest count the same as 0", () => {
    const result = buildWhatsAppSummary({
      portOfOrigin: "A",
      destination: "B",
      timeOfDeparture: "07:00",
      marineHostess: "Mae",
      captainOnBoard: "Sayeesh",
      totalGuests: null,
      vesselName: "BIRD 1",
      passengers: [],
    });
    expect(result.message1.split("\n")).toContain("0guests");
  });

  it("handles a missing departure time without crashing", () => {
    const result = buildWhatsAppSummary({
      portOfOrigin: null,
      destination: null,
      timeOfDeparture: null,
      marineHostess: null,
      captainOnBoard: null,
      totalGuests: null,
      vesselName: "BIRD 3",
      passengers: [],
    });
    expect(result.message1).toBe(
      ["BIRD3", "Dep@:", " to ", "0TM", "0CC", "0guests", "Mh ", "Capt  team"].join(
        "\n",
      ),
    );
    expect(result.message2).toBe("B3\n");
  });
});
