// Homography (DLT) math + canvas warping for the manifest template upload
// flow (§9 rewrite, 2026-08-20): the Super Admin taps the paper form's 4
// corners in a crooked photo, and this straightens/crops it to a flat
// rectangle before it's stored as the shared template.
//
// Matrix math is kept DOM-free and pure so it's unit-testable under plain
// vitest (no jsdom/canvas needed); only warpQuadToCanvas touches the DOM.

export type Point = [number, number];

// Gaussian elimination with partial pivoting — small (8x8) fixed-size
// system, no need for a general linear-algebra dependency.
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pv = M[col][col];
    if (Math.abs(pv) < 1e-12) {
      throw new Error("Singular matrix — corner points are degenerate (e.g. collinear)");
    }
    for (let c = col; c <= n; c++) M[col][c] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

// Solves the projective transform H (row-major 3x3, h[8] fixed at 1)
// mapping src[i] -> dst[i] for exactly 4 point correspondences. A
// homography has exactly 8 free parameters, so 4 points determine it
// exactly — no least-squares/SVD needed.
export function computeHomography(src: Point[], dst: Point[]): number[] {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error("computeHomography needs exactly 4 point correspondences");
  }
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]);
    b.push(X);
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]);
    b.push(Y);
  }
  const h = solveLinearSystem(A, b);
  return [...h, 1];
}

export function applyHomography(H: number[], x: number, y: number): Point {
  const [a, b, c, d, e, f, g, h] = H;
  const w = g * x + h * y + 1;
  return [(a * x + b * y + c) / w, (d * x + e * y + f) / w];
}

export function invertHomography(H: number[]): number[] {
  const [a, b, c, d, e, f, g, h] = H;
  const m = [
    [a, b, c],
    [d, e, f],
    [g, h, 1],
  ];
  const det =
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  if (Math.abs(det) < 1e-12) {
    throw new Error("Singular matrix — cannot invert (degenerate corner points)");
  }
  const inv = [
    [
      (m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det,
      (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det,
      (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det,
    ],
    [
      (m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det,
      (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det,
      (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det,
    ],
    [
      (m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det,
      (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det,
      (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det,
    ],
  ];
  // Re-normalize so the bottom-right entry is 1 again, matching this
  // module's H representation (h[8] implicit as 1).
  const scale = 1 / inv[2][2];
  return [
    inv[0][0] * scale, inv[0][1] * scale, inv[0][2] * scale,
    inv[1][0] * scale, inv[1][1] * scale, inv[1][2] * scale,
    inv[2][0] * scale, inv[2][1] * scale,
  ];
}

function bilinearSample(img: ImageData, x: number, y: number): [number, number, number, number] {
  const { width, height, data } = img;
  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    // Outside the source photo — fill with white (paper background) rather
    // than showing stray/garbage pixels at the warped output's edges.
    return [255, 255, 255, 255];
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;
  const idx = (xx: number, yy: number) => (yy * width + xx) * 4;
  const sample = (channel: number) => {
    const p00 = data[idx(x0, y0) + channel];
    const p10 = data[idx(x1, y0) + channel];
    const p01 = data[idx(x0, y1) + channel];
    const p11 = data[idx(x1, y1) + channel];
    const top = p00 * (1 - fx) + p10 * fx;
    const bottom = p01 * (1 - fx) + p11 * fx;
    return top * (1 - fy) + bottom * fy;
  };
  return [sample(0), sample(1), sample(2), sample(3)];
}

// Warps the quadrilateral [topLeft, topRight, bottomRight, bottomLeft]
// (source image pixel coords) to fill a flat outputWidth x outputHeight
// rectangle, backward-sampling with bilinear interpolation so the result
// has no holes. Browser-only (canvas + ImageData).
export function warpQuadToCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  corners: [Point, Point, Point, Point],
  outputWidth: number,
  outputHeight: number,
): HTMLCanvasElement {
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = sourceWidth;
  srcCanvas.height = sourceHeight;
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) throw new Error("2D canvas context unavailable");
  srcCtx.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  const srcData = srcCtx.getImageData(0, 0, sourceWidth, sourceHeight);

  const dstCorners: Point[] = [
    [0, 0],
    [outputWidth, 0],
    [outputWidth, outputHeight],
    [0, outputHeight],
  ];
  const H = computeHomography(corners, dstCorners);
  const Hinv = invertHomography(H);

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outputWidth;
  outCanvas.height = outputHeight;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("2D canvas context unavailable");
  const outData = outCtx.createImageData(outputWidth, outputHeight);

  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const [sx, sy] = applyHomography(Hinv, x, y);
      const [r, g, b, a] = bilinearSample(srcData, sx, sy);
      const di = (y * outputWidth + x) * 4;
      outData.data[di] = r;
      outData.data[di + 1] = g;
      outData.data[di + 2] = b;
      outData.data[di + 3] = a;
    }
  }
  outCtx.putImageData(outData, 0, 0);
  return outCanvas;
}
