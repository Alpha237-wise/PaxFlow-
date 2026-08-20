// One-off cleanup for leftover rls-test-* accounts from earlier
// scripts/test-rls.mjs runs that aborted before their own cleanup ran.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let page = 1;
const toDelete = [];
for (;;) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  toDelete.push(...data.users.filter((u) => u.email?.endsWith("@paxflow.invalid")));
  if (data.users.length < 200) break;
  page++;
}

console.log(`Found ${toDelete.length} leftover test users.`);
const ids = toDelete.map((u) => u.id);

if (ids.length > 0) {
  await admin.from("passengers").delete().in(
    "crossing_id",
    (await admin.from("crossings").select("id").in("created_by", ids)).data?.map((c) => c.id) ?? [],
  );
  await admin.from("crossings").delete().in("created_by", ids);
  await admin.from("known_people").delete().in("owner_id", ids);
  await admin.from("known_crew").delete().in("owner_id", ids);
}

for (const user of toDelete) {
  const { error } = await admin.auth.admin.deleteUser(user.id);
  console.log(`${error ? "FAILED" : "deleted"} ${user.email}`);
}
