// One-off seed: uploads a manifest reference for ONE paper form, chosen by
// argv[2] ("51-seats", the default, or "50-seats" for BIRD 9/10 —
// reference/manifest-template-b9-b10-final.png, a 2560x1920 downscale of
// reference/manifest B9 and B10.jpg, added 2026-10-14; the slots mirror
// src/lib/manifest-template.ts's MANIFEST_TEMPLATES). Usage:
//   node --env-file=.env.local scripts/seed-manifest-template.mjs [51-seats|50-seats]
// The 51-seat reference is
// (reference/manifest-template-v2-final.png, a 2x upscale of
// reference/manifest-blank-template-v2.jpg — replaces the earlier
// PDF-derived reference, 2026-09-11) as the shared manifest template,
// using the service role key since this is an admin-equivalent action run
// from the CLI rather than through the Super Admin UI's corner-drag flow
// (not needed here — the source scan is already straight). Mirrors
// manifest-template.ts's uploadManifestTemplate, minus the browser-only
// Dexie cache write — this IS the "Remplacer" flow's server-side effect
// (§9.6), same well-known row id/storage path, just invoked from a script.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "manifest-template";
// Keep in sync with src/lib/manifest-template.ts's MANIFEST_TEMPLATES.
const SLOTS = {
  "51-seats": {
    rowId: "11111111-1111-1111-1111-111111111111",
    storagePath: "current.png",
    file: "reference/manifest-template-v2-final.png",
  },
  "50-seats": {
    rowId: "22222222-2222-2222-2222-222222222222",
    storagePath: "current-50-seats.png",
    file: "reference/manifest-template-b9-b10-final.png",
  },
};
const layoutRef = process.argv[2] ?? "51-seats";
const slot = SLOTS[layoutRef];
if (!slot) throw new Error(`Unknown layout "${layoutRef}" (expected ${Object.keys(SLOTS).join(" or ")})`);
const ROW_ID = slot.rowId;
const STORAGE_PATH = slot.storagePath;

const fileBytes = readFileSync(slot.file);

const { error: uploadError } = await admin.storage
  .from(BUCKET)
  .upload(STORAGE_PATH, fileBytes, {
    upsert: true,
    contentType: "image/png",
    cacheControl: "0",
  });
if (uploadError) throw uploadError;

const { data: superAdmin, error: findError } = await admin
  .from("profiles")
  .select("id")
  .eq("role", "super_admin")
  .limit(1)
  .maybeSingle();
if (findError) throw findError;

const { error: rowError } = await admin.from("manifest_template").upsert({
  id: ROW_ID,
  storage_path: STORAGE_PATH,
  uploaded_by: superAdmin?.id ?? null,
  updated_at: new Date().toISOString(),
});
if (rowError) throw rowError;

console.log("Uploaded", fileBytes.length, "bytes to", `${BUCKET}/${STORAGE_PATH}`);
console.log("manifest_template row upserted, uploaded_by:", superAdmin?.id ?? "(none found)");
