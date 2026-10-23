// Shared manifest reference photos — one global row/file PER paper form
// (§21 "manifest photo overlay" architecture, 2026-08-20, extended
// 2026-10-14 with a second form for BIRD 9/10), replacing the earlier coded
// HTML template. Each form has a single well-known row id so every
// read/write agrees on which row is "the" template for that form without an
// extra lookup.
//
// The form is chosen by the vessel's seat_layout_ref and by nothing else: a
// crossing on a 50-seat BIRD can only ever resolve to the 50-seat image, and
// when that image hasn't been downloaded yet the view falls back to the
// coded reconstruction — it never falls back to the OTHER form's image.
import { createClient } from "./supabase/client";
import { getDb } from "./db";
import type { SeatLayoutRef } from "./seat-layouts";

export const MANIFEST_TEMPLATE_BUCKET = "manifest-template";

export interface ManifestTemplateSlot {
  /** manifest_template.id of this form's row in Supabase. */
  rowId: string;
  /** Object path inside the manifest-template bucket. */
  storagePath: string;
  /** Primary key of this form's cached copy in the local Dexie table. */
  localId: "current" | "50-seats" | "45-seats";
}

// "51-seats" keeps the original row id / storage path / local key so
// existing deployments and already-synced devices are untouched.
export const MANIFEST_TEMPLATES: Record<SeatLayoutRef, ManifestTemplateSlot> = {
  "51-seats": {
    rowId: "11111111-1111-1111-1111-111111111111",
    storagePath: "current.png",
    localId: "current",
  },
  "50-seats": {
    rowId: "22222222-2222-2222-2222-222222222222",
    storagePath: "current-50-seats.png",
    localId: "50-seats",
  },
  "45-seats": {
    rowId: "33333333-3333-3333-3333-333333333333",
    storagePath: "current-45-seats.png",
    localId: "45-seats",
  },
};

export const SEAT_LAYOUT_REFS = Object.keys(MANIFEST_TEMPLATES) as SeatLayoutRef[];

export interface ManifestTemplateMeta {
  storage_path: string;
  updated_at: string;
}

// The ONLY way the view reads a cached template: strictly this layout's own
// slot, or undefined (never another layout's image) when it hasn't been
// downloaded yet, or when the layout itself is still unknown (null — the
// vessel hasn't resolved).
export async function getCachedManifestTemplate(layoutRef: SeatLayoutRef | null) {
  if (!layoutRef) return undefined;
  return getDb().manifest_template.get(MANIFEST_TEMPLATES[layoutRef].localId);
}

async function pullOne(layoutRef: SeatLayoutRef): Promise<void> {
  const slot = MANIFEST_TEMPLATES[layoutRef];
  const db = getDb();
  const supabase = createClient();

  const { data: row, error } = await supabase
    .from("manifest_template")
    .select("storage_path, updated_at")
    .eq("id", slot.rowId)
    .maybeSingle();
  if (error || !row) return;

  const local = await db.manifest_template.get(slot.localId);
  if (
    local &&
    local.storage_path === row.storage_path &&
    local.updated_at === row.updated_at
  ) {
    return;
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(MANIFEST_TEMPLATE_BUCKET)
    .download(row.storage_path);
  if (downloadError || !blob) return;

  await db.manifest_template.put({
    id: slot.localId,
    blob,
    storage_path: row.storage_path,
    updated_at: row.updated_at,
  });
}

// Pulls each shared template into the local Dexie cache if the remote copy
// is newer (or nothing is cached yet) — same "pull once, work offline
// after" pattern as vessels/known_people (§16.7). Called from the sync
// engine; also safe to call directly right after an upload. Each form is
// pulled independently so one missing/failed form never blocks the other.
export async function pullManifestTemplate(): Promise<void> {
  for (const layoutRef of SEAT_LAYOUT_REFS) {
    try {
      await pullOne(layoutRef);
    } catch {
      // Network unreachable.
    }
  }
}

// Uploads a new (already perspective-corrected, if it was a photo) template
// image for ONE paper form, overwriting whatever was there before — this is
// also how "Replace" works, not just the first upload; same flow either
// way. `layoutRef` is required (no default) so an upload can never silently
// land on the wrong form's slot.
export async function uploadManifestTemplate(
  blob: Blob,
  uploadedBy: string,
  layoutRef: SeatLayoutRef,
): Promise<{ error: string | null }> {
  const slot = MANIFEST_TEMPLATES[layoutRef];
  const supabase = createClient();

  // cacheControl: "0" — this path is a fixed well-known name that gets
  // overwritten in place on every replace, and the app already does its own
  // freshness check via manifest_template.updated_at before deciding to
  // re-download at all (pullManifestTemplate). An HTTP-level cache on top of
  // that only adds a way for a replaced template to look "stuck" on stale
  // bytes for up to its max-age, with no upside.
  const { error: uploadError } = await supabase.storage
    .from(MANIFEST_TEMPLATE_BUCKET)
    .upload(slot.storagePath, blob, {
      upsert: true,
      contentType: blob.type || "image/png",
      cacheControl: "0",
    });
  if (uploadError) return { error: uploadError.message };

  const now = new Date().toISOString();
  const { error: rowError } = await supabase.from("manifest_template").upsert({
    id: slot.rowId,
    storage_path: slot.storagePath,
    uploaded_by: uploadedBy,
    updated_at: now,
  });
  if (rowError) return { error: rowError.message };

  // Refresh the local cache immediately so the uploader doesn't have to
  // wait for the next sync tick to see/use the new template.
  await getDb().manifest_template.put({
    id: slot.localId,
    blob,
    storage_path: slot.storagePath,
    updated_at: now,
  });

  return { error: null };
}
