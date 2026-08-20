"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";

export function HistoryView({ userId }: { userId: string }) {
  const [dateFilter, setDateFilter] = useState("");
  const [vesselFilter, setVesselFilter] = useState("");

  const crossings = useLiveQuery(
    () => getDb().crossings.where("created_by").equals(userId).toArray(),
    [userId],
  );
  const vessels = useLiveQuery(() => getDb().vessels.toArray(), []);

  const vesselById = new Map((vessels ?? []).map((v) => [v.id, v]));

  const filtered = (crossings ?? [])
    .filter((c) => !dateFilter || c.crossing_date === dateFilter)
    .filter((c) => !vesselFilter || c.vessel_id === vesselFilter)
    .sort((a, b) => b.crossing_date.localeCompare(a.crossing_date) || b.created_at.localeCompare(a.created_at));

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          History
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
        >
          Back to home
        </Link>
      </div>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        History is kept for 30 days — older crossings are automatically
        deleted (§15.1).
      </p>

      <div className="flex gap-2">
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={vesselFilter}
          onChange={(e) => setVesselFilter(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">All BIRDs</option>
          {(vessels ?? [])
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No crossings found.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => {
            const vesselLabel =
              c.vessel_name_override || vesselById.get(c.vessel_id ?? "")?.name || "—";
            return (
              <li key={c.id}>
                <Link
                  href={`/crossings/${c.id}`}
                  className="block rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {vesselLabel}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {c.crossing_date}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                    <span>
                      {c.port_of_origin ?? "—"} → {c.destination ?? "—"}
                    </span>
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {c.status === "draft" ? "Draft" : "Finalized"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
