import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewCrossingForm } from "./new-crossing-form";
import { SyncEngine } from "../../sync-engine";

// getSession() instead of getUser() — see page.tsx's (Home) docstring for
// why: this is part of the same critical offline-first chain (§16.7,
// §21 steps 5-12), and getUser()'s mandatory server round-trip was making
// this page (~280ms measured) unusable with zero network, for no real
// security benefit RLS doesn't already provide underneath.
export default async function NewCrossingPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const { vessel } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black">
      <SyncEngine userId={session.user.id} />
      <NewCrossingForm vesselId={vessel ?? null} userId={session.user.id} />
    </div>
  );
}
