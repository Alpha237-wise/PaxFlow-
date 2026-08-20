"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";
import { buildWhatsAppSummary } from "@/lib/whatsapp-summary";

function MessageBlock({
  label,
  text,
  canShare,
}: {
  label: string;
  text: string;
  canShare: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    try {
      await navigator.share({ text });
    } catch {
      // User cancelled the share sheet — not an error.
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </h3>
      <pre className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50">
        {text}
      </pre>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          {copied ? "Copié !" : "Copier"}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={handleShare}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            Partager sur WhatsApp
          </button>
        )}
      </div>
    </div>
  );
}

export function WhatsAppSummaryView({
  crossingId,
  vesselName,
  portOfOrigin,
  destination,
  marineHostess,
  captainOnBoard,
}: {
  crossingId: string;
  vesselName: string;
  portOfOrigin: string | null;
  destination: string | null;
  marineHostess: string | null;
  captainOnBoard: string | null;
}) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    // Deliberate exception to react-hooks/set-state-in-effect: `navigator`
    // doesn't exist during SSR, so a lazy useState initializer would give
    // false on the server but true on the client's first render — a
    // hydration mismatch. Starting at false and flipping post-mount is the
    // standard fix.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const passengers = useLiveQuery(
    () => getDb().passengers.where("crossing_id").equals(crossingId).toArray(),
    [crossingId],
  );

  const { message1, message2 } = buildWhatsAppSummary({
    portOfOrigin,
    destination,
    marineHostess,
    captainOnBoard,
    vesselName,
    passengers: passengers ?? [],
  });

  return (
    <div className="w-full max-w-sm space-y-4">
      <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Résumé WhatsApp
      </h2>
      <MessageBlock label="Message 1" text={message1} canShare={canShare} />
      <MessageBlock label="Message 2" text={message2} canShare={canShare} />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Pour joindre le manifeste au Message 1 : télécharge-le ci-dessous
        (Image ou PDF), puis ajoute-le dans WhatsApp juste après avoir
        partagé ce texte (§8.2 — pièce jointe manuelle, le format de
        partage du texte seul ne permet pas toujours d&apos;attacher un
        fichier automatiquement).
      </p>
    </div>
  );
}
