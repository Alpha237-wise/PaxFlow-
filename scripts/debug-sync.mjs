// Diagnostic: reproduce exactly what sync.ts's pushCrossings() does,
// using a disposable confirmed test user (created via the service role,
// like test-rls.mjs) so no real password is needed. Tests both a plain
// 'user' role and a 'super_admin' role, since the real account
// (alphakolondo@gmail.com) is super_admin.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function run(role) {
  console.log(`\n=== role: ${role} ===`);
  const email = `debug-sync-${role}-${Date.now()}@paxflow.invalid`;
  const password = "debug-password-1!";
  const { data: userData, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw createErr;
  const userId = userData.user.id;

  if (role !== "user") {
    await admin.from("profiles").update({ role }).eq("id", userId);
  }

  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) throw signInErr;

  const { data: vessel } = await admin.from("vessels").select("id, name").eq("name", "BIRD 1").single();

  const payload = {
    id: crypto.randomUUID(),
    vessel_id: vessel.id,
    created_by: userId,
    status: "draft",
    crossing_date: "2026-08-20",
    time_of_departure: null,
    time_of_arrival: null,
    port_of_origin: "Debug",
    destination: "Debug",
    vessel_name_override: null,
    captain_on_board: null,
    mechanic: null,
    ab_name: null,
    marine_hostess: null,
    total_guests: null,
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error, status, statusText } = await client.from("crossings").upsert(payload);
  console.log("upsert() result:", { data, error, status, statusText });

  const { data: readBack, error: readErr } = await client.from("crossings").select("id").eq("id", payload.id);
  console.log("client read-back:", { readBack, readErr });

  const { data: adminReadBack } = await admin.from("crossings").select("id").eq("id", payload.id);
  console.log("admin (service role) read-back:", adminReadBack);

  // cleanup
  await admin.from("crossings").delete().eq("id", payload.id);
  await admin.auth.admin.deleteUser(userId);
}

await run("user");
await run("super_admin");
