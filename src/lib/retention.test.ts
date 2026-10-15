import { describe, expect, it } from "vitest";
import { CROSSING_RETENTION_DAYS, crossingExpiresAt } from "./retention";

describe("crossing retention (§15.1)", () => {
  it("is 14 days", () => {
    expect(CROSSING_RETENTION_DAYS).toBe(14);
  });

  it("stamps expires_at exactly 14 days after the given instant", () => {
    const from = Date.parse("2026-10-15T08:00:00.000Z");
    expect(crossingExpiresAt(from)).toBe("2026-10-29T08:00:00.000Z");
  });

  it("defaults to 14 days from now", () => {
    const before = Date.now();
    const expires = Date.parse(crossingExpiresAt());
    const after = Date.now();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    expect(expires).toBeGreaterThanOrEqual(before + fourteenDays);
    expect(expires).toBeLessThanOrEqual(after + fourteenDays);
  });
});
