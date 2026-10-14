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

import type { SeatLayoutRef } from "./seat-layouts";

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
  // Optional measured row-center y for EVERY row of the block, top to
  // bottom. Takes priority over first/last interpolation when its length
  // matches the block's row count. Added for the 50-seat reference, whose
  // photo shows real paper curvature (see the 50-seat section below) that a
  // straight first-to-last interpolation can miss by up to ~1/6 of a row.
  rowYPct?: readonly number[];
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
  if (field.rowYPct && field.rowYPct.length === totalRowsInBlock) {
    return field.rowYPct[rowIndex];
  }
  if (totalRowsInBlock <= 1) return field.firstRowYPct;
  return (
    field.firstRowYPct +
    (rowIndex / (totalRowsInBlock - 1)) * (field.lastRowYPct - field.firstRowYPct)
  );
}

// ---------------------------------------------------------------------------
// 50-seat reference (BIRD 9 and BIRD 10) — added 2026-10-14.
//
// A different paper form from the 51-seat one above (their printed seat plan
// is grouped differently, and the footer has NO "Total No. of Guest" line —
// confirmed by looking at the photo: the footer is Captain on board /
// Mechanic / AB / Marine Hostess / Total No. of TM / Total No. of
// Contractors No. only). Hence `totalGuests` is absent from this footer, and
// the view must not render it.
//
// Source: reference/manifest B9 and B10.jpg (4080x3060 phone photo, not a
// flat scan), stored as reference/manifest-template-b9-b10-final.png (2560x
// 1920, a plain 2x-ish downscale, same 4:3 ratio, NO perspective warp
// applied). Because the photo is unwarped, everything below is measured
// against this exact image — if the stored template is ever replaced by a
// straightened/re-shot version, ALL of it must be re-measured (same rule as
// the 51-seat reference).
//
// Photo characteristics that shaped the calibration:
//  - Perspective/rotation: ruled rows fan out (left block row pitch ~3.3%,
//    right block ~3.1% of image height, and each COLUMN of a block has its
//    own endpoints — e.g. row 25's center differs by ~1.1pt between the
//    Name and Company-ID columns of the left block).
//  - Paper curvature: row pitch shrinks slightly down the page, so the
//    centers deviate from a straight first-to-last interpolation by up to
//    ~0.5pt. Every row center is therefore stored explicitly (`rowYPct`).
//  - Row 25 of the LEFT block is cropped at the bottom edge of the photo
//    (its bottom ruling is outside the frame for the Name column; the last
//    center there is extrapolated from the previous pitch, and sits ~1.4pt
//    from the image's bottom edge). It renders fully but tightly — a re-shot
//    with a little more margin below would be safer.
//
// Method (same discipline as the 51-seat notes above): numpy darkness
// threshold relative to a blurred local background (copes with the photo's
// uneven lighting) on the full-resolution JPG; per column, a vertical strip
// at the text's own x range; row dividers = the longest run of peaks with
// ~3% spacing, centers = midpoints of consecutive dividers (so the
// header-label text above the table can't be mistaken for a divider);
// column x edges from tall (6% of height) horizontal-profile bands so the
// printed text doesn't register. Text x = cell's left edge + 1.0pt (Name) /
// +0.45pt (Company ID, Department — narrow cells) . Header values sit on
// the printed line at the text's own x; footer values are right-aligned and
// 0.45pt above their line (same "handwriting just above the rule" convention
// as the 51-seat footer). All six footer lines end within ~0.4pt of each
// other on this form (unlike the 51-seat form's short Contractors line), so
// all six values share ONE right edge instead of the 51-seat form's
// separate names/totals columns.
// ---------------------------------------------------------------------------

const HEADER_FIELDS_50 = {
  date: { xPct: 11.9, yPct: 2.39 } satisfies FieldPosition,
  vesselName: { xPct: 38.49, yPct: 3.1 } satisfies FieldPosition,
  timeOfDeparture: { xPct: 11.9, yPct: 5.72 } satisfies FieldPosition,
  timeOfArrival: { xPct: 38.49, yPct: 6.27 } satisfies FieldPosition,
  portOfOrigin: { xPct: 11.9, yPct: 9.06 } satisfies FieldPosition,
  destination: { xPct: 38.49, yPct: 9.45 } satisfies FieldPosition,
} as const;

// No totalGuests — see above.
const FOOTER_FIELDS_50 = {
  captainOnBoard: { xPct: 95.8, yPct: 71.59, align: "right" } satisfies FieldPosition,
  mechanic: { xPct: 95.8, yPct: 75.72, align: "right" } satisfies FieldPosition,
  abName: { xPct: 95.8, yPct: 79.85, align: "right" } satisfies FieldPosition,
  marineHostess: { xPct: 95.8, yPct: 84.0, align: "right" } satisfies FieldPosition,
  totalTM: { xPct: 95.8, yPct: 88.16, align: "right" } satisfies FieldPosition,
  totalContractors: { xPct: 95.8, yPct: 92.34, align: "right" } satisfies FieldPosition,
} as const;

