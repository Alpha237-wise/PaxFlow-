import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";
import { VesselChooser } from "./vessel-chooser";
import { toLocalVessel } from "@/lib/db/schema";
import { SyncEngine } from "./sync-engine";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const { data: vessels } = await supabase
    .from("vessels")
    .select("id, name, total_seats, status, seat_layout_ref");

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 py-8 dark:bg-black">
      <SyncEngine userId={user.id} />
      <div className="flex w-full max-w-sm items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            PaxFlow
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {profile?.full_name || user.email} ({profile?.role ?? "user"})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/history"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            History
          </Link>
          <Link
            href="/profile"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Profile
          </Link>
          {(profile?.role === "admin" || profile?.role === "super_admin") && (
            <Link
              href="/admin"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              Supervision
            </Link>
          )}
          {profile?.role === "super_admin" && (
            <Link
              href="/super-admin"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              Admin
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      <VesselChooser initialVessels={(vessels ?? []).map(toLocalVessel)} />
    </div>
  );
}
