import { describe, it, expect } from "vitest";
import { computeHomography, applyHomography, invertHomography } from "./perspective-warp";

describe("computeHomography / applyHomography", () => {
  it("maps a square to itself as the identity transform", () => {
    const square: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    const H = computeHomography(square, square);
    for (const [x, y] of square) {
      const [X, Y] = applyHomography(H, x, y);
      expect(X).toBeCloseTo(x, 6);
      expect(Y).toBeCloseTo(y, 6);
    }
  });

  it("maps each source corner exactly onto its destination corner", () => {
    const src: [number, number][] = [
      [50, 40],
      [900, 10],
      [880, 700],
      [30, 730],
    ];
    const dst: [number, number][] = [
      [0, 0],
      [800, 0],
      [800, 600],
      [0, 600],
    ];
    const H = computeHomography(src, dst);
    src.forEach(([x, y], i) => {
      const [X, Y] = applyHomography(H, x, y);
      expect(X).toBeCloseTo(dst[i][0], 4);
      expect(Y).toBeCloseTo(dst[i][1], 4);
    });
  });

  it("rejects a degenerate (collinear) set of source points", () => {
    const collinear: [number, number][] = [
      [0, 0],
      [10, 0],
      [20, 0],
      [30, 0],
    ];
    const dst: [number, number][] = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];
    expect(() => computeHomography(collinear, dst)).toThrow();
  });
});

describe("invertHomography", () => {
  it("round-trips: H^-1(H(p)) === p for a perspective transform", () => {
    const src: [number, number][] = [
      [50, 40],
      [900, 10],
      [880, 700],
      [30, 730],
    ];
    const dst: [number, number][] = [
      [0, 0],
      [800, 0],
      [800, 600],
      [0, 600],
    ];
    const H = computeHomography(src, dst);
    const Hinv = invertHomography(H);

    const probePoints: [number, number][] = [
      [100, 100],
      [500, 300],
      [850, 650],
      [10, 10],
    ];
    for (const [x, y] of probePoints) {
      const [X, Y] = applyHomography(H, x, y);
      const [x2, y2] = applyHomography(Hinv, X, Y);
      expect(x2).toBeCloseTo(x, 3);
      expect(y2).toBeCloseTo(y, 3);
    }
  });
});
