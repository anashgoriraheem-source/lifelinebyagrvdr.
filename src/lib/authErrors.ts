/**
 * Turns an auth provider error into something a person can act on.
 *
 * The provider's own wording is kept as `providerMessage` and shown as
 * received; `kind` selects the guidance text in the sign-in panel. Nothing is
 * guessed: an unrecognised message stays `unknown` and keeps its raw text.
 */
export type AuthErrorKind =
  | "invalid-credentials"
  | "email-unconfirmed"
  | "already-registered"
  | "weak-password"
  | "same-password"
  | "rate-limited"
  | "signup-disabled"
  | "provider-unavailable"
  | "link-expired"
  | "offline"
  | "cancelled"
  | "unknown";

export interface AuthFailure {
  kind: AuthErrorKind;
  providerMessage: string;
  /** Suggested next step the panel can offer. */
  action: "retry" | "reset" | "verify" | "signin" | null;
}

interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  name?: unknown;
}

const OFFLINE = /failed to fetch|networkerror|network request failed|load failed|err_internet|offline/i;

export function classifyAuthFailure(error: unknown): AuthFailure {
  const source = (error ?? {}) as ErrorLike;
  const providerMessage =
    typeof source.message === "string" && source.message.trim()
      ? source.message.trim()
      : typeof source.name === "string"
        ? source.name
        : "";
  const code = typeof source.code === "string" ? source.code : "";
  const text = `${code} ${providerMessage}`;

  if (OFFLINE.test(text) || source instanceof TypeError) {
    return { kind: "offline", providerMessage, action: "retry" };
  }
  if (/provider is not enabled|unsupported provider/i.test(text)) {
    return { kind: "provider-unavailable", providerMessage, action: null };
  }
  if (/signups? not allowed|signup_disabled|signup is disabled/i.test(text)) {
    return { kind: "signup-disabled", providerMessage, action: "signin" };
  }
  if (/email not confirmed|email_not_confirmed/i.test(text)) {
    return { kind: "email-unconfirmed", providerMessage, action: "verify" };
  }
  if (/user already registered|already been registered|email_exists/i.test(text)) {
    return { kind: "already-registered", providerMessage, action: "signin" };
  }
  if (/for security purposes|rate limit|too many requests|over_.*rate_limit/i.test(text)) {
    return { kind: "rate-limited", providerMessage, action: "retry" };
  }
  if (/should be different from the old/i.test(text)) {
    return { kind: "same-password", providerMessage, action: null };
  }
  if (/password should be at least|weak password|password is too short/i.test(text)) {
    return { kind: "weak-password", providerMessage, action: null };
  }
  if (/token has expired|invalid or has expired|otp_expired|link is invalid/i.test(text)) {
    return { kind: "link-expired", providerMessage, action: "reset" };
  }
  if (/invalid login credentials|invalid_grant|invalid credentials/i.test(text)) {
    return { kind: "invalid-credentials", providerMessage, action: "reset" };
  }
  if (/access_denied|cancell?ed|popup closed|user denied/i.test(text)) {
    return { kind: "cancelled", providerMessage, action: "retry" };
  }
  return { kind: "unknown", providerMessage, action: "retry" };
}

/** OAuth failures come back as query/hash parameters, not Error objects. */
export function oauthFailureFromParams(params: URLSearchParams): AuthFailure | null {
  const error = params.get("error") ?? params.get("error_code");
  if (!error) return null;
  const description = params.get("error_description") ?? "";
  return classifyAuthFailure({ message: `${error} ${description}`.trim() });
}
