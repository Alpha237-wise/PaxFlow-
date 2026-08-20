import { describe, expect, it } from "vitest";
import { summarizeCrossing, type PassengerForSummary } from "./crossing-summary";

function passenger(
  overrides: Partial<PassengerForSummary>,
): PassengerForSummary {
  return {
    classification_final: "TM",
    department: null,
    company_name: null,
    ...overrides,
  };
}

describe("summarizeCrossing (§4.3/§8.1)", () => {
  it("counts total TM and CC", () => {
    const result = summarizeCrossing([
      passenger({ classification_final: "TM", department: "FNB" }),
      passenger({ classification_final: "TM", department: "Eng" }),
      passenger({ classification_final: "CC", company_name: "Valet" }),
    ]);
    expect(result.totalTM).toBe(2);
    expect(result.totalCC).toBe(1);
  });

  it("groups TM by department alone", () => {
    const result = summarizeCrossing([
      passenger({ classification_final: "TM", department: "FNB" }),
      passenger({ classification_final: "TM", department: "FNB" }),
      passenger({ classification_final: "TM", department: "Eng" }),
    ]);
    expect(result.tmByDepartment).toEqual([
      { label: "FNB", count: 2 },
      { label: "Eng", count: 1 },
    ]);
  });

  it("groups CC by department/company when both are set", () => {
    const result = summarizeCrossing([
      passenger({
        classification_final: "CC",
        department: "Kit",
        company_name: "UHS",
      }),
    ]);
    expect(result.ccByGroup).toEqual([{ label: "Kit/UHS", count: 1 }]);
  });

  it("groups CC by company alone when department is blank", () => {
    const result = summarizeCrossing([
      passenger({ classification_final: "CC", company_name: "Valet" }),
    ]);
    expect(result.ccByGroup).toEqual([{ label: "Valet", count: 1 }]);
  });

  it("merges groups case-insensitively but keeps the first-seen casing", () => {
    const result = summarizeCrossing([
      passenger({ classification_final: "TM", department: "FNB" }),
      passenger({ classification_final: "TM", department: "  fnb  " }),
      passenger({ classification_final: "TM", department: "FnB" }),
    ]);
    expect(result.tmByDepartment).toEqual([{ label: "FNB", count: 3 }]);
  });

  it("sorts groups by count descending, then alphabetically", () => {
    const result = summarizeCrossing([
      passenger({ classification_final: "TM", department: "Z" }),
      passenger({ classification_final: "TM", department: "A" }),
      passenger({ classification_final: "TM", department: "A" }),
    ]);
    expect(result.tmByDepartment).toEqual([
      { label: "A", count: 2 },
      { label: "Z", count: 1 },
    ]);
  });

  it("falls back to a placeholder when both department and company are blank", () => {
    const result = summarizeCrossing([passenger({ classification_final: "CC" })]);
    expect(result.ccByGroup).toEqual([{ label: "—", count: 1 }]);
  });
});
