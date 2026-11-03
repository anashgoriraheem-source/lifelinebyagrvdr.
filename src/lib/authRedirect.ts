/**
 * Sign-in redirect targets.
 *
 * After sign-in the user is sent to a path they asked for. That value arrives
 * from the URL, so it is treated as untrusted: only same-origin, absolute paths
 * are accepted. Anything else (a full URL, a protocol-relative `//host`, a
 * backslash trick, a control character) falls back to the default destination.
 */
export const DEFAULT_AFTER_SIGN_IN = "/account";

/** A fixed base used only to parse and compare; never navigated to. */
const PLACEHOLDER_ORIGIN = "https://lifeline.invalid";

/** Paths that must never be a post-sign-in destination (they would loop). */
const NON_DESTINATIONS = ["/auth/callback"];

export function safeNextPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_AFTER_SIGN_IN,
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback;
  // `//host` and `/\host` are read as another origin by browsers.
  if (value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  if (NON_DESTINATIONS.some((path) => url.pathname === path)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Adds a validated `next` parameter to an internal path. */
export function withNext(path: string, next: string): string {
  const url = new URL(path, PLACEHOLDER_ORIGIN);
  url.searchParams.set("next", safeNextPath(next));
  return `${url.pathname}${url.search}`;
}

/** Where a sign-in surface should return the visitor, read from the current URL. */
export function nextFromLocation(search: string): string {
  return safeNextPath(new URLSearchParams(search).get("next"));
}
