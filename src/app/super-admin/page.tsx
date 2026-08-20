import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MANIFEST_TEMPLATE_BUCKET } from "@/lib/manifest-template";
import { updateUserRole, updateVesselStatus } from "./actions";
import { ManifestTemplateUpload } from "./manifest-template-upload";

function vesselNumber(name: string): number {
  const match = /\d+/.exec(name);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (myProfile?.role !== "super_admin") {
    redirect("/");
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name");

  // Emails aren't stored on profiles — only auth.users has them, which
  // needs the service role to list (§16.5).
  const admin = createAdminClient();
  const { data: authUsers } = await admin.auth.admin.listUsers();
  const emailById = new Map(
    (authUsers?.users ?? []).map((u) => [u.id, u.email ?? "—"]),
  );

  const { data: vessels } = await supabase.from("vessels").select("*");
  const sortedVessels = (vessels ?? [])
    .slice()
    .sort((a, b) => vesselNumber(a.name) - vesselNumber(b.name));

  const { data: auditLog } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: manifestTemplate } = await supabase
    .from("manifest_template")
    .select("storage_path, updated_at")
    .maybeSingle();

  let manifestTemplatePreviewUrl: string | null = null;
  if (manifestTemplate) {
    const { data: signed } = await supabase.storage
      .from(MANIFEST_TEMPLATE_BUCKET)
      .createSignedUrl(manifestTemplate.storage_path, 300);
    manifestTemplatePreviewUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Super Admin
          </h1>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            Back to home
          </Link>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Users &amp; roles
          </h2>
          <ul className="space-y-2">
            {(profiles ?? []).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {p.full_name || "—"}
                  </p>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {emailById.get(p.id)}
                  </p>
                </div>
                <form action={updateUserRole} className="flex shrink-0 items-center gap-2">
                  <input type="hidden" name="userId" value={p.id} />
                  <select
                    name="role"
                    defaultValue={p.role}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                  <button
                    type="submit"
                    className="rounded-md bg-zinc-900 px-3 py-1 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Vessels
          </h2>
          <ul className="grid grid-cols-2 gap-2">
            {sortedVessels.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {v.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {v.status === "active" ? "Active" : "Out of service"}
                  </p>
                </div>
                <form action={updateVesselStatus}>
                  <input type="hidden" name="vesselId" value={v.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={v.status === "active" ? "out_of_service" : "active"}
                  />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    {v.status === "active" ? "Mark OOS" : "Mark active"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <ManifestTemplateUpload
          userId={user.id}
          currentPreviewUrl={manifestTemplatePreviewUrl}
          currentUpdatedAt={manifestTemplate?.updated_at ?? null}
        />

        <section className="space-y-2">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Audit log (last 50)
          </h2>
          {!auditLog || auditLog.length === 0 ? (
            <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No audit entries yet.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {auditLog.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-zinc-200 p-2 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                >
                  <span className="font-medium">{entry.action}</span>{" "}
                  <span className="text-zinc-500 dark:text-zinc-400">
                    on {entry.target_table} · {new Date(entry.created_at).toLocaleString()}
                  </span>
                  {entry.metadata != null && (
                    <pre className="mt-1 whitespace-pre-wrap text-[10px] text-zinc-500 dark:text-zinc-400">
                      {JSON.stringify(entry.metadata)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
