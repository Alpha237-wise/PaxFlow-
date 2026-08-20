// Diagnostic: verify the §21 step 16 audit triggers behave as intended,
// especially that a direct passenger delete gets its own data.delete
// entry while a cascade-deleted passenger (crossing deleted) does not.
// Uses a disposable confirmed test user (service role) so auth.uid() is a
// real authenticated session, not the service role itself (which has no
// auth.uid()). Self-cleaning.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const email = `debug-audit-${Date.now()}@paxflow.invalid`;
const password = "debug-password-1!";
const { data: userData, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createErr) throw createErr;
const userId = userData.user.id;

const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
await client.auth.signInWithPassword({ email, password });

const { data: vessel } = await admin.from("vessels").select("id").eq("name", "BIRD 1").single();

async function auditFor(targetId) {
  const { data } = await admin
    .from("audit_log")
    .select("action, target_table, metadata")
    .eq("target_id", targetId)
    .order("created_at");
  return data ?? [];
}

// --- crossing.create / crossing.update ---
const crossingId = crypto.randomUUID();
const now = new Date().toISOString();
await client.from("crossings").insert({
  id: crossingId,
  vessel_id: vessel.id,
  created_by: userId,
  status: "draft",
  crossing_date: "2026-08-20",
  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: now,
  updated_at: now,
});
await client.from("crossings").update({ destination: "Debug Island", updated_at: new Date().toISOString() }).eq("id", crossingId);

console.log("crossing audit entries:", await auditFor(crossingId));

// --- passenger.update (classification override) ---
const passengerId = crypto.randomUUID();
await client.from("passengers").insert({
  id: passengerId,
  crossing_id: crossingId,
  seat_number: 1,
  name: "Debug Passenger",
  department: "FNB",
  classification_computed: "TM",
  classification_final: "TM",
  classification_overridden: false,
  created_at: now,
  updated_at: now,
});
await client
  .from("passengers")
  .update({ classification_final: "CC", classification_overridden: true, updated_at: new Date().toISOString() })
  .eq("id", passengerId);

console.log("passenger audit entries:", await auditFor(passengerId));

// --- direct passenger delete: should log its own data.delete ---
const directDeleteId = crypto.randomUUID();
await client.from("passengers").insert({
  id: directDeleteId,
  crossing_id: crossingId,
  seat_number: 2,
  name: "Direct Delete Test",
  department: "FNB",
  classification_computed: "TM",
  classification_final: "TM",
  classification_overridden: false,
  created_at: now,
  updated_at: now,
});
await client.from("passengers").delete().eq("id", directDeleteId);
console.log("directly-deleted passenger audit entries:", await auditFor(directDeleteId));

// --- cascade delete: deleting the crossing should log ONE data.delete
// (crossings) and NOT a separate one for the still-remaining passenger ---
const cascadeAuditBefore = await auditFor(passengerId);
await client.from("crossings").delete().eq("id", crossingId);
console.log("crossing delete audit entries:", await auditFor(crossingId));
const cascadeAuditAfter = await auditFor(passengerId);
console.log(
  "cascade-deleted passenger got a NEW audit entry?",
  cascadeAuditAfter.length > cascadeAuditBefore.length,
  cascadeAuditAfter,
);

// cleanup
await admin.auth.admin.deleteUser(userId);
console.log("done, test user removed");
