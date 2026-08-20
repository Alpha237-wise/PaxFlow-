// Hardcoded field positions for overlaying data on the photographed paper
// manifest (§21 "photo overlay" redesign, 2026-08-20). Positions are
// percentages (0-100) of the CORRECTED template image — i.e. the
// rectangle a Super Admin gets after tapping the paper's 4 corners, not
// the raw uploaded photo. That's what makes a single calibration valid
// for any correctly-cropped copy of the same paper form.
//
// Estimated by eye from docs/reference/seat-plan-blank-manifest.jpg and
// seat-plan-filled-example.jpg (gitignored — real staff data). This is
// deliberately an approximation, not a pixel-perfect trace: the project
// owner explicitly scoped V1 to "pre-calibrate yourself from the examples
// already shared, no manual calibration UI needed" and expects to refine
// these numbers after seeing real exports. Nudge individual xPct/yPct
// values if field text lands off the printed line/column.

export interface FieldPosition {
  xPct: number;
  yPct: number;
  align?: "left" | "right" | "center";
}

// Two-column header block (Date/Vessel Name/Time of Departure/Time of
// Arrival/Part of Origin/Destination) — each value sits on a ruled line
// just right of its printed label.
export const HEADER_FIELDS = {
  date: { xPct: 16.0, yPct: 3.2 } satisfies FieldPosition,
  vesselName: { xPct: 40.2, yPct: 3.7 } satisfies FieldPosition,
  timeOfDeparture: { xPct: 16.0, yPct: 6.2 } satisfies FieldPosition,
  timeOfArrival: { xPct: 40.2, yPct: 6.7 } satisfies FieldPosition,
  portOfOrigin: { xPct: 16.0, yPct: 9.6 } satisfies FieldPosition,
  destination: { xPct: 40.2, yPct: 9.7 } satisfies FieldPosition,
} as const;

// Crew + totals footer (right-hand side of the form). All right-aligned
// against the printed ruled line's right end — label widths vary
// ("AB" vs "Total No. of Contractors No.") but every line ends at
// roughly the same right margin, so anchoring there avoids needing a
// separate left-x per label.
export const FOOTER_FIELDS = {
  captainOnBoard: { xPct: 95, yPct: 65.8, align: "right" } satisfies FieldPosition,
  mechanic: { xPct: 95, yPct: 70.2, align: "right" } satisfies FieldPosition,
  abName: { xPct: 95, yPct: 74.5, align: "right" } satisfies FieldPosition,
  marineHostess: { xPct: 95, yPct: 78.8, align: "right" } satisfies FieldPosition,
  totalTM: { xPct: 95, yPct: 83.1, align: "right" } satisfies FieldPosition,
  totalGuests: { xPct: 95, yPct: 87.4, align: "right" } satisfies FieldPosition,
  totalContractors: { xPct: 95, yPct: 91.7, align: "right" } satisfies FieldPosition,
} as const;

export interface SeatBlockCalibration {
  seatXPct: number;
  nameXPct: number;
  companyIdXPct: number;
  departmentXPct: number;
  firstRowYPct: number;
  lastRowYPct: number;
}

// The seat/name/company-id/department LIST table (not to be confused with
// seat-layouts.ts's boat seating diagram, which is a different grid printed
// lower on the page). Always split left block = seats 1-25, right block =
// seats 26..N — confirmed from both reference photos, true for both the
// 51-seat and 50-seat layouts.
export const LEFT_SEAT_BLOCK: SeatBlockCalibration = {
  seatXPct: 3.4,
  nameXPct: 5.9,
  companyIdXPct: 26.1,
  departmentXPct: 29.5,
  firstRowYPct: 18.3,
  lastRowYPct: 99.5,
};

export const RIGHT_SEAT_BLOCK: SeatBlockCalibration = {
  seatXPct: 39.9,
  nameXPct: 41.6,
  companyIdXPct: 61.0,
  departmentXPct: 64.0,
  firstRowYPct: 18.3,
  lastRowYPct: 99.5,
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
