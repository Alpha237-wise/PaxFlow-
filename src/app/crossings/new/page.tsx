import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewCrossingForm } from "./new-crossing-form";

export default async function NewCrossingPage({
  searchParams,
}: {
  searchParams: Promise<{ vessel?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { vessel } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black">
      <NewCrossingForm vesselId={vessel ?? null} userId={user.id} />
    </div>
  );
}
