"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import type { LocalProfile } from "@/lib/db/schema";
import { clearMyHistory, resetAllMyData, runSync, setManifestInk } from "@/lib/sync";
import {
  DEFAULT_MANIFEST_INK,
  MANIFEST_INKS,
  MANIFEST_INK_KEYS,
  isManifestInk,
  type ManifestInk,
} from "@/lib/manifest-ink";

const RESET_CONFIRM_WORD = "DELETE";

// Manifest writing colour (§9.7): three dark, low-saturation inks, applied to
// everything this AB writes on their generated manifests. Per user, purely
// cosmetic; navy (the original colour) unless they pick another.
function ManifestInkSection({
  userId,
  fullName,
  role,
}: {
  userId: string;
  fullName: string | null;
  role: string;
}) {
  const profile = useLiveQuery(() => getDb().profiles.get(userId), [userId]);
  const current: ManifestInk = isManifestInk(profile?.manifest_ink)
    ? profile.manifest_ink
    : DEFAULT_MANIFEST_INK;

  async function pick(ink: ManifestInk) {
    await setManifestInk(userId, ink, {
      full_name: fullName,
      role: role as LocalProfile["role"],
    });
    void runSync(userId); // push now if online; otherwise the next cycle does
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Manifest writing colour
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Colour of everything you write on your generated manifests. Purely
        cosmetic — it changes nothing about TM/CC or any total.
      </p>
      <div role="radiogroup" aria-label="Manifest writing colour" className="mt-3 flex gap-3">
        {MANIFEST_INK_KEYS.map((ink) => {
          const selected = ink === current;
          return (
            <button
              key={ink}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => void pick(ink)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-2 ${
                selected
                  ? "border-zinc-900 ring-2 ring-zinc-900 dark:border-zinc-50 dark:ring-zinc-50"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <span
                aria-hidden
                className="h-8 w-8 rounded-full"
                style={{ backgroundColor: MANIFEST_INKS[ink].color }}
              />
              <span className="text-xs text-zinc-700 dark:text-zinc-300">
                {MANIFEST_INKS[ink].label}
              </span>
            </button>
          );
        })}
      </div>
      <p
        className="mt-3 text-base font-bold"
        style={{ color: MANIFEST_INKS[current].color }}
      >
        Mohammed Al-Sayed · 06:30
      </p>
    </section>
  );
}

function ClearHistorySection({ userId }: { userId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    await clearMyHistory(userId);
    setBusy(false);
    setConfirming(false);
    setDone(true);
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Clear my history
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Deletes all of your crossings and their passengers, right now —
        instead of waiting for the automatic 14-day purge (§15.1). Does{" "}
        <strong>not</strong> touch your memorized people/crew.
      </p>

      {confirming ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            Delete all your crossings?
          </span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="ml-auto rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Clearing…" : "Yes, clear it"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
            setDone(false);
          }}
          className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 dark:border-red-900 dark:text-red-400"
        >
          Clear my history
        </button>
      )}
      {done && (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
          History cleared.
        </p>
      )}
    </section>
  );
}

function FullResetSection({ userId }: { userId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    await resetAllMyData(userId);
    setBusy(false);
    setConfirming(false);
    setWord("");
    setDone(true);
  }

  return (
    <section className="rounded-lg border border-red-300 p-4 dark:border-red-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Full reset
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Deletes <strong>everything</strong>: all your crossings and
        passengers, plus your memorized people and crew (§4.7). This is
        irreversible and cannot be undone.
      </p>

      {confirming ? (
        <div className="mt-3 space-y-2">
          <label
            htmlFor="resetWord"
            className="block text-sm text-zinc-700 dark:text-zinc-300"
          >
            Type <strong>{RESET_CONFIRM_WORD}</strong> to confirm.
          </label>
          <input
            id="resetWord"
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setWord("");
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || word !== RESET_CONFIRM_WORD}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Resetting…" : "Reset everything"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
            setDone(false);
          }}
          className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          Full reset
        </button>
      )}
      {done && (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
          Everything has been reset.
        </p>
      )}
    </section>
  );
}

export function ProfileView({
  userId,
  fullName,
  email,
  role,
}: {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string;
}) {
  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Profile
        </h1>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
        >
          Back to home
        </Link>
      </div>

      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        <p>{fullName || email}</p>
        <p>{role}</p>
      </div>

      <div className="space-y-3">
        <ManifestInkSection userId={userId} fullName={fullName} role={role} />
        <ClearHistorySection userId={userId} />
        <FullResetSection userId={userId} />
      </div>
    </div>
  );
}
