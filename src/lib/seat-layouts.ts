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

// NOT confirmed by a reference photo (BIRD 9/10) — same structure as
// 51-seats with one seat removed from block C. Explicit decision from the
// project owner (2026-08-20): build against 51 seats now, fix this gabarit
// once a real photo is available (docs/cahier-des-charges.md §5).
const FIFTY_SEATS: SeatLayout = {
  blocks: [
    [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18]],
    [[19, 20, 21], [22, 23, 24], [25, 26, 27], [28, 29, 30], [31, 32, 33]],
    [[34, 35], [36, 37], [38, 39], [40, 41], [42, 43], [44, 45], [46, 47], [48, 49], [50]],
  ],
};

export const SEAT_LAYOUTS: Record<"51-seats" | "50-seats", SeatLayout> = {
  "51-seats": FIFTY_ONE_SEATS,
  "50-seats": FIFTY_SEATS,
};
