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
// CORRECTED 2026-09-11 (first pass) after a real end-to-end test (live app,
// real login, real crossing, real seats, real "Download Image" click) showed
// every seat row's text sitting too low, into the next printed row. That
// pass shifted all six firstRowYPct/lastRowYPct pairs up by ~2.5 points and
// got the numeric ink-vs-row-center residual under 0.4% — but row 1 of each
// block still visibly crowded the header labels, which was wrongly written
// off here as "inherent to the template" rather than investigated further.
//
// CORRECTED AGAIN 2026-09-11 (second pass) after the project owner caught
// that call-out as wrong and pushed back: row 1/row 26 crowding the header
// was real miscalibration, not a template limitation. Root cause, found by
// generating ruler-gridline crops of the raw template image (reference/
// manifest-template-v2-final.png) and reading divider positions directly
// against printed row numbers — rather than trusting an automated
// darkness-threshold scan, which is exactly what had misidentified the
// table's own OUTER top border (~15.9%) as the header/row-1 divider in
// both the original v2 calibration and the first correction pass above.
// The true header/row-1 divider sits at ~19.6% (left) / ~20.3% (right),
// several points lower than either previous attempt used. All six
// firstRowYPct/lastRowYPct pairs were re-measured from these ruler crops —
// ruler crop of blank-line-per-value made it possible to also confirm two
// specific fields the project owner asked to double check, HEADER_FIELDS
// .date and FOOTER_FIELDS.totalTM, both already correct (within 0.1-0.5%
// of their printed line, no change needed).
//
// CORRECTED A THIRD TIME 2026-09-11 (same day, third pass) after a full
// 51-seat real end-to-end test showed RIGHT_SEAT_BLOCK seats ~46-51
// rendering with each seat's data one row early (seat 46's data at row 45,
// ..., row 51 left empty) despite seats 26-45 being exactly right. Verified
// first that this was NOT a data bug (read Dexie directly via
// page.evaluate — every seat had the correct name stored under the correct
// seat_number) before touching calibration again. Root cause: the second
// pass above misread its own ruler-crop screenshot for RIGHT_SEAT_BLOCK's
// lastRowYPct — mis-paired the row-50/51 divider with the table's bottom
// border, landing on 91.61 instead of the real ~94.54 — an easy mistake at
// screenshot resolution when several ruled lines sit within a few
// percentage points of each other. Caught this time by scanning the FULL
// divider sequence from the header down to the true bottom border in one
// pass (28 points, ~2.9pt pitch, essentially constant end to end — no real
// non-linearity in this block, unlike what the wrong pairing had implied)
// and cross-checking the printed row-number digit positions independently
// before changing anything. Re-verified against a full 51-seat +
// full-footer real render: every seat's ink-pixel center now matches its
// own calibrated target, and all 51 seats land in their own printed row.
//
// Verify any future recalibration the same way: (1) read Dexie/DB directly
// to rule out a data bug before touching calibration, (2) scan the FULL
// divider sequence for a block in one pass rather than separate top/bottom
// crops — a wrong pairing between two closely-spaced lines is easy to make
// when they're judged independently, much harder when you can see the
// whole consistent sequence at once, (3) a real end-to-end render with
// ALL rows filled (not a handful of sample seats) is what actually catches
// this class of bug — a sparse sample can land on the correct rows by
// coincidence while the block's tail is still wrong.

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
// date/portOfOrigin re-verified 2026-09-11 against a project-owner report
// that they looked misaligned "like Mechanic" (see FOOTER_FIELDS — that one
// really was off by several points): measured the printed line's y at the
// EXACT x each value starts (not a general area average, since these lines
// have a slight warp/curvature across their width like the seat table's
// rows do) — date's line sits at 7.03%, portOfOrigin's at 12.99%, an exact
// pixel match to the values already here. Left unchanged; the visual
// impression was very likely from Mechanic's real, larger offset nearby.
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
//
// Two real bugs fixed 2026-09-11 after the project owner reported Mechanic
// floating off its line and TM out of column with the other two totals:
// mechanic.xPct was 92.11 — measured against the wrong (much shorter) line
// at some point, since a direct scan shows Mechanic's actual printed line
// ends at ~96.9%, same as captainOnBoard/abName/marineHostess right next to
// it — corrected to match those three (95.23). totalTM.xPct was 95.16,
// independently measured from totalGuests/totalContractors' shared 91.48 —
// each was individually closer to its own line's real end, but that made
// the three totals visibly not line up as a column, which the project
// owner wants over hugging each line's exact endpoint — corrected to the
// shared 91.48 so all three totals sit in one vertical column. Mechanic's
// yPct (71.63) was already correct (measured line at 72.11%, ~0.5pt gap —
// consistent with the other three name fields' own gap) — untouched.
export const FOOTER_FIELDS = {
  captainOnBoard: { xPct: 95.23, yPct: 67.82, align: "right" } satisfies FieldPosition,
  mechanic: { xPct: 95.23, yPct: 71.63, align: "right" } satisfies FieldPosition,
  abName: { xPct: 95.23, yPct: 75.33, align: "right" } satisfies FieldPosition,
  marineHostess: { xPct: 95.23, yPct: 79.02, align: "right" } satisfies FieldPosition,
  totalTM: { xPct: 91.48, yPct: 82.72, align: "right" } satisfies FieldPosition,
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
// companyId/department nudged down 2026-09-11 (~0.3pt) and companyId
// nudged left (~0.75pt) after the project owner reported both columns
// sitting too high in their cell, and companyId additionally too far
// right — a direct pixel measurement against the printed row dividers put
// both within ~0.1-0.2pt of dead-center already, but that was measured
// against this codebase's own exported PNG, not the live in-app preview
// the project owner was actually looking at; trusting their live-device
// report over a close-but-not-identical offline measurement here.
export const LEFT_SEAT_BLOCK: SeatBlockCalibration = {
  name: { xPct: 9.84, firstRowYPct: 21.19, lastRowYPct: 94.89 },
  companyId: { xPct: 27.3, firstRowYPct: 21.95, lastRowYPct: 94.74 },
  department: { xPct: 33.75, firstRowYPct: 22.0, lastRowYPct: 94.77 },
};

// The right block's row divider showed negligible tilt across its width in
// this scan (confirmed by checking the header/row26 and row50/51 dividers
// at both the name and department x-positions — both landed within ~0.2
// points), so all three columns share one first/lastRowYPct pair here,
// unlike the left block.
export const RIGHT_SEAT_BLOCK: SeatBlockCalibration = {
  name: { xPct: 48.28, firstRowYPct: 21.71, lastRowYPct: 94.54 },
  companyId: { xPct: 62.84, firstRowYPct: 22.0, lastRowYPct: 94.83 },
  department: { xPct: 69.38, firstRowYPct: 22.0, lastRowYPct: 94.83 },
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
