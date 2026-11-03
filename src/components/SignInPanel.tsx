import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { classifyAuthFailure, type AuthFailure } from "@/lib/authErrors";
import { authFailureKey } from "@/lib/authFailureCopy";
import { nextFromLocation, withNext } from "@/lib/authRedirect";
import { useI18n } from "@/i18n";

type Mode = "signin" | "signup" | "reset" | "verify";
type Busy = null | "google" | "email" | "resend";

interface Capabilities {
  ok: boolean;
  email: boolean;
  google: boolean;
  signup: boolean;
  emailVerificationRequired: boolean;
  checkedAt: number;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Minimum password length this UI enforces for new passwords. */
const MIN_PASSWORD = 8;

/** Google's required mark; drawn inline so no third-party script is loaded. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false" className="size-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * The one sign-in surface for Lifeline.
 *
 * Google goes through this project's own auth provider (`signInWithOAuth`), not
 * an editor-side broker, and is only offered when the provider reports itself
 * enabled. Email covers sign-in, registration, recovery and confirmation with
 * inline validation, a password reveal control and one error region.
 */
export function SignInPanel({
  recovery = false,
  onPasswordUpdated,
}: {
  /** Set when the visitor arrived from a password-recovery link. */
  recovery?: boolean;
  onPasswordUpdated?: () => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [confirmedEmail, setConfirmedEmail] = useState("");
  const [next, setNext] = useState("/account");
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [capabilitiesError, setCapabilitiesError] = useState(false);
  const submitting = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  useEffect(() => {
    setNext(nextFromLocation(window.location.search));
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/auth/config", { headers: { accept: "application/json" } });
        const data = (await response.json()) as Capabilities;
        if (!active) return;
        if (!response.ok || !data.ok) {
          setCapabilitiesError(true);
          setCapabilities(data);
          return;
        }
        setCapabilitiesError(false);
        setCapabilities(data);
      } catch {
        if (active) setCapabilitiesError(true);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
    setFailure(null);
    setNotice("");
    setFieldErrors({});
  }, [mode]);

  useEffect(() => {
    if (mode !== "signin" && mode !== "signup") return undefined;
    const timer = setTimeout(() => emailRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [mode]);

  const finish = () => {
    if (typeof window === "undefined") return;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) window.location.assign(next);
  };

  const startGoogle = async () => {
    if (busy || !capabilities?.google) return;
    setBusy("google");
    setFailure(null);
    setNotice("");
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${withNext("/auth/callback", next)}`,
          // Only the verified email and basic profile are requested (provider defaults).
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        setFailure(classifyAuthFailure(error));
        setBusy(null);
        return;
      }
      // supabase-js navigates the browser; if it did not, do not leave a dead button.
      if (!data?.url) {
        setFailure({ kind: "unknown", providerMessage: "", action: "retry" });
        setBusy(null);
      }
    } catch (error) {
      setFailure(classifyAuthFailure(error));
      setBusy(null);
    }
  };

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const emailValue = email.trim();
    if (mode === "verify") {
      setFieldErrors({});
      return true;
    }
    if (!EMAIL_RE.test(emailValue)) errors.email = t("account.emailInvalid");
    if (recovery) {
      if (password.length < MIN_PASSWORD) errors.password = t("account.passwordShort");
      else if (password !== confirmPassword) errors.password = t("account.passwordsDiffer");
    } else if (mode === "signup") {
      if (password.length < MIN_PASSWORD) errors.password = t("account.passwordShort");
    } else if (mode === "signin") {
      if (!password) errors.password = t("account.passwordRequired");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const requestReset = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/account`,
    });
    if (error) throw error;
    setNotice(t("account.recoverySent"));
    setMode("signin");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || submitting.current) return;
    if (!validate()) return;
    submitting.current = true;
    setBusy("email");
    setFailure(null);
    setNotice("");
    try {
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setConfirmPassword("");
        setNotice(t("account.passwordUpdated"));
        onPasswordUpdated?.();
        return;
      }
      if (mode === "reset") {
        await requestReset();
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${withNext("/auth/callback", next)}`,
          },
        });
        if (error) throw error;
        setPassword("");
        if (data.session) {
          finish();
          return;
        }
        setConfirmedEmail(email.trim());
        setMode("verify");
        setNotice(t("account.verifySent", { email: email.trim() }));
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword("");
      finish();
    } catch (error) {
      const nextFailure = classifyAuthFailure(error);
      if (nextFailure.kind === "email-unconfirmed") {
        setConfirmedEmail(email.trim());
        setMode("verify");
      }
      setFailure(nextFailure);
    } finally {
      submitting.current = false;
      setBusy(null);
    }
  };

  const resend = async () => {
    if (busy || !confirmedEmail) return;
    setBusy("resend");
    setFailure(null);
    setNotice("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: confirmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}${withNext("/auth/callback", next)}`,
        },
      });
      if (error) throw error;
      setNotice(t("account.verificationResent"));
    } catch (error) {
      setFailure(classifyAuthFailure(error));
    } finally {
      setBusy(null);
    }
  };

  const input =
    "mt-2 min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const invalid = "border-destructive";
  const title = recovery
    ? t("account.passwordTitle")
    : mode === "verify"
      ? t("account.verifyTitle")
      : mode === "signup"
        ? t("account.createTitle")
        : mode === "reset"
          ? t("account.recoverTitle")
          : t("account.signInTitle");
  const failureMessage = failure ? t(authFailureKey(failure.kind)) : "";

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="mt-8 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <h2 id={`${ids}-title`} className="font-display text-xl font-bold">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {recovery ? t("account.verifySentPassword") : t("account.signInIntro")}
      </p>

      {/* Provider availability is read from the auth service, never assumed. */}
      {!capabilities && !capabilitiesError && (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {t("account.checkingMethods")}
        </p>
      )}
      {capabilitiesError && (
        <div role="alert" className="mt-4 rounded-md border border-border p-3 text-sm">
          <span className="flex items-start gap-2">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 text-destructive" />
            {t("account.methodsError")}
          </span>
          <Button
            type="button"
            variant="outline"
            className="mt-2"
            onClick={() => {
              setCapabilitiesError(false);
              setCapabilities(null);
              void fetch("/api/auth/config")
                .then((r) => r.json() as Promise<Capabilities>)
                .then((data) => {
                  setCapabilities(data);
                  setCapabilitiesError(!data.ok);
                })
                .catch(() => setCapabilitiesError(true));
            }}
          >
            {t("account.methodsRetry")}
          </Button>
        </div>
      )}

      {!recovery && mode !== "verify" && (
        <>
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => void startGoogle()}
            disabled={busy !== null || !capabilities?.google}
            aria-describedby={capabilities && !capabilities.google ? `${ids}-google-note` : undefined}
          >
            {busy === "google" ? (
              <Loader2 aria-hidden="true" className="animate-spin" />
            ) : (
              <GoogleMark />
            )}
            {t("account.continueGoogle")}
          </Button>
          {capabilities && !capabilities.google && (
            <p id={`${ids}-google-note`} className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("account.googleUnavailable")}
            </p>
          )}
          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("account.orEmail")}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      {failure && (
        <div role="alert" className="mb-4 rounded-md border border-destructive p-3 text-sm">
          <p className="flex items-start gap-2">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
            <span>{failureMessage}</span>
          </p>
          {failure.providerMessage && (
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">{t("account.providerDetail")}</summary>
              <p className="mt-1 break-words">{failure.providerMessage}</p>
            </details>
          )}
          {failure.action === "reset" && mode === "signin" && (
            <Button type="button" variant="ghost" className="mt-2" onClick={() => setMode("reset")}>
              {t("account.forgotPassword")}
            </Button>
          )}
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 rounded-md border border-border p-3 text-sm"
        >
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          <span>{notice}</span>
        </p>
      )}

      {mode === "verify" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            {confirmedEmail
              ? t("account.verifySent", { email: confirmedEmail })
              : t("account.checkEmail")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void resend()}
              disabled={busy !== null || !confirmedEmail}
            >
              {busy === "resend" && <Loader2 aria-hidden="true" className="animate-spin" />}
              {t("account.resendVerification")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("signin")}>
              {t("account.backToSignIn")}
            </Button>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void submit(event)} noValidate>
          <div>
            <label htmlFor={`${ids}-email`} className="text-sm font-medium">
              {t("account.email")}
            </label>
            <div className="relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id={`${ids}-email`}
                ref={emailRef}
                className={`${input} pe-10 ${fieldErrors.email ? invalid : ""}`}
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? `${ids}-email-error` : undefined}
              />
            </div>
            {fieldErrors.email && (
              <p id={`${ids}-email-error`} className="mt-1 text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {mode !== "reset" && (
            <div>
              <label htmlFor={`${ids}-password`} className="text-sm font-medium">
                {t("account.password")}
              </label>
              <div className="relative">
                <input
                  id={`${ids}-password`}
                  className={`${input} pe-12 ${fieldErrors.password ? invalid : ""}`}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" && !recovery ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password
                      ? `${ids}-password-error`
                      : mode === "signup" || recovery
                        ? `${ids}-password-hint`
                        : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? t("account.hidePassword") : t("account.showPassword")}
                  aria-pressed={showPassword}
                  className="absolute end-0 top-2 grid size-11 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="size-4" />
                  ) : (
                    <Eye aria-hidden="true" className="size-4" />
                  )}
                </button>
              </div>
              {fieldErrors.password ? (
                <p id={`${ids}-password-error`} className="mt-1 text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              ) : (
                (mode === "signup" || recovery) && (
                  <p id={`${ids}-password-hint`} className="mt-1 text-xs text-muted-foreground">
                    {t("account.passwordHint")}
                  </p>
                )
              )}
            </div>
          )}

          {recovery && (
            <div>
              <label htmlFor={`${ids}-confirm`} className="text-sm font-medium">
                {t("account.confirmPassword")}
              </label>
              <input
                id={`${ids}-confirm`}
                className={input}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy !== null} aria-busy={busy !== null}>
            {busy === "email" && <Loader2 aria-hidden="true" className="animate-spin" />}
            {busy === "email"
              ? t("account.wait")
              : recovery
                ? t("account.updatePassword")
                : mode === "signup"
                  ? t("account.createAccount")
                  : mode === "reset"
                    ? t("account.sendRecovery")
                    : t("account.signInEmail")}
          </Button>

          {mode === "reset" && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("account.recoveryIntro")}
            </p>
          )}

          {!recovery && (
            <div className="flex flex-wrap gap-2">
              {mode === "signup" ? (
                <Button type="button" variant="ghost" onClick={() => setMode("signin")}>
                  {t("account.haveAccount")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMode("signup")}
                  disabled={capabilities != null && !capabilities.signup}
                >
                  {t("account.noAccount")}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setMode(mode === "reset" ? "signin" : "reset")}
              >
                {mode === "reset" ? t("account.backToSignIn") : t("account.forgotPassword")}
              </Button>
            </div>
          )}
        </form>
      )}

      <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        {t("account.emergencyNote")}
      </p>
    </section>
  );
}
