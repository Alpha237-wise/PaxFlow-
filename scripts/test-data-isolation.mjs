// Pre-multi-user-launch data isolation check — docs/cahier-des-charges.md
// §13.2 (the closest existing section to what was asked for as "§23.2",
// which doesn't exist in the current doc — see the summary this script's
// output feeds into).
//
// Accounts are provisioned via the admin API (auth.admin.createUser +
// email_confirm: true), same as scripts/test-rls.mjs — NOT via the real
// public signUp() this project's login form uses. That was the original
// plan, but a real run of it here hit Supabase's default-mailer rate
// limit after only a couple of signups ("email rate limit exceeded") —
// continuing to hammer it risked leaving no headroom for the project
// owner's own real colleagues to sign up soon after. The admin API
// creates the exact same kind of authenticated session and profile row
// (same Postgres trigger fires either way) without sending any email, so
// everything this script actually exists to check — a second account
// running direct queries against another account's real data, and an
// admin account's read-vs-write boundary — is tested for real; only the
// account-provisioning mechanism is a shortcut, same trade-off
// test-rls.mjs already made.
//
// What this script adds beyond test-rls.mjs's broader RLS sweep: one
// account creates several realistic crossings with real passengers, then
// a second plain-user account and a promoted admin account run DIRECT
// queries against that data (not just "the UI doesn't show it") and the
// actual outcome is asserted.
//
// Run with: node --env-file=.env.local scripts/test-data-isolation.mjs
// Disposable users/data; deletes everything it created, on success or
// failure.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function check(label, condition, detail) {
  results.push({ label, pass: !!condition, detail });
  console.log(`${condition ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
}

const stamp = Date.now();
const accounts = {
  alice: { email: `isolation-alice-${stamp}@paxflow.invalid`, password: "Test-Password-A1!", fullName: "Alice Test" },
  bob: { email: `isolation-bob-${stamp}@paxflow.invalid`, password: "Test-Password-B1!", fullName: "Bob Test" },
  carla: { email: `isolation-carla-${stamp}@paxflow.invalid`, password: "Test-Password-C1!", fullName: "Carla Admin" },
};
const createdUserIds = [];
const createdCrossingIds = [];

// Provisioned via the admin API, not the real signUp() form (see the
// file header for why) — but still fires the same "new auth.users row ->
// Postgres trigger creates a profiles row with role='user'" path a real
// signup does, which is asserted on right after this is called.
async function createConfirmedUser(key) {
  const acct = accounts[key];
  const { data, error } = await admin.auth.admin.createUser({
    email: acct.email,
    password: acct.password,
    email_confirm: true,
    user_metadata: { full_name: acct.fullName },
  });
  if (error) throw new Error(`createUser(${key}) failed: ${error.message}`);
  const userId = data.user.id;
  createdUserIds.push(userId);
  return userId;
}

async function signInLikeARealUser(key) {
  const acct = accounts[key];
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: acct.email, password: acct.password });
  if (error) throw new Error(`signIn(${key}) failed: ${error.message}`);
  return client;
}

async function cleanup(aliceId) {
  if (createdCrossingIds.length > 0) {
    await admin.from("passengers").delete().in("crossing_id", createdCrossingIds);
    await admin.from("crossings").delete().in("id", createdCrossingIds);
  }
  if (aliceId) await admin.from("known_people").delete().eq("owner_id", aliceId);
  // audit_log.actor_id has no ON DELETE cascade/set-null, so
  // auth.admin.deleteUser() fails outright for any account that ever did
  // something audited (e.g. Alice's crossing.create events) — discovered
  // the hard way, as a real leftover test account this same script left
  // behind on an earlier run. Clear the account's own audit trail first;
  // it's disposable test data either way.
  for (const id of createdUserIds) {
    await admin.from("audit_log").delete().eq("actor_id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.error(`Failed to delete test user ${id}:`, error.message);
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
  console.log("--- Provisioning 3 test accounts (admin API — see file header) ---");
  const aliceId = await createConfirmedUser("alice");
  const bobId = await createConfirmedUser("bob");
  const carlaId = await createConfirmedUser("carla");

  // Confirms the same "new profile row" trigger a real signup relies on
  // actually fired for this account.
  const { data: aliceProfile } = await admin.from("profiles").select("role").eq("id", aliceId).single();
  check("New account auto-creates a 'user'-role profile row", aliceProfile?.role === "user");

  // Promoting Carla to admin is itself a manual/super_admin-only action
  // per §13.1 — done here the same way a real project owner would.
  const { error: promoteErr } = await admin.from("profiles").update({ role: "admin" }).eq("id", carlaId);
  if (promoteErr) throw promoteErr;

  const alice = await signInLikeARealUser("alice");
  const bob = await signInLikeARealUser("bob");
  const carla = await signInLikeARealUser("carla");

  const { data: vessel } = await admin.from("vessels").select("id").eq("name", "BIRD 1").single();

  // --- Alice creates a few realistic crossings with real passengers ---
  console.log("\n--- Alice creates 3 crossings with passengers ---");
  const passengerTemplates = [
    [
      { seat_number: 1, name: "Ahmed Al-Sayed", company_id_number: "EMP-1001", department: "Marine Ops", classification_computed: "TM", classification_final: "TM" },
      { seat_number: 2, name: "Robert Klein", company_name: "BuildRight Co", classification_computed: "CC", classification_final: "CC" },
    ],
    [
      { seat_number: 1, name: "Fatima Nasser", company_id_number: "EMP-1002", department: "Facilities", classification_computed: "TM", classification_final: "TM" },
    ],
    [
      { seat_number: 1, name: "Youssef Hammadi", company_id_number: "EMP-1003", department: "Engineering", classification_computed: "TM", classification_final: "TM" },
      { seat_number: 2, name: "Priya Nair", company_name: "Skyline Interiors", classification_computed: "CC", classification_final: "CC" },
    ],
  ];
  for (let i = 0; i < passengerTemplates.length; i++) {
    const { data: crossing, error: insertErr } = await alice
      .from("crossings")
      .insert({ vessel_id: vessel.id, crossing_date: "2026-09-10", destination: `Site ${i + 1}` })
      .select()
      .single();
    check(`Alice can create crossing ${i + 1}`, !insertErr && !!crossing, insertErr?.message);
    if (!crossing) continue;
    createdCrossingIds.push(crossing.id);
    for (const p of passengerTemplates[i]) {
      const { error: pErr } = await alice.from("passengers").insert({ ...p, crossing_id: crossing.id });
      check(`Alice can add passenger ${p.name} to crossing ${i + 1}`, !pErr, pErr?.message);
    }
  }
  const { error: knownErr } = await alice.from("known_people").insert({
    owner_id: aliceId,
    name: "Ahmed Al-Sayed",
    department: "Marine Ops",
  });
  check("Alice can save a known_people entry", !knownErr, knownErr?.message);
  const { data: aliceKnownRow } = await alice
    .from("known_people")
    .select("id")
    .eq("name", "Ahmed Al-Sayed")
    .single();
  const { error: knownCrewErr } = await alice.from("known_crew").insert({
    owner_id: aliceId,
    role: "captain",
    name: "Captain Isolation-Test",
  });
  check("Alice can save a known_crew entry", !knownCrewErr, knownCrewErr?.message);
  const { data: aliceKnownCrewRow } = await alice
    .from("known_crew")
    .select("id")
    .eq("name", "Captain Isolation-Test")
    .single();

  const [crossing1, crossing2, crossing3] = createdCrossingIds;

  // --- Bob (plain user): direct queries against Alice's data ---
  console.log("\n--- Bob (plain user) attempts direct queries against Alice's data ---");
  const { data: bobSeesCrossings, error: bobSelectErr } = await bob
    .from("crossings")
    .select("id")
    .in("id", createdCrossingIds);
  check(
    "Bob's SELECT on Alice's crossings returns 0 rows (RLS hides them, no error — that's the expected shape for SELECT)",
    !bobSelectErr && (bobSeesCrossings ?? []).length === 0,
  );

  const { data: bobSeesPassengers } = await bob
    .from("passengers")
    .select("id")
    .eq("crossing_id", crossing1);
  check("Bob's SELECT on Alice's passengers returns 0 rows", (bobSeesPassengers ?? []).length === 0);

  const { data: bobUpdateResult, error: bobUpdateErr } = await bob
    .from("crossings")
    .update({ destination: "Hijacked" })
    .eq("id", crossing1)
    .select();
  check(
    "Bob's UPDATE on Alice's crossing affects 0 rows (silently no-ops under RLS, not an error)",
    !bobUpdateErr && (bobUpdateResult ?? []).length === 0,
  );
  const { data: verifyNotHijacked } = await admin.from("crossings").select("destination").eq("id", crossing1).single();
  check("Alice's crossing 1 destination is unchanged after Bob's attempt", verifyNotHijacked?.destination === "Site 1");

  const { data: bobDeleteResult, error: bobDeleteErr } = await bob
    .from("crossings")
    .delete()
    .eq("id", crossing1)
    .select();
  check("Bob's DELETE on Alice's crossing affects 0 rows", !bobDeleteErr && (bobDeleteResult ?? []).length === 0);
  const { data: verifyStillExists } = await admin.from("crossings").select("id").eq("id", crossing1).maybeSingle();
  check("Alice's crossing 1 still exists after Bob's delete attempt", !!verifyStillExists);

  const { error: bobPassengerInsertErr } = await bob.from("passengers").insert({
    crossing_id: crossing1,
    seat_number: 9,
    name: "Bob Intruder",
    department: "FNB",
    classification_computed: "TM",
    classification_final: "TM",
  });
  check(
    "Bob's INSERT of a passenger onto Alice's crossing is explicitly rejected (RLS policy violation error, since INSERT has a WITH CHECK)",
    !!bobPassengerInsertErr,
    bobPassengerInsertErr?.message,
  );

  const { data: bobSeesKnown } = await bob.from("known_people").select("id").eq("owner_id", aliceId);
  check("Bob's SELECT on Alice's known_people returns 0 rows", (bobSeesKnown ?? []).length === 0);

  // Unfiltered reads: not "WHERE owner_id = alice" (which a buggy policy could
  // still answer), just "give me everything I'm allowed to see".
  const { data: bobAllKnown } = await bob.from("known_people").select("id, owner_id");
  check("Bob's UNFILTERED SELECT on known_people returns nothing of Alice's", (bobAllKnown ?? []).every((r) => r.owner_id !== aliceId) && (bobAllKnown ?? []).length === 0);
  const { data: bobAllCrew } = await bob.from("known_crew").select("id, owner_id");
  check("Bob's UNFILTERED SELECT on known_crew returns nothing of Alice's", (bobAllCrew ?? []).length === 0);
  const { data: bobUpKnown, error: bobUpKnownErr } = await bob.from("known_people").update({ department: "Hijacked" }).eq("id", aliceKnownRow.id).select();
  check("Bob's UPDATE on Alice's known_people affects 0 rows", !bobUpKnownErr && (bobUpKnown ?? []).length === 0);
  const { data: bobDelKnown, error: bobDelKnownErr } = await bob.from("known_people").delete().eq("id", aliceKnownRow.id).select();
  check("Bob's DELETE on Alice's known_people affects 0 rows", !bobDelKnownErr && (bobDelKnown ?? []).length === 0);
  const { data: knownStill } = await admin.from("known_people").select("id, department").eq("id", aliceKnownRow.id).maybeSingle();
  check("Alice's known_people row is intact after Bob's attempts", knownStill?.department === "Marine Ops");
  const { error: bobPlantKnownErr } = await bob.from("known_people").insert({ owner_id: aliceId, name: "Planted By Bob" });
  check("Bob cannot INSERT a known_people row owned by Alice (WITH CHECK)", !!bobPlantKnownErr, bobPlantKnownErr?.message);
  const { error: bobPlantCrewErr } = await bob.from("known_crew").insert({ owner_id: aliceId, role: "ab", name: "Planted By Bob" });
  check("Bob cannot INSERT a known_crew row owned by Alice (WITH CHECK)", !!bobPlantCrewErr, bobPlantCrewErr?.message);

  // --- Carla (admin): can read, cannot write ---
  console.log("\n--- Carla (admin) attempts direct queries against Alice's data ---");
  const { data: carlaSeesCrossings, error: carlaSelectErr } = await carla
    .from("crossings")
    .select("id, destination")
    .in("id", createdCrossingIds);
  check(
    "Carla (admin) CAN SELECT all 3 of Alice's crossings",
    !carlaSelectErr && (carlaSeesCrossings ?? []).length === 3,
  );

  const { data: carlaSeesPassengers, error: carlaPassengersSelectErr } = await carla
    .from("passengers")
    .select("id")
    .eq("crossing_id", crossing1);
  check(
    "Carla (admin) CAN SELECT Alice's passengers",
    !carlaPassengersSelectErr && (carlaSeesPassengers ?? []).length === 2,
  );

  const { data: carlaInsertResult, error: carlaInsertErr } = await carla
    .from("crossings")
    .insert({ vessel_id: vessel.id, crossing_date: "2026-09-10" })
    .select();
  check(
    "Carla (admin) CANNOT INSERT a crossing",
    !!carlaInsertErr || (carlaInsertResult ?? []).length === 0,
    carlaInsertErr?.message,
  );

  const { data: carlaUpdateResult, error: carlaUpdateErr } = await carla
    .from("crossings")
    .update({ destination: "Admin overwrite" })
    .eq("id", crossing2)
    .select();
  check(
    "Carla (admin) CANNOT UPDATE Alice's crossing (0 rows affected)",
    !carlaUpdateErr && (carlaUpdateResult ?? []).length === 0,
  );
  const { data: verifyCrossing2Unchanged } = await admin.from("crossings").select("destination").eq("id", crossing2).single();
  check("Alice's crossing 2 destination is unchanged after Carla's attempt", verifyCrossing2Unchanged?.destination === "Site 2");

  const { data: carlaDeleteResult, error: carlaDeleteErr } = await carla
    .from("crossings")
    .delete()
    .eq("id", crossing3)
    .select();
  check("Carla (admin) CANNOT DELETE Alice's crossing (0 rows affected)", !carlaDeleteErr && (carlaDeleteResult ?? []).length === 0);
  const { data: verifyCrossing3StillExists } = await admin.from("crossings").select("id").eq("id", crossing3).maybeSingle();
  check("Alice's crossing 3 still exists after Carla's delete attempt", !!verifyCrossing3StillExists);

  const { error: carlaPassengerInsertErr } = await carla.from("passengers").insert({
    crossing_id: crossing2,
    seat_number: 9,
    name: "Admin Intruder",
    department: "FNB",
    classification_computed: "TM",
    classification_final: "TM",
  });
  check("Carla (admin) CANNOT INSERT a passenger", !!carlaPassengerInsertErr, carlaPassengerInsertErr?.message);

  const { data: carlaSeesKnown } = await carla.from("known_people").select("id").eq("owner_id", aliceId);
  check(
    "Carla (admin) CANNOT SELECT Alice's known_people (strictly private even from Admin, §4.5/§13.2)",
    (carlaSeesKnown ?? []).length === 0,
  );

  const { data: carlaAllKnown } = await carla.from("known_people").select("id");
  check("Carla (admin) UNFILTERED SELECT on known_people returns nothing", (carlaAllKnown ?? []).length === 0);
  const { data: carlaAllCrew } = await carla.from("known_crew").select("id");
  check("Carla (admin) UNFILTERED SELECT on known_crew returns nothing", (carlaAllCrew ?? []).length === 0);

  // --- Audit trail must not copy remembered people's names ---
  // audit_log is readable by super_admin (policy) and shown on the Super
  // Admin screen with its metadata, so a data.delete row that carries the
  // deleted known person's NAME would hand another user's private memory to
  // a super_admin. Alice deletes her own entries; the resulting audit rows
  // (read here via the service role) must not contain any name.
  const { error: aliceDelKnownErr } = await alice.from("known_people").delete().eq("id", aliceKnownRow.id);
  const { error: aliceDelCrewErr } = await alice.from("known_crew").delete().eq("id", aliceKnownCrewRow.id);
  check("Alice can delete her own known_people / known_crew entries", !aliceDelKnownErr && !aliceDelCrewErr);
  const { data: auditRows } = await admin
    .from("audit_log")
    .select("target_table, metadata")
    .in("target_id", [aliceKnownRow.id, aliceKnownCrewRow.id]);
  check("Deleting known entries is still audited (2 data.delete rows)", (auditRows ?? []).length === 2, `${(auditRows ?? []).length} rows`);
  const leaked = (auditRows ?? []).filter((r) => JSON.stringify(r.metadata ?? {}).toLowerCase().includes("name") || JSON.stringify(r.metadata ?? {}).includes("Ahmed") || JSON.stringify(r.metadata ?? {}).includes("Isolation-Test"));
  check("audit_log metadata for known_people/known_crew deletions contains no personal name", leaked.length === 0, leaked.length ? JSON.stringify(leaked.map((r) => r.metadata)) : undefined);

  await cleanup(aliceId);
  printSummaryAndExit();
}

main().catch(async (err) => {
  console.error(err);
  await cleanup();
  process.exit(1);
});
