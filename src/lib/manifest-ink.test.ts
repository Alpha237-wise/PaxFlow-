import { describe, expect, it } from "vitest";
import {
  DEFAULT_MANIFEST_INK,
  MANIFEST_INKS,
  MANIFEST_INK_KEYS,
  isManifestInk,
  manifestInkColor,
} from "./manifest-ink";

describe("manifest ink (§9.7)", () => {
  it("offers exactly three inks, navy first and the default", () => {
    expect(MANIFEST_INK_KEYS).toEqual(["navy", "green", "burgundy"]);
    expect(DEFAULT_MANIFEST_INK).toBe("navy");
  });

  it("keeps navy exactly as it has always been on the manifest", () => {
    expect(manifestInkColor("navy")).toBe("#0a2472");
  });

  it("has three distinct colours, each AAA-readable (>= 7:1) on white paper", () => {
    const colors = MANIFEST_INK_KEYS.map((k) => MANIFEST_INKS[k].color);
    expect(new Set(colors).size).toBe(3);
    const linear = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    for (const hex of colors) {
      const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16)));
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const contrastOnWhite = 1.05 / (luminance + 0.05); // WCAG: (1 + .05)/(L + .05)
      expect(contrastOnWhite).toBeGreaterThanOrEqual(7);
    }
  });

  it("falls back to navy for anything unknown or missing", () => {
    expect(manifestInkColor(undefined)).toBe("#0a2472");
    expect(manifestInkColor(null)).toBe("#0a2472");
    expect(manifestInkColor("hotpink")).toBe("#0a2472");
    expect(isManifestInk("green")).toBe(true);
    expect(isManifestInk("hotpink")).toBe(false);
    expect(isManifestInk(undefined)).toBe(false);
  });
});
