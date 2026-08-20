"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { summarizeCrossing } from "@/lib/crossing-summary";

export function SummaryView({ crossingId }: { crossingId: string }) {
  const passengers = useLiveQuery(
    () => getDb().passengers.where("crossing_id").equals(crossingId).toArray(),
    [crossingId],
  );

  const summary = summarizeCrossing(passengers ?? []);

  return (
    <div className="w-full max-w-sm space-y-3">
      <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Summary
      </h2>

      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-800">
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {summary.totalTM}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">TM</p>
        </div>
        <div className="flex-1 rounded-lg border border-zinc-200 p-3 text-center dark:border-zinc-800">
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {summary.totalCC}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">CC</p>
        </div>
      </div>

      {summary.tmByDepartment.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            TM by department
          </h3>
          <ul className="space-y-0.5 text-sm">
            {summary.tmByDepartment.map((g) => (
              <li
                key={g.label}
                className="flex justify-between text-zinc-700 dark:text-zinc-300"
              >
                <span>{g.label}</span>
                <span className="font-medium">{g.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.ccByGroup.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            CC by department/company
          </h3>
          <ul className="space-y-0.5 text-sm">
            {summary.ccByGroup.map((g) => (
              <li
                key={g.label}
                className="flex justify-between text-zinc-700 dark:text-zinc-300"
              >
                <span>{g.label}</span>
                <span className="font-medium">{g.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
