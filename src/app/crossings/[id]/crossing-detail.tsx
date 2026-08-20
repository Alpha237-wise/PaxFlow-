"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { SeatMap } from "./seat-map";

export function CrossingDetail({
  crossingId,
  userId,
}: {
  crossingId: string;
  userId: string;
}) {
  // Dexie's .get() resolves to undefined both while a query is pending and
  // when the row genuinely doesn't exist — wrap it so those two states
  // stay distinguishable instead of showing "Chargement…" forever for a
  // missing id.
  const result = useLiveQuery(
    async () => ({ crossing: await getDb().crossings.get(crossingId) }),
    [crossingId],
  );
  const vessel = useLiveQuery(
    () =>
      result?.crossing?.vessel_id
        ? getDb().vessels.get(result.crossing.vessel_id)
        : undefined,
    [result?.crossing?.vessel_id],
  );

  if (result === undefined) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Chargement…</p>
    );
  }

  const crossing = result.crossing;

  if (crossing === undefined) {
    return (
      <div className="text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Traversée introuvable localement.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  const vesselLabel = crossing.vessel_name_override || vessel?.name || "—";

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {vesselLabel}
        </h1>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {crossing.status === "draft" ? "Brouillon" : "Finalisée"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500 dark:text-zinc-400">Date</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {crossing.crossing_date}
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Départ</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {crossing.time_of_departure ?? "—"}
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Arrivée</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {crossing.time_of_arrival ?? "—"}
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Origine</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {crossing.port_of_origin ?? "—"}
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Destination</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {crossing.destination ?? "—"}
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Sync</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {crossing.sync_status === "pending"
            ? "En attente de synchronisation"
            : crossing.sync_status === "synced"
              ? "Synchronisée"
              : "Erreur de synchronisation"}
        </dd>
      </dl>

      <SeatMap
        crossingId={crossing.id}
        seatLayoutRef={vessel?.seat_layout_ref ?? "51-seats"}
        userId={userId}
      />

      <Link
        href="/"
        className="block text-center text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
