// RLS integration test against the real (remote) Supabase project.
// Run with: node --env-file=.env.local scripts/test-rls.mjs
//
// Creates disposable test users, exercises the policies from
// docs/cahier-des-charges.md §13.2/§14, asserts the expected pass/fail
// outcomes, then deletes everything it created. Not part of CI — this is
// the manual RLS check required by §21 step 3 / §18.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];
function check(label, condition) {
  results.push({ label, pass: !!condition });
  console.log(`${condition ? "PASS" : "FAIL"} — ${label}`);
}

const stamp = Date.now();
const users = {
  a: { email: `rls-test-a-${stamp}@paxflow.invalid`, password: "test-password-A1!" },
  b: { email: `rls-test-b-${stamp}@paxflow.invalid`, password: "test-password-B1!" },
  admin: { email: `rls-test-admin-${stamp}@paxflow.invalid`, password: "test-password-C1!" },
};
const createdUserIds = [];
const createdCrossingIds = [];

async function createConfirmedUser(key) {
  const { data, error } = await admin.auth.admin.createUser({
    email: users[key].email,
    password: users[key].password,
    email_confirm: true,
  });
  if (error) throw error;
  createdUserIds.push(data.user.id);
  return data.user.id;
}

function clientFor() {
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function signIn(key) {
  const client = clientFor();
  const { error } = await client.auth.signInWithPassword(users[key]);
  if (error) throw error;
  return client;
}

async function cleanup(idA) {
  if (createdCrossingIds.length > 0) {
    await admin.from("passengers").delete().in("crossing_id", createdCrossingIds);
    await admin.from("crossings").delete().in("id", createdCrossingIds);
  }
  if (idA) await admin.from("known_people").delete().eq("owner_id", idA);
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
}

function printSummaryAndExit() {
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length > 0) {
    console.error("Failed checks:", failed.map((f) => f.label));
    process.exit(1);
  }
  process.exit(0);
}

async function main() {
  const idA = await createConfirmedUser("a");
  await createConfirmedUser("b");
  const idAdmin = await createConfirmedUser("admin");

  const { error: promoteError } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", idAdmin);
  if (promoteError) throw promoteError;

  const clientA = await signIn("a");
  const clientB = await signIn("b");
  const clientAdmin = await signIn("admin");

  const { data: vessel } = await admin.from("vessels").select("id").eq("name", "BIRD 1").single();

  // --- A creates a crossing + passenger ---
  const { data: crossingA, error: insertErr } = await clientA
    .from("crossings")
    .insert({ vessel_id: vessel.id, crossing_date: "2026-08-20" })
    .select()
    .single();
  check("A can insert own crossing", !insertErr && !!crossingA);
  if (!crossingA) {
    console.error("Aborting: cannot continue without crossingA.", insertErr);
    await cleanup(idA);
    printSummaryAndExit();
    return;
  }
  createdCrossingIds.push(crossingA.id);

  const { error: passengerInsertErr } = await clientA.from("passengers").insert({
    crossing_id: crossingA.id,
    seat_number: 1,
    name: "Test Passenger",
    department: "FNB",
    classification_computed: "TM",
    classification_final: "TM",
  });
  check("A can insert passenger on own crossing", !passengerInsertErr);

  // --- B cannot see or touch A's crossing ---
  const { data: bSeesA } = await clientB.from("crossings").select("id").eq("id", crossingA.id);
  check("B cannot SELECT A's crossing", (bSeesA ?? []).length === 0);

  const { data: bUpdateA } = await clientB
    .from("crossings")
    .update({ destination: "hacked" })
    .eq("id", crossingA.id)
    .select();
  check("B's UPDATE on A's crossing affects 0 rows", (bUpdateA ?? []).length === 0);

  const { data: bDeleteA } = await clientB.from("crossings").delete().eq("id", crossingA.id).select();
  check("B's DELETE on A's crossing affects 0 rows", (bDeleteA ?? []).length === 0);

  const { error: bPassengerInsertErr } = await clientB.from("passengers").insert({
    crossing_id: crossingA.id,
    seat_number: 2,
    name: "Intruder",
    department: "FNB",
    classification_computed: "TM",
    classification_final: "TM",
  });
  check("B cannot insert a passenger on A's crossing", !!bPassengerInsertErr);

  // --- B creates their own crossing (for the admin multi-row check below) ---
  const { data: crossingB, error: bInsertOwnErr } = await clientB
    .from("crossings")
    .insert({ vessel_id: vessel.id, crossing_date: "2026-08-20" })
    .select()
    .single();
  check("B can insert own crossing", !bInsertOwnErr && !!crossingB);
  if (crossingB) createdCrossingIds.push(crossingB.id);

  // --- Admin: read-only supervision across all users ---
  const { data: adminSeesAll } = await clientAdmin
    .from("crossings")
    .select("id")
    .in("id", [crossingA.id, crossingB?.id].filter(Boolean));
  check("Admin can SELECT both A's and B's crossings", (adminSeesAll ?? []).length === 2);

  const { data: adminInsertAttempt, error: adminInsertErr } = await clientAdmin
    .from("crossings")
    .insert({ vessel_id: vessel.id, crossing_date: "2026-08-20" })
    .select();
  check("Admin cannot INSERT a crossing", !!adminInsertErr || (adminInsertAttempt ?? []).length === 0);

  const { data: adminUpdateAttempt } = await clientAdmin
    .from("crossings")
    .update({ destination: "admin-write-attempt" })
    .eq("id", crossingA.id)
    .select();
  check("Admin cannot UPDATE A's crossing", (adminUpdateAttempt ?? []).length === 0);

  const { error: adminPassengerInsertErr } = await clientAdmin.from("passengers").insert({
    crossing_id: crossingA.id,
    seat_number: 3,
    name: "Admin Intruder",
    department: "FNB",
    classification_computed: "TM",
    classification_final: "TM",
  });
  check("Admin cannot insert a passenger", !!adminPassengerInsertErr);

  // --- known_people: strictly private, not even to admin ---
  const { error: knownInsertErr } = await clientA.from("known_people").insert({
    owner_id: idA,
    name: "Memorized Person",
    department: "FNB",
  });
  check("A can insert their own known_people row", !knownInsertErr);

  const { data: bSeesKnown } = await clientB.from("known_people").select("id").eq("owner_id", idA);
  check("B cannot SELECT A's known_people", (bSeesKnown ?? []).length === 0);

  const { data: adminSeesKnown } = await clientAdmin.from("known_people").select("id").eq("owner_id", idA);
  check("Admin cannot SELECT A's known_people (strictly private, §4.5/§13.2)", (adminSeesKnown ?? []).length === 0);

  // --- audit_log: no client can write; only super_admin can read ---
  const { error: auditInsertErr } = await clientA.from("audit_log").insert({
    actor_id: idA,
    action: "test.attempt",
  });
  check("A cannot INSERT into audit_log", !!auditInsertErr);

  const { data: adminReadsAudit, error: adminAuditErr } = await clientAdmin.from("audit_log").select("id").limit(1);
  check("Admin (not super_admin) cannot SELECT audit_log", !!adminAuditErr || (adminReadsAudit ?? []).length === 0);

  await cleanup(idA);
  printSummaryAndExit();
}

main().catch(async (err) => {
  console.error(err);
  await cleanup();
  process.exit(1);
});
