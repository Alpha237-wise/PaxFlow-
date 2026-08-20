import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    redirect("/");
  }

  // RLS (crossings_select_admin) already scopes this to every user's
  // crossings for admin/super_admin — no manual filter needed. This is a
  // supervisory screen, so it queries Supabase directly rather than the
  // local Dexie cache, which only ever holds the signed-in AB's own data.
  const { data: crossings } = await supabase
    .from("crossings")
    .select("id, crossing_date, port_of_origin, destination, status, vessel_name_override, vessels(name), profiles(full_name)")
    .order("crossing_date", { ascending: false });

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Supervision
          </h1>
          <Link
            href="/"
            className="text-sm font-medium text-zinc-900 underline dark:text-zinc-50"
          >
            Back to home
          </Link>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Read-only — every AB&apos;s crossings, no edit actions (§13.2).
        </p>

        {!crossings || crossings.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No crossings found.
          </p>
        ) : (
          <ul className="space-y-2">
            {crossings.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/crossings/${c.id}`}
                  className="block rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {c.vessel_name_override || c.vessels?.name || "—"}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {c.crossing_date}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                    <span>
                      {c.port_of_origin ?? "—"} → {c.destination ?? "—"}
                    </span>
                    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {c.status === "draft" ? "Draft" : "Finalized"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    AB: {c.profiles?.full_name || "—"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
