import { describe, expect, it } from "vitest";
import { abbreviateVesselName, buildWhatsAppSummary } from "./whatsapp-summary";

describe("abbreviateVesselName (§6)", () => {
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
  it("matches the real reference example exactly", () => {
    const passengers = [
      ...Array(7).fill({ classification_final: "TM" as const, department: "fnb", company_name: null }),
      ...Array(3).fill({ classification_final: "TM" as const, department: "Eng", company_name: null }),
      ...Array(2).fill({ classification_final: "CC" as const, department: "fnb", company_name: "shisha-souls" }),
      { classification_final: "CC" as const, department: null, company_name: "valet" },
    ];

    const result = buildWhatsAppSummary({
      portOfOrigin: "Shyouk",
      destination: "Island",
      marineHostess: "Sarah",
      captainOnBoard: "Sayeesh",
      vesselName: "BIRD 1",
      passengers,
    });

    expect(result.message1).toBe(
      ["Shyouk to Island", "10TM", "3 cc", "Mh Sarah", "Capt Sayeesh team"].join(
        "\n",
      ),
    );
    expect(result.message2).toBe(
      ["B1", "7fnb", "3Eng", "", "2fnb/shisha-souls", "1valet"].join("\n"),
    );
  });

  it("handles zero passengers without crashing", () => {
    const result = buildWhatsAppSummary({
      portOfOrigin: null,
      destination: null,
      marineHostess: null,
      captainOnBoard: null,
      vesselName: "BIRD 3",
      passengers: [],
    });
    expect(result.message1).toBe(" to \n0TM\n0 cc\nMh \nCapt  team");
    expect(result.message2).toBe("B3\n");
  });
});
