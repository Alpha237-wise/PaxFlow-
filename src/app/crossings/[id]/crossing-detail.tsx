"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { SeatMap } from "./seat-map";
import { CrewGuestsForm } from "./crew-guests-form";
import { SummaryView } from "./summary-view";
import { WhatsAppSummaryView } from "./whatsapp-summary-view";
import { ManifestView } from "./manifest-view";

export function CrossingDetail({
  crossingId,
  userId,
  abDefaultName,
}: {
  crossingId: string;
  userId: string;
  abDefaultName: string | null;
}) {
  // Dexie's .get() resolves to undefined both while a query is pending and
  // when the row genuinely doesn't exist — wrap it so those two states
  // stay distinguishable instead of showing "Loading…" forever for a
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
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
    );
  }

  const crossing = result.crossing;

  if (crossing === undefined) {
    return (
      <div className="text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Crossing not found locally.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
        >
          Back to home
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
          {crossing.status === "draft" ? "Draft" : "Finalized"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500 dark:text-zinc-400">Date</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {crossing.crossing_date}
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Departure</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {crossing.time_of_departure ?? "—"}
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Arrival</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          {crossing.time_of_arrival ?? "—"}
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Origin</dt>
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
            ? "Pending sync"
            : crossing.sync_status === "synced"
              ? "Synced"
              : "Sync error"}
        </dd>
      </dl>

      <SeatMap
        crossingId={crossing.id}
        seatLayoutRef={vessel?.seat_layout_ref ?? "51-seats"}
        userId={userId}
      />

      <CrewGuestsForm
        key={crossing.id}
        crossingId={crossing.id}
        userId={userId}
        abDefaultName={abDefaultName}
        initialCaptainOnBoard={crossing.captain_on_board}
        initialMechanic={crossing.mechanic}
        initialAbName={crossing.ab_name}
        initialMarineHostess={crossing.marine_hostess}
        initialTotalGuests={crossing.total_guests}
      />

      <SummaryView crossingId={crossing.id} />

      <ManifestView
        crossingId={crossing.id}
        vesselName={vesselLabel}
        crossing={crossing}
      />

      <WhatsAppSummaryView
        crossingId={crossing.id}
        vesselName={vesselLabel}
        portOfOrigin={crossing.port_of_origin}
        destination={crossing.destination}
        timeOfDeparture={crossing.time_of_departure}
        marineHostess={crossing.marine_hostess}
        captainOnBoard={crossing.captain_on_board}
        totalGuests={crossing.total_guests}
      />

      <Link
        href="/"
        className="block text-center text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
      >
        Back to home
      </Link>
    </div>
  );
}
