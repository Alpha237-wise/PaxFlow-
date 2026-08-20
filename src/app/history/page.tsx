import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HistoryView } from "./history-view";
import { SyncEngine } from "../sync-engine";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black">
      <SyncEngine userId={user.id} />
      <HistoryView userId={user.id} />
    </div>
  );
}
