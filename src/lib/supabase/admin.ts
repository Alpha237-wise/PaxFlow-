import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Service-role client — server-only (§16.5). Never import this from a
// "use client" file; SUPABASE_SERVICE_ROLE_KEY must never reach the
// browser bundle. Used for operations RLS can't express for a normal
// user session, e.g. listing auth.users to show emails on the Super
// Admin screen (§21 step 15).
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
