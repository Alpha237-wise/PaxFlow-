"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import type { LocalVessel } from "@/lib/db/schema";

// §5.1: BIRD 1..10 must sort numerically, not lexicographically
// ("BIRD 10" would otherwise land right after "BIRD 1").
function vesselNumber(name: string): number {
  const match = /\d+/.exec(name);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

export function VesselChooser({
  initialVessels,
}: {
  initialVessels: LocalVessel[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const router = useRouter();

  // Seed the local cache once on mount so the list keeps working offline on
  // the next visit, even without a service worker yet (§21 step 13 adds
  // that). Dexie stays the source of truth the UI actually reads from.
  useEffect(() => {
    if (initialVessels.length > 0) {
      void getDb().vessels.bulkPut(initialVessels);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vessels = useLiveQuery(
    () => getDb().vessels.toArray(),
    [],
    initialVessels,
  );

  const sorted = [...(vessels ?? [])].sort(
    (a, b) => vesselNumber(a.name) - vesselNumber(b.name),
  );

  return (
    <div className="w-full max-w-sm">
      <h2 className="mb-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Choose the BIRD
      </h2>
      <ul className="grid grid-cols-2 gap-3">
        {sorted.map((vessel) => {
          const selected = vessel.id === selectedId;
          return (
            <li key={vessel.id}>
              <button
                type="button"
                onClick={() => setSelectedId(vessel.id)}
                aria-pressed={selected}
                className={`flex w-full flex-col items-center gap-1 rounded-lg border px-4 py-4 text-center transition-colors ${
                  selected
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : "border-zinc-300 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                }`}
              >
                <span className="text-base font-semibold">{vessel.name}</span>
                <span
                  className={`text-xs ${selected ? "opacity-80" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  {vessel.total_seats} seats
                </span>
                {vessel.status === "out_of_service" && (
                  <span className="mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                    Out of service
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {selectedId && (
        <button
          type="button"
          onClick={() => router.push(`/crossings/new?vessel=${selectedId}`)}
          className="mt-4 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Continue with {sorted.find((v) => v.id === selectedId)?.name}
        </button>
      )}
    </div>
  );
}
