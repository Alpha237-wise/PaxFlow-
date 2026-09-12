"use client";

import { useEffect, useState } from "react";

// Production-only: a service worker in dev mode tends to serve stale JS
// bundles over the latest build, which is more annoying than useful while
// iterating.
//
// Update flow (field report 2026-09-10 — the app never updated itself,
// AB had to uninstall/reinstall to get a new deploy): sw.js's own
// install/activate handlers already call skipWaiting()/clients.claim(),
// so a newly-fetched worker takes over network control immediately —
// that part was never the problem (see next.config.ts's headers() for
// the actual root cause, a cached /sw.js). What was missing is this: the
// already-open tab's JS keeps running the OLD bundle until it reloads,
// and nothing here ever told the user that had happened. This component
// now watches for a new worker taking over and shows a "reload" banner
// instead of silently doing nothing (or force-reloading out from under
// someone mid-way through filling in a manifest, which felt riskier than
// asking first — the project owner's own suggested minimum was exactly
// this kind of banner).
export function RegisterServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let registration: ServiceWorkerRegistration | null = null;
    let cancelled = false;

    function watchInstalling(reg: ServiceWorkerRegistration) {
      const installing = reg.installing;
      if (!installing) return;
      // A controller already existing means this page was already being
      // served by a previous worker — this install is a genuine update,
      // not the very first time the app registers a worker at all.
      const isUpdate = Boolean(navigator.serviceWorker.controller);
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && isUpdate && !cancelled) {
          setUpdateAvailable(true);
        }
      });
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;
        // A worker can already be sitting in "waiting" from before this
        // page even loaded (installed while the tab was in the background).
        if (reg.waiting && navigator.serviceWorker.controller) {
          setUpdateAvailable(true);
        }
        reg.addEventListener("updatefound", () => watchInstalling(reg));
      })
      .catch(() => {
        // Best-effort: the app still works online without shell caching.
      });

    // Browsers otherwise only check for a new sw.js on navigation, which a
    // long-lived PWA session (this app is meant to stay open all day) may
    // not do for hours. Check proactively — on load, on return to the
    // foreground, and periodically — instead of waiting on that.
    function checkForUpdate() {
      registration?.update().catch(() => {});
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") checkForUpdate();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(checkForUpdate, 60_000);

    // Fallback signal, independent of the tracking above: the page's
    // active controller actually changed. Only meaningful once this page
    // already had a controller (see isUpdate above) — a first-ever
    // registration also fires this, which would otherwise show the
    // banner on someone's very first visit for no reason.
    let hadControllerAtStart = Boolean(navigator.serviceWorker.controller);
    function handleControllerChange() {
      if (hadControllerAtStart && !cancelled) setUpdateAvailable(true);
      hadControllerAtStart = true;
    }
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    // pb- adds env(safe-area-inset-bottom) on top of the normal py-3 so
    // this doesn't sit flush against an iPhone's home-indicator area (0 on
    // devices/browsers without a safe-area inset, so no effect there).
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 bg-zinc-900 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-sm text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-900">
      <span>New version available</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 dark:bg-zinc-900 dark:text-white"
      >
        Restart
      </button>
    </div>
  );
}
