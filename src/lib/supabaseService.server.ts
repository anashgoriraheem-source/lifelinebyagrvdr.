import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Server-only Supabase client for the alert dispatcher and provider callbacks.
 *
 * The alert tables deliberately grant no UPDATE to an authenticated browser
 * session (history is append-only from the client), so the dispatcher writes
 * provider state with the service role. Never import this module from a route
 * component: it reads the service key.
 */
export function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("The server data store is not configured.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
