"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { SeatMap } from "./seat-map";
import { CrewGuestsForm } from "./crew-guests-form";
import { SummaryView } from "./summary-view";
import { WhatsAppSummaryView } from "./whatsapp-summary-view";
import {
  useManifestExport,
  ManifestQuickActions,
  ManifestPreviewSection,
} from "./manifest-view";

// Placeholder ManifestCrossingInput used only while the real crossing is
// still loading — useManifestExport must be called unconditionally (rules
// of hooks), before we know whether `crossing` exists yet.
const EMPTY_MANIFEST_CROSSING = {
  crossing_date: "",
  time_of_departure: null,
  time_of_arrival: null,
  port_of_origin: null,
  destination: null,
  captain_on_board: null,
  mechanic: null,
  ab_name: null,
  marine_hostess: null,
  total_guests: null,
};

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

  const crossing = result?.crossing;
  const vesselLabel = crossing?.vessel_name_override || vessel?.name || "—";

  // App-wide flag, not per-crossing (§16.7 sync reliability fix,
  // 2026-09-10) — an expired session makes every pending row look like it
  // has a data error, when really the whole session needs a fresh login.
  const syncMeta = useLiveQuery(() => getDb().sync_meta.get("status"), []);
  const needsReauth = syncMeta?.needs_reauth ?? false;

  const manifestExport = useManifestExport({
    crossingId,
    vesselName: vesselLabel,
    crossing: crossing ?? EMPTY_MANIFEST_CROSSING,
    seatLayoutRef: vessel?.seat_layout_ref ?? "51-seats",
  });

  if (result === undefined) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>
    );
  }

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

  return (
    <div className="w-full max-w-sm space-y-4">
      <Link
        href={
          crossing.vessel_id
            ? `/crossings/new?vessel=${crossing.vessel_id}`
            : "/"
        }
        className="inline-block text-sm font-medium text-zinc-600 underline dark:text-zinc-400"
      >
        ← Back to New crossing
      </Link>

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
          {needsReauth ? (
            <span className="text-amber-700 dark:text-amber-400">
              Reconnect to sync
            </span>
          ) : crossing.sync_status === "pending" ? (
            "Pending sync"
          ) : crossing.sync_status === "synced" ? (
            "Synced"
          ) : (
            "Sync error"
          )}
        </dd>
      </dl>

      {needsReauth && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Your session expired (likely from a long stretch offline) and
          couldn&apos;t refresh automatically — nothing has synced since. Log
          in again to resume.{" "}
          <Link href="/login" className="font-medium underline">
            Go to login
          </Link>
        </p>
      )}

      {!needsReauth && crossing.sync_status === "error" && crossing.sync_error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-300">
          Sync error: {crossing.sync_error}
        </p>
      )}

      <ManifestQuickActions
        busy={manifestExport.busy}
        handleDownloadPdf={manifestExport.handleDownloadPdf}
        handleDownloadImage={manifestExport.handleDownloadImage}
      />

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

      <ManifestPreviewSection {...manifestExport} />

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
        Home
      </Link>
    </div>
  );
}
