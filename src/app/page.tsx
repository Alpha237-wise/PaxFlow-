import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";

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

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          PaxFlow
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connecté en tant que {profile?.full_name || user.email} (
          {profile?.role ?? "user"})
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Écran de choix du BIRD à venir (§21, étape 5).
        </p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
