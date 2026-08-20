"use client";

import { useEffect } from "react";

// Production-only: a service worker in dev mode tends to serve stale JS
// bundles over the latest build, which is more annoying than useful while
// iterating.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Best-effort: the app still works online without shell caching.
      });
    }
  }, []);

  return null;
}
