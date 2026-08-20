// Shared manifest reference photo/PDF — one global row/file (§21 "manifest
// photo overlay" architecture, 2026-08-20), replacing the earlier coded
// HTML template. Single well-known row id so every read/write agrees on
// which row is "the" template without an extra lookup.
import { createClient } from "./supabase/client";
import { getDb } from "./db";

export const MANIFEST_TEMPLATE_BUCKET = "manifest-template";
export const MANIFEST_TEMPLATE_ROW_ID = "11111111-1111-1111-1111-111111111111";
export const MANIFEST_TEMPLATE_STORAGE_PATH = "current.png";

export interface ManifestTemplateMeta {
  storage_path: string;
  updated_at: string;
}

// Pulls the shared template into the local Dexie cache if the remote copy
// is newer (or nothing is cached yet) — same "pull once, work offline
// after" pattern as vessels/known_people (§16.7). Called from the sync
// engine; also safe to call directly right after an upload.
export async function pullManifestTemplate(): Promise<void> {
  const db = getDb();
  const supabase = createClient();
  try {
    const { data: row, error } = await supabase
      .from("manifest_template")
      .select("storage_path, updated_at")
      .eq("id", MANIFEST_TEMPLATE_ROW_ID)
      .maybeSingle();
    if (error || !row) return;

    const local = await db.manifest_template.get("current");
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
      id: "current",
      blob,
      storage_path: row.storage_path,
      updated_at: row.updated_at,
    });
  } catch {
    // Network unreachable.
  }
}

// Uploads a new (already perspective-corrected, if it was a photo) template
// image, overwriting whatever was there before — this is also how
// "Replace" works, not just the first upload; same flow either way.
export async function uploadManifestTemplate(
  blob: Blob,
  uploadedBy: string,
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const { error: uploadError } = await supabase.storage
    .from(MANIFEST_TEMPLATE_BUCKET)
    .upload(MANIFEST_TEMPLATE_STORAGE_PATH, blob, {
      upsert: true,
      contentType: blob.type || "image/png",
    });
  if (uploadError) return { error: uploadError.message };

  const now = new Date().toISOString();
  const { error: rowError } = await supabase.from("manifest_template").upsert({
    id: MANIFEST_TEMPLATE_ROW_ID,
    storage_path: MANIFEST_TEMPLATE_STORAGE_PATH,
    uploaded_by: uploadedBy,
    updated_at: now,
  });
  if (rowError) return { error: rowError.message };

  // Refresh the local cache immediately so the uploader doesn't have to
  // wait for the next sync tick to see/use the new template.
  await getDb().manifest_template.put({
    id: "current",
    blob,
    storage_path: MANIFEST_TEMPLATE_STORAGE_PATH,
    updated_at: now,
  });

  return { error: null };
}
