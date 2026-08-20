"use client";

import { useState } from "react";
import Link from "next/link";
import { clearMyHistory, resetAllMyData } from "@/lib/sync";

const RESET_CONFIRM_WORD = "DELETE";

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
        instead of waiting for the automatic 30-day purge (§15.1). Does{" "}
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
        <ClearHistorySection userId={userId} />
        <FullResetSection userId={userId} />
      </div>
    </div>
  );
}
