import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VesselChooser } from "./vessel-chooser";
import { HomeHeader } from "./home-header";
import { SyncEngine } from "./sync-engine";

// getSession() instead of getUser(), and no more server-side profiles/
// vessels queries — both were adding a real, measured network round-trip
// (~600ms) to every single Home load, and made this screen (the very
// first step of the critical offline-first flow, §16.7) fail outright
// with zero network at all (2026-09-18 field report). getSession() only
// verifies the JWT's signature locally against the cookie, without
// calling Supabase's auth server — RLS on every table (never UI-only
// gating, per this project's own stated principle) is what actually
// protects data if a stale/forged session ever slipped past this check,
// so this trade favors "quasi-instant, offline-capable Home" without
// weakening real security. HomeHeader (profile) and VesselChooser
// (vessels) each read their own data reactively from Dexie instead,
// populated by sync.ts's pullProfile/pullVessels in the background.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 py-8 dark:bg-black">
      <SyncEngine userId={session.user.id} />
      <HomeHeader userId={session.user.id} userEmail={session.user.email ?? ""} />
      <VesselChooser initialVessels={[]} />
    </div>
  );
}
