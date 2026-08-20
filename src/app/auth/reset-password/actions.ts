"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/auth/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  // Sign out of the one-off recovery session so the AB does a normal
  // sign-in with the new password, rather than staying implicitly logged
  // in through the reset link.
  await supabase.auth.signOut();

  redirect(
    `/login?message=${encodeURIComponent("Password updated. Sign in with your new password.")}`,
  );
}
