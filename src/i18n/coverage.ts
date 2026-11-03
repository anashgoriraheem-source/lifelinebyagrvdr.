/**
 * Locale-pack validation.
 *
 * The app must never claim that a language is completely translated when
 * strings are missing, and never claim human or clinical review it does not
 * have. This module is the single source of truth for those claims: the
 * language picker, the settings page and the tests all read the same audit.
 */
import { en, type MessageKey } from "./messages/en";
import { packs } from "./messages/packs";
import { LOCALES, type LocaleCode, type PackStatus } from "./locales";

/**
 * Strings every locale pack must contain before the interface can be called
 * translated for that surface. Missing keys fall back to English, so this list
 * is what turns "looks translated" into a verifiable claim.
 */
export const REQUIRED_SURFACES = {
  release: Object.keys(en).filter(
    (k) =>
      k.startsWith("release.") ||
      k.startsWith("reading.") ||
      k.startsWith("privacy.") ||
      k.startsWith("translation."),
  ) as MessageKey[],
  navigation: [
    "nav.home",
    "nav.monitor",
    "nav.assistant",
    "nav.translate",
    "nav.contacts",
    "nav.account",
    "nav.primary",
  ],
  safety: [
    "safety.callEmergency",
    "safety.notMedicalDevice",
    "safety.noAutoDispatch",
    "safety.alertActive",
  ],
  assistant: [
    "chat.title",
    "chat.subtitle",
    "chat.placeholder",
    "chat.send",
    "chat.thinking",
    "chat.sources",
    "chat.escalationTitle",
    "chat.escalationBody",
    "chat.voiceStart",
    "chat.voiceUnavailable",
    "chat.disclaimer",
  ],
  translator: [
    "translate.title",
    "translate.from",
    "translate.to",
    "translate.input",
    "translate.output",
    "translate.action",
    "translate.machine",
    "translate.unavailable",
    "translate.providerTitle",
  ],
  medication: [
    "med.title",
    "med.subtitle",
    "med.disabledHeading",
    "med.emergencyHeading",
    "med.refusedHeading",
    "med.labelOnly",
    "med.disclaimer",
    "med.check",
  ],
  voice: [
    "voice.title",
    "voice.pause",
    "voice.resume",
    "voice.replay",
    "voice.textOnly",
    "voice.noMatchingVoice",
    "voice.inputUnavailable",
  ],
  accessibility: ["a11y.languageChanged", "lang.label", "common.loading", "common.error"],
  hero: [
    "hero.titleLine1",
    "hero.titleLine2",
    "hero.cta",
    "hero.eyebrow",
    "hero.tagline",
    "hero.statusIdle",
    "hero.specReadings",
  ],
  device: [
    "device.connect.title",
    "device.connect.intro",
    "device.connect.stepsHeading",
    "device.connect.ready",
    "device.connect.unsupported",
    "device.connect.insecure",
    "device.connect.action",
    "device.connect.actionHint",
    "device.connect.statusIdle",
    "device.connect.statusOpening",
    "device.connect.cancelled",
    "device.connect.denied",
    "device.connect.rangeError",
    "device.connect.incompatible",
    "device.connect.failed",
    "device.connect.without",
    "device.connect.limitBackground",
  ],
  contacts: [
    "contacts.title",
    "contacts.subtitle",
    "contacts.emergencyHeading",
    "contacts.emergencyGeneral",
    "contacts.emergencyNote",
    "contacts.personalHeading",
    "contacts.add",
    "contacts.empty",
    "contacts.testNotice",
    "contacts.saveToAccount",
    "contacts.autoHeading",
    "contacts.consent",
    "contacts.consentBody",
    "contacts.location",
    "contacts.policy",
    "contacts.policy1",
    "contacts.countdownHeading",
    "contacts.limitsHeading",
    "contacts.limitsBody",
    "contacts.formNew",
    "contacts.formPhone",
    "contacts.formPhoneError",
    "contacts.historyHeading",
  ],
  account: [
    "account.title",
    "account.subtitle",
    "account.langHeading",
    "account.langNote",
    "account.signInTitle",
    "account.email",
    "account.password",
    "account.signInEmail",
    "account.phoneNote",
    "account.signOut",
    "account.profileHeading",
    "account.fieldName",
    "account.privacyHeading",
    "account.privacyBody",
    "account.exportAccount",
    "account.deleteData",
    "account.deleteAccountConfirm",
  ],
} as const satisfies Record<string, readonly MessageKey[]>;

export type Surface = keyof typeof REQUIRED_SURFACES;

export const ALL_REQUIRED_KEYS: MessageKey[] = [
  ...new Set(Object.values(REQUIRED_SURFACES).flat() as MessageKey[]),
];

export interface LocaleAudit {
  code: LocaleCode;
  englishName: string;
  nativeName: string;
  status: PackStatus;
  /** Share of the whole reference catalog present in this pack (0–1). */
  coverage: number;
  missingKeys: MessageKey[];
  missingBySurface: { surface: Surface; missing: MessageKey[] }[];
  /** True only when every reference key exists in this pack. */
  complete: boolean;
  safetyReviewed: boolean;
}

const REFERENCE_KEYS = Object.keys(en) as MessageKey[];

export function auditLocale(code: LocaleCode): LocaleAudit {
  const definition = LOCALES.find((l) => l.code === code) ?? LOCALES[0];
  const pack = packs[code] ?? {};
  const missingKeys = code === "en" ? [] : REFERENCE_KEYS.filter((key) => !(key in pack));
  const missingBySurface = (Object.keys(REQUIRED_SURFACES) as Surface[])
    .map((surface) => ({
      surface,
      missing: REQUIRED_SURFACES[surface].filter((key) => code !== "en" && !(key in pack)),
    }))
    .filter((entry) => entry.missing.length > 0);
  return {
    code,
    englishName: definition.englishName,
    nativeName: definition.nativeName,
    status: definition.status,
    coverage: code === "en" ? 1 : Object.keys(pack).length / REFERENCE_KEYS.length,
    missingKeys,
    missingBySurface,
    complete: missingKeys.length === 0,
    safetyReviewed: definition.safetyReviewed,
  };
}

export const auditPacks = () => LOCALES.map((l) => auditLocale(l.code));

/**
 * The only allowed description of a locale's state. `complete` is derived from
 * the audit, never from the locale definition alone.
 */
export function describeLocale(audit: LocaleAudit): {
  tone: "complete" | "partial" | "machine";
  message: string;
} {
  if (audit.complete && audit.code === "en") {
    return { tone: "complete", message: "Reference interface language (English)." };
  }
  if (audit.complete) {
    return {
      tone: audit.status === "machine-draft" ? "machine" : "complete",
      message:
        audit.status === "machine-draft"
          ? "All interface strings present, machine-drafted and not reviewed by a fluent speaker."
          : "All interface strings present.",
    };
  }
  return {
    tone: "partial",
    message: `${audit.missingKeys.length} of ${REFERENCE_KEYS.length} interface strings are missing and fall back to English.`,
  };
}

export const referenceKeyCount = REFERENCE_KEYS.length;
