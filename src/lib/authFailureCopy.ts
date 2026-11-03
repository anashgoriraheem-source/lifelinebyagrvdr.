import type { MessageKey } from "@/i18n/messages/en";
import type { AuthErrorKind } from "./authErrors";

/** One guidance sentence per failure kind, shared by every sign-in surface. */
const KEYS: Record<AuthErrorKind, MessageKey> = {
  "invalid-credentials": "account.errInvalidCredentials",
  "email-unconfirmed": "account.errEmailUnconfirmed",
  "already-registered": "account.errAlreadyRegistered",
  "weak-password": "account.errWeakPassword",
  "same-password": "account.errSamePassword",
  "rate-limited": "account.errRateLimited",
  "signup-disabled": "account.errSignupDisabled",
  "provider-unavailable": "account.errProvider",
  "link-expired": "account.errLinkExpired",
  offline: "account.errOffline",
  cancelled: "account.errCancelled",
  unknown: "account.errUnknown",
};

export function authFailureKey(kind: AuthErrorKind): MessageKey {
  return KEYS[kind];
}
