"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { SEAT_LAYOUTS } from "@/lib/seat-layouts";
import type { LocalPassenger } from "@/lib/db/schema";
import { PassengerSheet } from "./passenger-sheet";

export function SeatMap({
  crossingId,
  seatLayoutRef,
}: {
  crossingId: string;
  seatLayoutRef: "51-seats" | "50-seats";
}) {
  const [openSeat, setOpenSeat] = useState<number | null>(null);

  const passengers = useLiveQuery(
    () => getDb().passengers.where("crossing_id").equals(crossingId).toArray(),
    [crossingId],
  );

  const bySeat = new Map<number, LocalPassenger>();
  for (const p of passengers ?? []) bySeat.set(p.seat_number, p);

  const layout = SEAT_LAYOUTS[seatLayoutRef];

  return (
    <div className="w-full max-w-sm">
      <h2 className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Plan des sièges {passengers ? `(${passengers.length} occupé${passengers.length > 1 ? "s" : ""})` : ""}
      </h2>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {layout.blocks.map((block, blockIndex) => (
          <div
            key={blockIndex}
            className="flex shrink-0 flex-col gap-1.5 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
          >
            {block.map((row, rowIndex) => (
              <div key={rowIndex} className="flex gap-1.5">
                {row.map((seatNumber) => {
                  const passenger = bySeat.get(seatNumber);
                  return (
                    <button
                      key={seatNumber}
                      type="button"
                      onClick={() => setOpenSeat(seatNumber)}
                      className={`flex h-12 w-12 flex-col items-center justify-center rounded-md border text-[11px] leading-tight ${
                        passenger
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                          : "border-zinc-300 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                      }`}
                    >
                      <span className="text-[10px] opacity-70">
                        {seatNumber}
                      </span>
                      {passenger && (
                        <span className="max-w-full truncate px-0.5 font-medium">
                          {passenger.name.split(" ")[0]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {openSeat !== null && (
        <PassengerSheet
          key={openSeat}
          crossingId={crossingId}
          seatNumber={openSeat}
          onClose={() => setOpenSeat(null)}
        />
      )}
    </div>
  );
}
