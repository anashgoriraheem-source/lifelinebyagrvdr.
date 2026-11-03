import { createMiddleware } from "@tanstack/react-start";
export const attachAvailableAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
      return next();
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    return next({
      headers: data.session?.access_token
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {},
    });
  },
);
