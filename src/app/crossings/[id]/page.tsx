import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CrossingDetail } from "./crossing-detail";

export default async function CrossingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-6 py-8 dark:bg-black">
      <CrossingDetail crossingId={id} />
    </div>
  );
}
