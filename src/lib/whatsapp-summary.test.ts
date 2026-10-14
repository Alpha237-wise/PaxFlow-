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

    expect(result.message).toBe(
      [
        "BIRD1",
        "Dep@:0700hrs",
        "Island to Shyouk",
        "10TM",
        "3CC",
        "15guests",
        "Mh Mae",
        "Capt Sayeesh team",
        "",
        "7- fnb",
        "3- Eng",
        "",
        "2- fnb/shisha-souls",
        "1- valet",
      ].join("\n"),
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
    expect(result.message.split("\n")).toContain("0guests");
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
    expect(result.message.split("\n")).toContain("0guests");
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
    expect(result.message).toBe(
      ["BIRD3", "Dep@:", " to ", "0TM", "0CC", "0guests", "Capt  team"].join("\n"),
    );
  });

  it("separates header / TM group / CC group with one blank line, skipping empty groups", () => {
    const base = {
      portOfOrigin: "A",
      destination: "B",
      timeOfDeparture: "07:00",
      marineHostess: null,
      captainOnBoard: "C",
      totalGuests: 0,
      vesselName: "BIRD 10",
    };
    const tm = { classification_final: "TM" as const, department: "Eng", company_name: null };
    const cc = { classification_final: "CC" as const, department: "Eng", company_name: "Qsp" };
    const header = ["BIRD10", "Dep@:0700hrs", "A to B"];

    const onlyTm = buildWhatsAppSummary({ ...base, passengers: [tm] }).message.split("\n");
    expect(onlyTm).toEqual([...header, "1TM", "0CC", "0guests", "Capt C team", "", "1- Eng"]);

    const onlyCc = buildWhatsAppSummary({ ...base, passengers: [cc] }).message.split("\n");
    expect(onlyCc).toEqual([...header, "0TM", "1CC", "0guests", "Capt C team", "", "1- Eng/Qsp"]);
  });
});

describe("Marine Hostess line is conditional (all vessels)", () => {
  const base = {
    portOfOrigin: "Island",
    destination: "Shyouk",
    timeOfDeparture: "07:00",
    captainOnBoard: "Sayeesh",
    totalGuests: 0,
    passengers: [],
  };

  it("shows 'Mh <name>' between guests and Capt when filled", () => {
    for (const vesselName of ["BIRD 1", "BIRD 10"]) {
      const lines = buildWhatsAppSummary({ ...base, vesselName, marineHostess: "Mae" }).message.split("\n");
      expect(lines.slice(-3)).toEqual(["0guests", "Mh Mae", "Capt Sayeesh team"]);
    }
  });

  it("omits the line entirely (no empty line, no placeholder) when null, empty or blank", () => {
    for (const marineHostess of [null, "", "   "]) {
      for (const vesselName of ["BIRD 1", "BIRD 10"]) {
        const { message } = buildWhatsAppSummary({ ...base, vesselName, marineHostess });
        const lines = message.split("\n");
        expect(lines.some((l) => l.startsWith("Mh"))).toBe(false);
        expect(lines).not.toContain("");
        expect(lines.slice(-2)).toEqual(["0guests", "Capt Sayeesh team"]);
      }
    }
  });

  it("trims the name", () => {
    const { message } = buildWhatsAppSummary({ ...base, vesselName: "BIRD 2", marineHostess: "  Mae " });
    expect(message.split("\n")).toContain("Mh Mae");
  });
});
