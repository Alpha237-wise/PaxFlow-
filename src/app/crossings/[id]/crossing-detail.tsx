"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import type { LocalCrossing } from "@/lib/db/schema";
import { todayLocalISODate } from "@/lib/date";
import { SeatMap } from "./seat-map";
import { CrewGuestsForm } from "./crew-guests-form";
import { SummaryView } from "./summary-view";
import { WhatsAppSummaryView } from "./whatsapp-summary-view";
import {
  useManifestExport,
  ManifestQuickActions,
  ManifestPreviewSection,
} from "./manifest-view";

// Tap-to-edit for the crossing header fields (BIRD/Date/Departure/Arrival/
// Origin/Destination) — added 2026-09-10 so a mistake doesn't require
// abandoning the crossing via "Back to New crossing" and starting over.
// Writes straight through Dexie (via the onSave callback the caller
// supplies), the same table WhatsAppSummaryView/useManifestExport already
// read reactively — there's no separate cache for this data anywhere, so
// a save here is immediately what the summary/manifest next generate
// from, with no extra plumbing needed to keep them in sync.
function EditableField({
  value,
  placeholder,
  type = "text",
  required = false,
  onSave,
  className = "",
  inputClassName = "",
}: {
  value: string;
  placeholder: string;
  type?: "text" | "date" | "time";
  required?: boolean;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    if (type !== "text") {
      // Opens the native date/time picker immediately on tap instead of
      // requiring a second tap into the now-focused input.
      try {
        inputRef.current?.showPicker?.();
      } catch {
        // Not supported in this browser — the input is still usable,
        // just requires the user's own tap to open the picker.
      }
    }
  }, [editing, type]);

  function commit(raw: string) {
    setEditing(false);
    const next = type === "text" ? raw.trim() : raw;
    if (required && !next) return; // revert to the previous value, never save blank
    if (next !== value) onSave(next);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          // A date/time picker selection fully expresses intent on its
          // own — commit right away rather than waiting for a blur that
          // some mobile browsers delay until well after the picker closes.
          if (type !== "text") commit(e.target.value);
        }}
        onBlur={() => {
          if (type === "text") commit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`w-full rounded border border-zinc-400 bg-white px-1.5 py-0.5 dark:border-zinc-600 dark:bg-zinc-800 ${inputClassName}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`w-full border-b border-dashed border-zinc-300 text-left dark:border-zinc-700 ${className}`}
    >
      {value || placeholder}
    </button>
  );
}

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
  const router = useRouter();

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

  // Same bookkeeping crew-guests-form.tsx already does on save: mark
  // pending so the next sync cycle pushes it, and clear any stale error
  // since this row is about to be resent. WhatsAppSummaryView/
  // useManifestExport read `crossing` straight from this same live query,
  // so a write here is what they generate from on their very next render
  // — no separate cache to invalidate.
  async function updateCrossingField(
    patch: Partial<
      Pick<
        LocalCrossing,
        | "crossing_date"
        | "time_of_departure"
        | "time_of_arrival"
        | "port_of_origin"
        | "destination"
        | "vessel_name_override"
      >
    >,
  ) {
    await getDb().crossings.update(crossingId, {
      ...patch,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
      sync_error: null,
    });
  }

  // "Next Crossing" (2026-09-10): stays on the same BIRD — chosen once,
  // reused for a whole shift's back-to-back crossings — so this skips the
  // "Choose BIRD" home screen entirely rather than routing through it
  // again. Only Date/Time of Departure get a smart default (today, and
  // this crossing's own arrival time as the next leg's likely departure);
  // Origin/Destination/crew are left blank rather than guessed, since
  // there's no similarly obvious default for those. Everything is still
  // just an inline-edit tap away on the new crossing's own detail screen
  // if the guess is wrong. To switch vessel instead, go back to Home, same
  // as before — this shortcut is deliberately single-purpose.
  async function handleNextCrossing() {
    // Re-checked locally (already guaranteed true at the only call site,
    // the button below): TS doesn't carry the outer undefined-check's
    // narrowing into a nested function declaration's closure.
    if (!crossing || !crossing.vessel_id) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await getDb().crossings.add({
      id,
      vessel_id: crossing.vessel_id,
      created_by: userId,
      status: "draft",
      crossing_date: todayLocalISODate(),
      time_of_departure: crossing.time_of_arrival,
      time_of_arrival: null,
      port_of_origin: null,
      destination: null,
      vessel_name_override: crossing.vessel_name_override,
      captain_on_board: null,
      mechanic: null,
      ab_name: null,
      marine_hostess: null,
      total_guests: null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: now,
      updated_at: now,
      sync_status: "pending",
      sync_error: null,
    });
    router.push(`/crossings/${id}`);
  }

  return (
    // max-w-2xl from md: up — wide enough for the seat map's three blocks
    // (~437px) to sit side by side without horizontal scroll on tablets;
    // narrower sections below (crew form, summary, WhatsApp text) keep
    // their own max-w-sm so they don't stretch into hard-to-read wide
    // lines just because the page around them got wider.
    <div className="w-full max-w-sm space-y-4 md:max-w-2xl">
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

      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 flex-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          <EditableField
            value={crossing.vessel_name_override ?? vessel?.name ?? ""}
            placeholder="BIRD name"
            onSave={(v) => {
              // Matches new-crossing-form.tsx's own convention: no
              // override stored when it's just the vessel's own name, so
              // an edit that reaffirms the default doesn't leave a
              // redundant explicit value behind.
              updateCrossingField({
                vessel_name_override: v === vessel?.name ? null : v,
              });
            }}
            inputClassName="text-lg font-semibold"
          />
        </h1>
        <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {crossing.status === "draft" ? "Draft" : "Finalized"}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500 dark:text-zinc-400">Date</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          <EditableField
            value={crossing.crossing_date}
            placeholder="—"
            type="date"
            required
            onSave={(v) => updateCrossingField({ crossing_date: v })}
          />
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Departure</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          <EditableField
            value={crossing.time_of_departure ?? ""}
            placeholder="—"
            type="time"
            onSave={(v) => updateCrossingField({ time_of_departure: v || null })}
          />
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Arrival</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          <EditableField
            value={crossing.time_of_arrival ?? ""}
            placeholder="—"
            type="time"
            onSave={(v) => updateCrossingField({ time_of_arrival: v || null })}
          />
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Origin</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          <EditableField
            value={crossing.port_of_origin ?? ""}
            placeholder="—"
            onSave={(v) => updateCrossingField({ port_of_origin: v || null })}
          />
        </dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Destination</dt>
        <dd className="text-zinc-900 dark:text-zinc-50">
          <EditableField
            value={crossing.destination ?? ""}
            placeholder="—"
            onSave={(v) => updateCrossingField({ destination: v || null })}
          />
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

      {crossing.vessel_id && (
        <button
          type="button"
          onClick={handleNextCrossing}
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Next Crossing ({vesselLabel})
        </button>
      )}

      <Link
        href="/"
        className="block text-center text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
      >
        Home
      </Link>
    </div>
  );
}
