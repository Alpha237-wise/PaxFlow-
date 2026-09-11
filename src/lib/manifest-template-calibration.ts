// Field positions for overlaying data on the manifest template image
// (§21 "photo overlay" redesign, 2026-08-20; recalibrated 2026-09-11 from
// reference/manifest-blank-template-v2.jpg — a cleaner scan replacing the
// original PDF-derived reference, straighter lines and no crease/shadow
// artifacts, provided by the project owner). Positions are percentages
// (0-100) of the template image as stored (2560x1678,
// manifest-template.ts's current.png) — a 2x upscale of the 1280x839
// source JPG, same aspect ratio.
//
// Measured fresh from this file specifically — NOT reused from the prior
// reference's calibration, even where the layout looks identical, because
// exact pixel positions are a property of a given scan, not the paper
// design (confirmed necessary by the v1 saga: the old reference's own
// left/right seat blocks and even individual columns within a block
// needed independently-measured endpoints, since the source photo had a
// real, if numerically small, paper/perspective warp — not just a clean
// rotation). This v2 scan is visibly straighter than v1, but still has a
// small measurable residual tilt in the left seat block (confirmed by
// tracing the header/row1 divider across the block's width: ~5-7px drift
// at 839px scan height, small in this scan but still enough to matter at
// the row heights involved), so the same per-column measurement discipline
// was applied rather than assuming "looks straight" means "is straight".
//
// Measured via numpy darkness-threshold line detection on the source JPG
// (not the upscaled PNG — upscaling softens thin printed rules just
// enough to blur below a naive darkness threshold), cross-checked with
// zoomed pixel-grid crops where automated detection was ambiguous. See
// git history for the analysis scripts/crops used (reference/_v2-*.png,
// gitignored scratch files, deleted after use). Re-measure the same way
// if the template is ever replaced again.
//
// CORRECTED 2026-09-11 after a real end-to-end test (live app, real login,
// real crossing, real seats, real "Download Image" click — not a static
// render) showed every seat row's injected text sitting too low, visibly
// straddling into the NEXT printed row (e.g. seat 1's name overlapping
// seat 2's line). All six firstRowYPct/lastRowYPct pairs below were
// re-measured directly against the actual printed row dividers in the
// exported image (not re-derived from the source JPG a second time, to
// avoid repeating whatever measurement mistake produced the original
// values) and shifted up by ~2.5 points as a result. Verified by
// re-rendering through the real app three times, each time measuring the
// resulting text's ink-pixel center (not just eyeballing it) against the
// same printed dividers — final residual is within 0.4% of true center
// at every one of 6 sampled rows across both blocks (was up to 3.9% off,
// and visibly in the wrong printed row, before this fix). Row 1 of each
// block still sits close enough to the header's own two-line labels
// ("Company ID Number", "Department/Company") to visually crowd them
// despite being correctly centered in its own row — an inherent
// tight-clearance property of this template's header height, not a
// calibration error; data stays legible via the navy-vs-black color
// contrast. Re-measure the same way (real render + ink-pixel
// measurement, not just visual inspection) if the template changes.

export interface FieldPosition {
  xPct: number;
  yPct: number;
  align?: "left" | "right" | "center";
}

// Two-column header block (Date/Vessel Name/Time of Departure/Time of
// Arrival/Part of Origin/Destination) — each value sits on a ruled line
// just right of its printed label. First-pass measurement of this block
// searched each field's expected y starting a few px too low and picked
// up the NEXT field's line instead of its own — every value rendered one
// row below where it should've (Date's value landing next to "Time of
// Departure", etc.), caught by actually rendering the full test rather
// than trusting the numbers on paper. Re-measured with the search
// starting right after the printed label's own text instead of skipping
// past it.
export const HEADER_FIELDS = {
  date: { xPct: 18.13, yPct: 7.03 } satisfies FieldPosition,
  vesselName: { xPct: 39.69, yPct: 7.03 } satisfies FieldPosition,
  timeOfDeparture: { xPct: 17.81, yPct: 10.01 } satisfies FieldPosition,
  timeOfArrival: { xPct: 39.69, yPct: 10.13 } satisfies FieldPosition,
  portOfOrigin: { xPct: 17.81, yPct: 12.99 } satisfies FieldPosition,
  destination: { xPct: 39.69, yPct: 13.23 } satisfies FieldPosition,
} as const;

// Crew + totals footer (right-hand side of the form), all right-aligned.
// Each line's real right end was measured individually (they don't all
// end at the same x — "Total No. of Contractors No." in particular has a
// noticeably shorter blank line, its long label leaving less room), then
// pulled slightly further left and up from that measured end so entered
// text reads like handwriting sitting just above a ruled line instead of
// flush against its right edge (same convention validated on the prior
// reference, field reports 2026-09-08).
export const FOOTER_FIELDS = {
  captainOnBoard: { xPct: 95.23, yPct: 67.82, align: "right" } satisfies FieldPosition,
  mechanic: { xPct: 92.11, yPct: 71.63, align: "right" } satisfies FieldPosition,
  abName: { xPct: 95.23, yPct: 75.33, align: "right" } satisfies FieldPosition,
  marineHostess: { xPct: 95.23, yPct: 79.02, align: "right" } satisfies FieldPosition,
  totalTM: { xPct: 95.16, yPct: 82.72, align: "right" } satisfies FieldPosition,
  totalGuests: { xPct: 91.48, yPct: 86.53, align: "right" } satisfies FieldPosition,
  totalContractors: { xPct: 91.48, yPct: 90.11, align: "right" } satisfies FieldPosition,
} as const;

// xPct is where this field's text renders; firstRowYPct/lastRowYPct are
// the row-CENTER y of the block's first/last printed row, measured at
// THIS column's own x — not shared with the other two columns (see file
// header for why).
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
// seats 26..N. No seat-number field: it's already printed on the reference
// form and deliberately never redrawn (see manifest-view.tsx's seatRows).
export const LEFT_SEAT_BLOCK: SeatBlockCalibration = {
  name: { xPct: 9.84, firstRowYPct: 18.07, lastRowYPct: 91.99 },
  companyId: { xPct: 28.05, firstRowYPct: 18.55, lastRowYPct: 91.43 },
  department: { xPct: 33.75, firstRowYPct: 18.67, lastRowYPct: 91.33 },
};

// The right block's row divider showed negligible tilt across its width in
// this scan (confirmed by checking the header/row26 and row50/51 dividers
// at both the name and department x-positions — both landed within ~2px),
// so all three columns share one first/lastRowYPct pair here, unlike the
// left block.
export const RIGHT_SEAT_BLOCK: SeatBlockCalibration = {
  name: { xPct: 48.28, firstRowYPct: 18.43, lastRowYPct: 91.78 },
  companyId: { xPct: 63.59, firstRowYPct: 18.43, lastRowYPct: 91.78 },
  department: { xPct: 69.38, firstRowYPct: 18.43, lastRowYPct: 91.78 },
};

export const LEFT_BLOCK_MAX_SEAT = 25;

// Linear interpolation between a field's first/last printed row, so the
// 51-seat and 50-seat layouts (25/26 vs 25/25 rows per block) both land on
// their own ruled lines without hand-specifying every row. Row spacing IS
// uniform down any single fixed x (confirmed while tracing the divider
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
