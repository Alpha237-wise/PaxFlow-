import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileView } from "./profile-view";
import { SyncEngine } from "../sync-engine";

export default async function ProfilePage() {
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

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black">
      <SyncEngine userId={user.id} />
      <ProfileView
        userId={user.id}
        fullName={profile?.full_name ?? null}
        email={user.email ?? null}
        role={profile?.role ?? "user"}
      />
    </div>
  );
}
