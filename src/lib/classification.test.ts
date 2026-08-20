import { describe, expect, it } from "vitest";
import { classifyPassenger, resolveClassification } from "./classification";

describe("classifyPassenger (§4.1)", () => {
  it("classifies as TM when company_id_number is set, regardless of company_name", () => {
    expect(classifyPassenger({ companyIdNumber: "12345" })).toBe("TM");
    expect(
      classifyPassenger({ companyIdNumber: "12345", companyName: "Segafredo" }),
    ).toBe("TM");
  });

  it("classifies as TM when both fields are blank (Director/Manager, new joiner)", () => {
    expect(classifyPassenger({})).toBe("TM");
    expect(classifyPassenger({ companyIdNumber: "", companyName: "  " })).toBe(
      "TM",
    );
  });

  it("classifies as Contractor (CC) when company_id_number is blank and company_name is set", () => {
    expect(classifyPassenger({ companyName: "Segafredo" })).toBe("CC");
  });

  it("treats a whitespace-only company_id_number as blank", () => {
    expect(
      classifyPassenger({ companyIdNumber: "   ", companyName: "Shisha" }),
    ).toBe("CC");
  });
});

describe("resolveClassification", () => {
  it("keeps the computed value as final when no override is given", () => {
    expect(resolveClassification({ companyIdNumber: "123" })).toEqual({
      computed: "TM",
      final: "TM",
      overridden: false,
    });
  });

  it("marks overridden when the manual value differs from computed", () => {
    expect(
      resolveClassification({ companyName: "Segafredo" }, "TM"),
    ).toEqual({ computed: "CC", final: "TM", overridden: true });
  });

  it("does not mark overridden when the manual value matches computed", () => {
    expect(resolveClassification({ companyIdNumber: "123" }, "TM")).toEqual({
      computed: "TM",
      final: "TM",
      overridden: false,
    });
  });
});
