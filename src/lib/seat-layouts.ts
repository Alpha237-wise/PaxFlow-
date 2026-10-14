// Seat map templates — docs/cahier-des-charges.md §5. Static per V1 (2
// layouts for 10 boats), stored in the frontend rather than in the
// database, per §5.1.

export interface SeatLayout {
  /** Each block is a row of seats, in left-to-right / near-to-far order,
   * matching the physical grouping seen on the boat. */
  blocks: number[][][];
}

// Confirmed from the real paper manifest photo (docs/reference/
// seat-plan-filled-example.jpg): 3 blocks starting near the boat captain —
// 9 pairs (1-18), 5 triplets (19-33), 9 pairs (34-51) = 51 seats.
const FIFTY_ONE_SEATS: SeatLayout = {
  blocks: [
    [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18]],
    [[19, 20, 21], [22, 23, 24], [25, 26, 27], [28, 29, 30], [31, 32, 33]],
    [[34, 35], [36, 37], [38, 39], [40, 41], [42, 43], [44, 45], [46, 47], [48, 49], [50, 51]],
  ],
};

// Confirmed from the real BIRD 9/10 paper form (reference/manifest B9 and
// B10.jpg, 2026-10-14) — replaces the earlier "51 seats minus one" guess.
// The printed plan has two columns (left / right of the aisle), each headed
// by a pair next to the boat captain, then seven rows of three:
//   left : [1,2], then triplets 3-23
//   right: [24,25], then triplets 26-46, then [47,48] and [49,50]
// = 23 + 27 = 50 seats.
const FIFTY_SEATS: SeatLayout = {
  blocks: [
    [
      [1, 2],
      [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
    ],
    [
      [24, 25],
      [26, 27, 28], [29, 30, 31], [32, 33, 34], [35, 36, 37], [38, 39, 40], [41, 42, 43], [44, 45, 46],
      [47, 48],
      [49, 50],
    ],
  ],
};

// The paper form (manifest template image + its calibration) is selected by
// this same key — see manifest-template.ts and manifest-template-calibration.ts.
export type SeatLayoutRef = "51-seats" | "50-seats";

// Whether this boat type carries guests at all (operational fact confirmed
// 2026-10-14: no guests on BIRD 9/10). When false, the "Total No. of Guest"
// input, the manifest's guest field and the WhatsApp "<n>guests" line are
// all absent — not just emptied.
export const LAYOUT_CARRIES_GUESTS: Record<SeatLayoutRef, boolean> = {
  "51-seats": true,
  "50-seats": false,
};

export const SEAT_LAYOUTS: Record<SeatLayoutRef, SeatLayout> = {
  "51-seats": FIFTY_ONE_SEATS,
  "50-seats": FIFTY_SEATS,
};
