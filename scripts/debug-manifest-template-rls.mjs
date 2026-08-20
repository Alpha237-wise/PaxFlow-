// Quick RLS check for manifest_template: super_admin can write, a plain
// user can only read. Disposable test users, self-cleaning.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function makeUser(role) {
  const email = `debug-template-${role}-${Date.now()}@paxflow.invalid`;
  const password = "debug-password-1!";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  if (role !== "user") await admin.from("profiles").update({ role }).eq("id", data.user.id);
  const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, client };
}

const plain = await makeUser("user");
const superAdmin = await makeUser("super_admin");

const rowId = crypto.randomUUID();

const { error: plainWriteErr } = await plain.client
  .from("manifest_template")
  .insert({ id: rowId, storage_path: "current.png", uploaded_by: plain.id });
console.log("plain user insert blocked?", !!plainWriteErr, plainWriteErr?.message);

const { error: superWriteErr } = await superAdmin.client
  .from("manifest_template")
  .insert({ id: rowId, storage_path: "current.png", uploaded_by: superAdmin.id });
console.log("super_admin insert allowed?", !superWriteErr, superWriteErr?.message ?? "");

const { data: plainRead, error: plainReadErr } = await plain.client
  .from("manifest_template")
  .select("id")
  .eq("id", rowId);
console.log("plain user can read it?", !plainReadErr && plainRead?.length === 1);

await admin.from("manifest_template").delete().eq("id", rowId);
await admin.auth.admin.deleteUser(plain.id);
await admin.auth.admin.deleteUser(superAdmin.id);
console.log("done, cleaned up");