const LEFT_SEAT_BLOCK_50: SeatBlockCalibration = {
  name: {
    xPct: 5.9,
    firstRowYPct: 18.7,
    lastRowYPct: 98.62,
    rowYPct: [
      18.7, 22.08, 25.43, 28.78, 32.11, 35.43, 38.74, 42.06, 45.38, 48.7, 52.01, 55.32, 58.62,
      61.92, 65.23, 68.54, 71.85, 75.18, 78.52, 81.86, 85.2, 88.55, 91.91, 95.26, 98.62,
    ],
  },
  companyId: {
    xPct: 24.1,
    firstRowYPct: 18.07,
    lastRowYPct: 97.48,
    rowYPct: [
      18.07, 21.4, 24.74, 28.08, 31.42, 34.76, 38.11, 41.45, 44.8, 48.14, 51.47, 54.8, 58.13,
      61.45, 64.76, 68.07, 71.37, 74.68, 77.96, 81.25, 84.52, 87.78, 91.01, 94.24, 97.48,
    ],
  },
  department: {
    xPct: 30.3,
    firstRowYPct: 18.07,
    lastRowYPct: 97.14,
    rowYPct: [
      18.07, 21.38, 24.69, 28.01, 31.32, 34.64, 37.95, 41.27, 44.6, 47.91, 51.22, 54.52, 57.81,
      61.1, 64.4, 67.69, 70.99, 74.28, 77.56, 80.84, 84.12, 87.39, 90.67, 93.91, 97.14,
    ],
  },
};

const RIGHT_SEAT_BLOCK_50: SeatBlockCalibration = {
  name: {
    xPct: 44.0,
    firstRowYPct: 17.81,
    lastRowYPct: 93.46,
    rowYPct: [
      17.81, 20.96, 24.11, 27.28, 30.45, 33.62, 36.79, 39.95, 43.09, 46.22, 49.34, 52.45, 55.56,
      58.68, 61.81, 64.95, 68.11, 71.28, 74.46, 77.64, 80.81, 83.98, 87.14, 90.29, 93.46,
    ],
  },
  companyId: {
    xPct: 62.0,
    firstRowYPct: 17.75,
    lastRowYPct: 92.83,
    rowYPct: [
      17.75, 20.8, 23.87, 26.96, 30.06, 33.17, 36.29, 39.41, 42.54, 45.66, 48.77, 51.87, 54.98,
      58.11, 61.25, 64.41, 67.57, 70.73, 73.89, 77.06, 80.22, 83.37, 86.5, 89.64, 92.83,
    ],
  },
  department: {
    xPct: 68.0,
    firstRowYPct: 17.97,
    lastRowYPct: 92.52,
    rowYPct: [
      17.97, 20.98, 24.0, 27.04, 30.08, 33.13, 36.19, 39.25, 42.31, 45.4, 48.5, 51.6, 54.72,
      57.84, 60.96, 64.1, 67.23, 70.38, 73.53, 76.68, 79.83, 82.98, 86.14, 89.31, 92.52,
    ],
  },
};

// Everything the renderer needs for one paper form. `footer.totalGuests` is
// optional: a form without that printed line simply has no such entry, and
// the view renders only what is present.
export interface ManifestCalibration {
  header: Record<keyof typeof HEADER_FIELDS, FieldPosition>;
  footer: Record<Exclude<keyof typeof FOOTER_FIELDS, "totalGuests">, FieldPosition> & {
    totalGuests?: FieldPosition;
  };
  leftBlock: SeatBlockCalibration;
  rightBlock: SeatBlockCalibration;
  leftBlockMaxSeat: number;
}

// One calibration per physical form, keyed by the same seat_layout_ref that
// picks the template image (manifest-template.ts) — the image and the
// calibration measured against it are always selected by this one key, so
// they cannot get out of step.
export const MANIFEST_CALIBRATIONS: Record<SeatLayoutRef, ManifestCalibration> = {
  "51-seats": {
    header: HEADER_FIELDS,
    footer: FOOTER_FIELDS,
    leftBlock: LEFT_SEAT_BLOCK,
    rightBlock: RIGHT_SEAT_BLOCK,
    leftBlockMaxSeat: LEFT_BLOCK_MAX_SEAT,
  },
  "50-seats": {
    header: HEADER_FIELDS_50,
    footer: FOOTER_FIELDS_50,
    leftBlock: LEFT_SEAT_BLOCK_50,
    rightBlock: RIGHT_SEAT_BLOCK_50,
    leftBlockMaxSeat: 25,
  },
};
