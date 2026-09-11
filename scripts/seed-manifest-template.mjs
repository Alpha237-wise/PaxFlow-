// One-off seed: uploads the current manifest reference
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
const ROW_ID = "11111111-1111-1111-1111-111111111111";
const STORAGE_PATH = "current.png";

const fileBytes = readFileSync("reference/manifest-template-v2-final.png");

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
