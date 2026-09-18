"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { signOut } from "./login/actions";

// Reads the signed-in user's own name/role from the local cache
// (populated by sync.ts's pullProfile, same pattern as VesselChooser reads
// vessels) instead of page.tsx fetching it server-side on every load —
// that used to make Home wait on a real Supabase round-trip just to show
// a greeting and decide whether to show the Supervision/Admin links
// (2026-09-18 field report: ~600ms added to every single Home visit, and
// Home failed outright with no network at all). userEmail is the one
// piece of identity info that's already known immediately, straight from
// the session — used as a fallback while the profile cache is still
// empty (first-ever visit) or hasn't caught up yet. Role-gating these two
// links is a UX nicety, not the real access control — the /admin and
// /super-admin pages' own checks (and RLS underneath) are what actually
// gate access, same principle as everywhere else in this app.
export function HomeHeader({ userId, userEmail }: { userId: string; userEmail: string }) {
  const profile = useLiveQuery(() => getDb().profiles.get(userId), [userId]);
  const displayName = profile?.full_name || userEmail;
  const role = profile?.role ?? "user";

  return (
    <div className="flex w-full max-w-sm items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          PaxFlow
        </h1>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {displayName} ({role})
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/history"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          History
        </Link>
        <Link
          href="/profile"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Profile
        </Link>
        {(role === "admin" || role === "super_admin") && (
          <Link
            href="/admin"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Supervision
          </Link>
        )}
        {role === "super_admin" && (
          <Link
            href="/super-admin"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Admin
          </Link>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
