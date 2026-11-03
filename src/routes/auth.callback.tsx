import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { nextFromLocation, withNext } from "@/lib/authRedirect";
import { oauthFailureFromParams, type AuthFailure } from "@/lib/authErrors";
import { authFailureKey } from "@/lib/authFailureCopy";
import { useI18n } from "@/i18n";

/**
 * Where the auth provider sends the visitor back.
 *
 * The provider reports failures in the query string or the fragment, so both are
 * read before waiting for a session. A cancelled consent screen, a slow provider
 * and a callback that never yields a session each end on a stated next step
 * instead of an endless loading screen.
 */
export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing in · Lifeline" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const { t } = useI18n();
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [slow, setSlow] = useState(false);
  const [next, setNext] = useState("/account");

  useEffect(() => {
    let active = true;
    const search = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const destination = nextFromLocation(window.location.search);
    setNext(destination);

    const reported = oauthFailureFromParams(search) ?? oauthFailureFromParams(hashParams);
    if (reported) {
      setFailure(reported);
      return;
    }

    const slowTimer = setTimeout(() => {
      if (active) setSlow(true);
    }, 9000);

    const run = async () => {
      const code = search.get("code");
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          // The implicit flow carries the session in the fragment instead; the
          // wait below still succeeds when that is what the provider sent.
        }
      }
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (!active) return;
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session) {
          window.location.replace(destination);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (active) setFailure({ kind: "unknown", providerMessage: "", action: "signin" });
    };
    void run();
    return () => {
      active = false;
      clearTimeout(slowTimer);
    };
  }, []);

  const backToSignIn = withNext("/account", next);

  return (
    <main id="main-content" className="mx-auto max-w-md px-4 pb-32 pt-16">
      <section className="rounded-xl border border-border bg-card p-5">
        <h1 className="font-display text-xl font-bold">{t("account.callbackTitle")}</h1>
        {failure ? (
          <div role="alert" className="mt-3 text-sm">
            <p className="flex items-start gap-2">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
              <span>{t("account.callbackFailed")}</span>
            </p>
            <p className="mt-2 text-muted-foreground">{t(authFailureKey(failure.kind))}</p>
            {failure.providerMessage && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">{t("account.providerDetail")}</summary>
                <p className="mt-1 break-words">{failure.providerMessage}</p>
              </details>
            )}
            <Button asChild className="mt-4 w-full">
              <a href={backToSignIn}>{t("account.backToSignIn")}</a>
            </Button>
          </div>
        ) : (
          <p role="status" className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="mt-0.5 size-4 animate-spin" />
            <span>
              {slow ? t("account.callbackSlow") : t("account.callbackWaiting")}
            </span>
          </p>
        )}
        {!failure && slow && (
          <Button asChild variant="outline" className="mt-4 w-full">
            <a href={backToSignIn}>{t("account.backToSignIn")}</a>
          </Button>
        )}
      </section>
    </main>
  );
}
