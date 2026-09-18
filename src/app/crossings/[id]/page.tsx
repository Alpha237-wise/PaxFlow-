import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrossingDetail } from "./crossing-detail";
import { SyncEngine } from "../../sync-engine";

// getSession() instead of getUser(), and no more server-side profiles
// query — see page.tsx's (Home) docstring for why. CrossingDetail now
// reads its own abDefaultName from the local profiles cache (populated by
// sync.ts's pullProfile) instead of receiving it as a prop from here.
//
// CrossingDetail also no longer receives crossingId as a prop — it reads
// the id from the live URL via useParams() instead (see crossing-detail.tsx
// for why: a crossing created offline has an id the Service Worker could
// never have precached, so its cache-fallback can serve a DIFFERENT
// cached /crossings/[id] page's stale server-rendered payload; useParams()
// still resolves the right crossing from Dexie regardless of which cached
// shell served the HTML). So this page no longer needs `params` at all.
export default async function CrossingPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black">
      <SyncEngine userId={session.user.id} />
      <CrossingDetail userId={session.user.id} />
    </div>
  );
}
