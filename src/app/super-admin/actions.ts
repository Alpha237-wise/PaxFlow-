"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Both actions rely on the caller's own super_admin session + RLS
// (profiles_update_super_admin / vessels_all_super_admin) rather than the
// service role — no elevated write access needed here, only the read-only
// user-listing on the page itself needs that (§21 step 15).

export async function updateUserRole(formData: FormData) {
  const userId = String(formData.get("userId"));
  const role = String(formData.get("role"));

  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", userId);

  revalidatePath("/super-admin");
}

export async function updateVesselStatus(formData: FormData) {
  const vesselId = String(formData.get("vesselId"));
  const status = String(formData.get("status"));

  const supabase = await createClient();
  await supabase.from("vessels").update({ status }).eq("id", vesselId);

  revalidatePath("/super-admin");
}
