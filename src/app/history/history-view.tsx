"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { deleteCrossing } from "@/lib/sync";
import type { LocalCrossing, LocalVessel } from "@/lib/db/schema";

function HistoryItem({
  crossing,
  vesselLabel,
}: {
  crossing: LocalCrossing;
  vesselLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await deleteCrossing(crossing.id);
    // No need to reset state — the row disappears once Dexie's liveQuery
    // re-fires with this crossing gone.
  }

  return (
    <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <Link href={`/crossings/${crossing.id}`} className="block">
        <div className="flex items-center justify-between">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {vesselLabel}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {crossing.crossing_date}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            {crossing.port_of_origin ?? "—"} → {crossing.destination ?? "—"}
          </span>
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {crossing.status === "draft" ? "Draft" : "Finalized"}
          </span>
        </div>
      </Link>

      <div className="mt-2 flex justify-end gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        {confirming ? (
          <>
            <span className="mr-auto self-center text-xs text-zinc-500 dark:text-zinc-400">
              Delete this crossing?
            </span>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-red-700 disabled:opacity-50 dark:text-red-400"
            >
              {deleting ? "Deleting…" : "Confirm delete"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs font-medium text-red-700 dark:text-red-400"
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

export function HistoryView({ userId }: { userId: string }) {
  const [dateFilter, setDateFilter] = useState("");
  const [vesselFilter, setVesselFilter] = useState("");

  const crossings = useLiveQuery(
    () => getDb().crossings.where("created_by").equals(userId).toArray(),
    [userId],
  );
  const vessels = useLiveQuery(() => getDb().vessels.toArray(), []);

  const vesselById = new Map<string, LocalVessel>(
    (vessels ?? []).map((v) => [v.id, v]),
  );

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
        deleted (§15.1). You can also delete a crossing here at any time,
        or clear everything at once from your Profile.
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
          {filtered.map((c) => (
            <HistoryItem
              key={c.id}
              crossing={c}
              vesselLabel={
                c.vessel_name_override || vesselById.get(c.vessel_id ?? "")?.name || "—"
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
