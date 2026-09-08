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

// Crew + totals footer (right-hand side of the form), all right-aligned.
// All seven were originally anchored to a shared ~92.7% guessed from the
// longest line (Total No. of Contractors No., which really does reach
// close to the crew-box's vertical border) — imperceptible for the Total
// fields' 1-2 digit values, but wrong for the four name fields, whose own
// printed lines end noticeably earlier. Remeasured all seven individually
// (Total No. of Contractors No.'s own line is visibly slanted — measured
// at its right terminus) and pulled every anchor slightly further left of
// even that real end (real handwriting doesn't run to the very end of a
// blank line) plus a small upward nudge so text clears the line's own
// stroke thickness instead of sitting on/overlapping it (field reports
// 2026-09-08).
export const FOOTER_FIELDS = {
  captainOnBoard: { xPct: 90.86, yPct: 65.2, align: "right" } satisfies FieldPosition,
  mechanic: { xPct: 90.93, yPct: 68.7, align: "right" } satisfies FieldPosition,
  abName: { xPct: 89.68, yPct: 72.17, align: "right" } satisfies FieldPosition,
  marineHostess: { xPct: 89.5, yPct: 75.63, align: "right" } satisfies FieldPosition,
  totalTM: { xPct: 88.6, yPct: 79.1, align: "right" } satisfies FieldPosition,
  totalGuests: { xPct: 87.89, yPct: 82.53, align: "right" } satisfies FieldPosition,
  totalContractors: { xPct: 91.05, yPct: 86.63, align: "right" } satisfies FieldPosition,
} as const;

// xPct is where this field's text renders; firstRowYPct/lastRowYPct are
// the row-CENTER y of the block's first/last printed row, measured at
// THIS column's own x — not shared with the other two columns. The
// reference scan isn't a clean rotation: it's a genuine paper/perspective
// warp, so row height itself drifts across a block's width (left block:
// ~86.2px at the Name column's x vs ~83.4px at Department's, out of
// 3000px render height — a real ~3.3% compression, confirmed by tracing
// the printed row-divider lines pixel-by-pixel continuously across x,
// not just sampling two x-points). Reusing one column's endpoints for
// another silently reintroduces the same kind of growing-toward-one-side
// error that the seat-number-column-based calibration had (field reports
// 2026-09-07): first the two blocks were conflated, then even the right
// x-position within a block turned out to matter.
export interface FieldRowCalibration {
  xPct: number;
  firstRowYPct: number;
  lastRowYPct: number;
}

export interface SeatBlockCalibration {
  name: FieldRowCalibration;
  companyId: FieldRowCalibration;
  department: FieldRowCalibration;
}

// The seat/name/company-id/department LIST table (not to be confused with
// seat-layouts.ts's boat seating diagram, which is a different grid printed
// lower on the page). Always split left block = seats 1-25, right block =
// seats 26..N — confirmed from the reference PDF, true for both the
// 51-seat and 50-seat layouts. No seat-number field: it's already printed
// on the reference form and deliberately never redrawn (see
// manifest-view.tsx's seatRows) — overlaying it only produced a doubled/
// blurred look next to the printed digit.
export const LEFT_SEAT_BLOCK: SeatBlockCalibration = {
  name: { xPct: 6.48, firstRowYPct: 21.77, lastRowYPct: 90.76 },
  companyId: { xPct: 24.5, firstRowYPct: 22.53, lastRowYPct: 89.67 },
  department: { xPct: 30.08, firstRowYPct: 22.69, lastRowYPct: 89.38 },
};

export const RIGHT_SEAT_BLOCK: SeatBlockCalibration = {
  name: { xPct: 41.83, firstRowYPct: 22.83, lastRowYPct: 89.27 },
  companyId: { xPct: 58.43, firstRowYPct: 22.63, lastRowYPct: 89.27 },
  department: { xPct: 63.97, firstRowYPct: 22.54, lastRowYPct: 89.4 },
};

export const LEFT_BLOCK_MAX_SEAT = 25;

// Linear interpolation between a field's first/last printed row, so the
// 51-seat and 50-seat layouts (25/26 vs 25/25 rows per block) both land on
// their own ruled lines without hand-specifying every row. Row spacing
// IS uniform down any single fixed x (confirmed while tracing the divider
// lines) — only the endpoints differ column to column, not the linearity.
export function seatRowYPct(
  field: FieldRowCalibration,
  rowIndex: number,
  totalRowsInBlock: number,
): number {
  if (totalRowsInBlock <= 1) return field.firstRowYPct;
  return (
    field.firstRowYPct +
    (rowIndex / (totalRowsInBlock - 1)) * (field.lastRowYPct - field.firstRowYPct)
  );
}
