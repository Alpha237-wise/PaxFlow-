"use client";

import { useEffect } from "react";
import { runSync } from "@/lib/sync";

const RETRY_INTERVAL_MS = 60_000;

// Mounted on every authenticated page. Retry-based sync (§16.7) — no
// Background Sync API, see src/lib/sync.ts for why.
export function SyncEngine({ userId }: { userId: string }) {
  useEffect(() => {
    let cancelled = false;
    function trigger() {
      if (!cancelled) void runSync(userId);
    }

    trigger();

    function handleVisibility() {
      if (document.visibilityState === "visible") trigger();
    }

    window.addEventListener("online", trigger);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(trigger, RETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.removeEventListener("online", trigger);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [userId]);

  return null;
}
