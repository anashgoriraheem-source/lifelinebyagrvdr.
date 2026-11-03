import { createFileRoute } from "@tanstack/react-router";

/**
 * Which sign-in methods this project can actually offer.
 *
 * Read from the auth service's own `/settings` endpoint rather than from
 * configuration guesses, so the sign-in screen never shows a provider button
 * that cannot work. Only booleans are returned — no keys, no secrets.
 */
interface AuthCapabilities {
  ok: boolean;
  email: boolean;
  google: boolean;
  signup: boolean;
  emailVerificationRequired: boolean;
  checkedAt: number;
  error?: "auth-unreachable";
}

const TTL_MS = 15_000;
let cached: { at: number; value: AuthCapabilities } | null = null;

async function readCapabilities(): Promise<AuthCapabilities> {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const unreachable: AuthCapabilities = {
    ok: false,
    email: false,
    google: false,
    signup: false,
    emailVerificationRequired: false,
    checkedAt: Date.now(),
    error: "auth-unreachable",
  };
  if (!base || !key) return unreachable;
  try {
    const response = await fetch(`${base}/auth/v1/settings`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return unreachable;
    const settings = (await response.json()) as {
      external?: Record<string, boolean>;
      disable_signup?: boolean;
      mailer_autoconfirm?: boolean;
    };
    return {
      ok: true,
      email: Boolean(settings.external?.["email"]),
      google: Boolean(settings.external?.["google"]),
      signup: settings.disable_signup !== true,
      emailVerificationRequired: settings.mailer_autoconfirm === false,
      checkedAt: Date.now(),
    };
  } catch {
    return unreachable;
  }
}

export const Route = createFileRoute("/api/auth/config")({
  server: {
    handlers: {
      GET: async () => {
        if (cached && Date.now() - cached.at < TTL_MS) return Response.json(cached.value);
        const value = await readCapabilities();
        cached = { at: Date.now(), value };
        return Response.json(value, { headers: { "cache-control": "no-store" } });
      },
    },
  },
});
