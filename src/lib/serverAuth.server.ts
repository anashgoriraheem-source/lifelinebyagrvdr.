import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
/** Verify the bearer with Auth; never trust a browser-supplied user id. */
export async function optionalSupabaseUser() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const token = getRequest()
    ?.headers.get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!url || !key || !token) return null;
  const supabase = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return !error && data.user ? { userId: data.user.id, supabase } : null;
}
