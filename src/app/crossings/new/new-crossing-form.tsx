"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import Link from "next/link";

function todayLocalISODate(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function NewCrossingForm({
  vesselId,
  userId,
}: {
  vesselId: string | null;
  userId: string;
}) {
  const router = useRouter();
  const vessel = useLiveQuery(
    () => (vesselId ? getDb().vessels.get(vesselId) : undefined),
    [vesselId],
  );

  const [crossingDate, setCrossingDate] = useState(todayLocalISODate());
  const [timeOfDeparture, setTimeOfDeparture] = useState("");
  const [timeOfArrival, setTimeOfArrival] = useState("");
  const [portOfOrigin, setPortOfOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [vesselName, setVesselName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const prefilledRef = useRef(false);

  // Prefill the editable vessel name once the vessel loads (§6 — auto-filled
  // from the chosen BIRD, but the AB can still edit it afterwards, including
  // clearing it, without this effect fighting the edit).
  useEffect(() => {
    if (vessel && !prefilledRef.current) {
      setVesselName(vessel.name);
      prefilledRef.current = true;
    }
  }, [vessel]);

  if (!vesselId) {
    return (
      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Choisis d&apos;abord un BIRD.
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vessel) return;
    setSubmitting(true);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await getDb().crossings.add({
      id,
      vessel_id: vessel.id,
      created_by: userId,
      status: "draft",
      crossing_date: crossingDate,
      time_of_departure: timeOfDeparture || null,
      time_of_arrival: timeOfArrival || null,
      port_of_origin: portOfOrigin || null,
      destination: destination || null,
      vessel_name_override: vesselName !== vessel.name ? vesselName : null,
      captain_on_board: null,
      mechanic: null,
      ab_name: null,
      marine_hostess: null,
      total_guests: null,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: now,
      updated_at: now,
      sync_status: "pending",
    });

    router.push(`/crossings/${id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Nouvelle traversée
      </h1>

      <div>
        <label
          htmlFor="vesselName"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Vessel Name
        </label>
        <input
          id="vesselName"
          type="text"
          required
          value={vesselName}
          onChange={(e) => setVesselName(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div>
        <label
          htmlFor="crossingDate"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Date
        </label>
        <input
          id="crossingDate"
          type="date"
          required
          value={crossingDate}
          onChange={(e) => setCrossingDate(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="timeOfDeparture"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Time of Departure
          </label>
          <input
            id="timeOfDeparture"
            type="time"
            required
            value={timeOfDeparture}
            onChange={(e) => setTimeOfDeparture(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label
            htmlFor="timeOfArrival"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Time of Arrival
          </label>
          <input
            id="timeOfArrival"
            type="time"
            value={timeOfArrival}
            onChange={(e) => setTimeOfArrival(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Peut être renseignée plus tard.
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="portOfOrigin"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Port of Origin
        </label>
        <input
          id="portOfOrigin"
          type="text"
          required
          value={portOfOrigin}
          onChange={(e) => setPortOfOrigin(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div>
        <label
          htmlFor="destination"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Destination
        </label>
        <input
          id="destination"
          type="text"
          required
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <button
        type="submit"
        disabled={!vessel || submitting}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {submitting ? "Création…" : "Créer la traversée"}
      </button>
    </form>
  );
}
