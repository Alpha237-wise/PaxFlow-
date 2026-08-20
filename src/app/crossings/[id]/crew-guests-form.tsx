"use client";

import { useEffect, useState } from "react";
import { getDb } from "@/lib/db";
import type { LocalKnownCrew } from "@/lib/db/schema";
import {
  rememberCrewMember,
  searchKnownCrew,
  type CrewRole,
} from "@/lib/known-crew";

function CrewNameField({
  label,
  role,
  userId,
  value,
  onChange,
}: {
  label: string;
  role: CrewRole;
  userId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<LocalKnownCrew[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    let active = true;
    searchKnownCrew(userId, role, value).then((results) => {
      if (active) setSuggestions(results);
    });
    return () => {
      active = false;
    };
  }, [userId, role, value]);

  const id = `crew-${role}`;

  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setShowSuggestions(false)}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-md border border-zinc-300 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {suggestions.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onMouseDown={() => {
                  onChange(person.name);
                  setShowSuggestions(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CrewGuestsForm({
  crossingId,
  userId,
  abDefaultName,
  initialCaptainOnBoard,
  initialMechanic,
  initialAbName,
  initialMarineHostess,
  initialTotalGuests,
}: {
  crossingId: string;
  userId: string;
  abDefaultName: string | null;
  initialCaptainOnBoard: string | null;
  initialMechanic: string | null;
  initialAbName: string | null;
  initialMarineHostess: string | null;
  initialTotalGuests: number | null;
}) {
  const [captainOnBoard, setCaptainOnBoard] = useState(
    initialCaptainOnBoard ?? "",
  );
  const [mechanic, setMechanic] = useState(initialMechanic ?? "");
  // §7: AB defaults to the connected account's name, editable, but only
  // when the field hasn't already been filled in on this crossing.
  const [abName, setAbName] = useState(initialAbName ?? abDefaultName ?? "");
  const [marineHostess, setMarineHostess] = useState(
    initialMarineHostess ?? "",
  );
  const [totalGuests, setTotalGuests] = useState(
    initialTotalGuests != null ? String(initialTotalGuests) : "",
  );
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await getDb().crossings.update(crossingId, {
      captain_on_board: captainOnBoard.trim() || null,
      mechanic: mechanic.trim() || null,
      ab_name: abName.trim() || null,
      marine_hostess: marineHostess.trim() || null,
      total_guests: totalGuests.trim() ? Number(totalGuests) : null,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    });

    const rememberJobs: Promise<void>[] = [];
    if (captainOnBoard.trim())
      rememberJobs.push(rememberCrewMember(userId, "captain", captainOnBoard));
    if (mechanic.trim())
      rememberJobs.push(rememberCrewMember(userId, "mechanic", mechanic));
    if (abName.trim())
      rememberJobs.push(rememberCrewMember(userId, "ab", abName));
    if (marineHostess.trim())
      rememberJobs.push(
        rememberCrewMember(userId, "marine_hostess", marineHostess),
      );
    await Promise.all(rememberJobs);

    setSaving(false);
    setJustSaved(true);
  }

  return (
    <form onSubmit={handleSave} className="w-full max-w-sm space-y-3">
      <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Équipage &amp; Guests
      </h2>

      <CrewNameField
        label="Captain on board"
        role="captain"
        userId={userId}
        value={captainOnBoard}
        onChange={(v) => {
          setCaptainOnBoard(v);
          setJustSaved(false);
        }}
      />
      <CrewNameField
        label="Mechanic"
        role="mechanic"
        userId={userId}
        value={mechanic}
        onChange={(v) => {
          setMechanic(v);
          setJustSaved(false);
        }}
      />
      <CrewNameField
        label="AB"
        role="ab"
        userId={userId}
        value={abName}
        onChange={(v) => {
          setAbName(v);
          setJustSaved(false);
        }}
      />
      <CrewNameField
        label="Marine Hostess"
        role="marine_hostess"
        userId={userId}
        value={marineHostess}
        onChange={(v) => {
          setMarineHostess(v);
          setJustSaved(false);
        }}
      />

      <div>
        <label
          htmlFor="totalGuests"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Total No. of Guest
        </label>
        <input
          id="totalGuests"
          type="number"
          inputMode="numeric"
          min={0}
          value={totalGuests}
          onChange={(e) => {
            setTotalGuests(e.target.value);
            setJustSaved(false);
          }}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-800"
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Informatif — non comptabilisé dans les totaux TM/CC (§4.2).
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900"
        >
          Enregistrer
        </button>
        {justSaved && (
          <span className="text-sm text-emerald-700 dark:text-emerald-400">
            Enregistré
          </span>
        )}
      </div>
    </form>
  );
}
