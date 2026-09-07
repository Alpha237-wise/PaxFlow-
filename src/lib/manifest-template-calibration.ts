// Field positions for overlaying data on the manifest template image
// (§21 "photo overlay" redesign, 2026-08-20; recalibrated 2026-09-07 from
// the clean CamScanner-corrected reference reference/manifest-blank-template.pdf.pdf,
// see AGENTS.md-adjacent instructions in that commit). Positions are
// percentages (0-100) of the template image as stored (2123x1500,
// manifest-template.ts's current.png) — i.e. the same aspect ratio as the
// reference PDF page once rotated upright (4246x3000 at full render res).
// Measured by locating the printed ruled lines pixel-by-pixel (numpy
// darkness-threshold line detection on a high-res render of the reference
// PDF), not eyeballed — see git history for the analysis script/crops used
// (reference/*.png, gitignored scratch files). Re-measure the same way if
// the template is ever replaced with a different scan/layout.

export interface FieldPosition {
  xPct: number;
  yPct: number;
  align?: "left" | "right" | "center";
}

// Two-column header block (Date/Vessel Name/Time of Departure/Time of
// Arrival/Part of Origin/Destination) — each value sits on a ruled line
// just right of its printed label.
export const HEADER_FIELDS = {
  date: { xPct: 12.95, yPct: 8.6 } satisfies FieldPosition,
  vesselName: { xPct: 36.22, yPct: 9.37 } satisfies FieldPosition,
  timeOfDeparture: { xPct: 14.13, yPct: 11.5 } satisfies FieldPosition,
  timeOfArrival: { xPct: 36.22, yPct: 12.17 } satisfies FieldPosition,
  portOfOrigin: { xPct: 12.15, yPct: 14.17 } satisfies FieldPosition,
  destination: { xPct: 36.22, yPct: 14.97 } satisfies FieldPosition,
} as const;

// Crew + totals footer (right-hand side of the form). All right-aligned
// against the printed ruled line's right end — confirmed by measurement
// that every line ends at the same x (~92.7%, the crew-box's vertical
// border), regardless of label width ("AB" vs "Total No. of Contractors
// No."), so a single shared xPct anchors all seven.
export const FOOTER_FIELDS = {
  captainOnBoard: { xPct: 92.7, yPct: 65.37, align: "right" } satisfies FieldPosition,
  mechanic: { xPct: 92.7, yPct: 68.87, align: "right" } satisfies FieldPosition,
  abName: { xPct: 92.7, yPct: 72.33, align: "right" } satisfies FieldPosition,
  marineHostess: { xPct: 92.7, yPct: 75.8, align: "right" } satisfies FieldPosition,
  totalTM: { xPct: 92.7, yPct: 79.27, align: "right" } satisfies FieldPosition,
  totalGuests: { xPct: 92.7, yPct: 82.7, align: "right" } satisfies FieldPosition,
  totalContractors: { xPct: 92.7, yPct: 86.37, align: "right" } satisfies FieldPosition,
} as const;

export interface SeatBlockCalibration {
  nameXPct: number;
  companyIdXPct: number;
  departmentXPct: number;
  firstRowYPct: number;
  lastRowYPct: number;
}

// The seat/name/company-id/department LIST table (not to be confused with
// seat-layouts.ts's boat seating diagram, which is a different grid printed
// lower on the page). Always split left block = seats 1-25, right block =
// seats 26..N — confirmed from the reference PDF, true for both the
// 51-seat and 50-seat layouts. No seatXPct: the seat number is already
// printed on the reference form and is deliberately never redrawn (see
// manifest-view.tsx's seatRows) — overlaying it only produced a doubled/
// blurred look next to the printed digit.
//
// firstRowYPct/lastRowYPct are the row-CENTER y of the block's first and
// last printed row, each independently measured from its own printed
// boundary lines (row1 top=612px / row25 bottom=2769px for the left block;
// row26 top=646px / row51 bottom=2721px for the right, at the 4246x3000
// render scale) — the two blocks have genuinely different row heights
// (~86.3px vs ~79.8px: the paper fits 26 rows into the right block against
// 25 on the left) and must NOT share one pair of endpoints. An earlier
// version of this file copied the left block's endpoints onto the right
// block; the per-row error that introduced grew linearly down the block
// (correct only by coincidence around row ~40) instead of being a uniform
// offset, which is what gave away that it was a wrong-endpoint bug rather
// than non-uniform/non-linear row spacing (field report 2026-09-07).
export const LEFT_SEAT_BLOCK: SeatBlockCalibration = {
  nameXPct: 6.48,
  companyIdXPct: 24.5,
  departmentXPct: 30.08,
  firstRowYPct: 21.84,
  lastRowYPct: 90.86,
};

export const RIGHT_SEAT_BLOCK: SeatBlockCalibration = {
  nameXPct: 41.83,
  companyIdXPct: 58.43,
  departmentXPct: 63.97,
  firstRowYPct: 22.86,
  lastRowYPct: 89.37,
};

export const LEFT_BLOCK_MAX_SEAT = 25;

// Linear interpolation between a block's first/last printed row, so the
// 51-seat and 50-seat layouts (25/26 vs 25/25 rows per block) both land on
// their own ruled lines without hand-specifying every row.
export function seatRowYPct(
  block: SeatBlockCalibration,
  rowIndex: number,
  totalRowsInBlock: number,
): number {
  if (totalRowsInBlock <= 1) return block.firstRowYPct;
  return (
    block.firstRowYPct +
    (rowIndex / (totalRowsInBlock - 1)) * (block.lastRowYPct - block.firstRowYPct)
  );
}
