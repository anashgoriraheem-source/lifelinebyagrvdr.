import { Store } from "@tanstack/react-store";
import { DEFAULT_THRESHOLDS, EMERGENCY_BY_COUNTRY } from "./fixtures";
import { persistedSettingsSchema } from "./settings";
import { loadReadingDays, mergeDay, saveReadingDays, type ReadingDays } from "./readingDays";
import type { RecordedPlace } from "./places";
import type { AlertRecordState } from "./alertPlan";
import type { LocaleCode } from "@/i18n/locales";
import type { DispatchView } from "./dispatch.functions";
import type {
  AlarmReason,
  DeviceIssue,
  AlarmState,
  Profile,
  Contact,
  LocationFix,
  LocationStatus,
  LogEntry,
  Reading,
  Threshold,
  VitalKey,
} from "./types";

export interface AppState {
  storageIssue: "none" | "blocked" | "invalid";
  demoMode: boolean;
  scenario: string;
  vitals: Partial<Record<VitalKey, Reading>>;
  history: Record<VitalKey, number[]>;
  thresholds: Record<VitalKey, Threshold>;
  contacts: Contact[];
  /** Device-local record of which vitals produced a reading on each day. */
  readingDays: ReadingDays;
  countryCode: string;
  countdownSeconds: number;
  alarm: AlarmState;
  log: LogEntry[];
  location: { status: LocationStatus; fix: LocationFix | null; error: string | null };
  /** Places recorded in this tab, newest first. In memory only — see `places.ts`. */
  places: RecordedPlace[];
  assistantOpen: boolean;
  device: DeviceState;
  profile: Profile;
  userId: string | null;
  userEmail: string | null;
  accountStatus: "signed-out" | "loading" | "ready" | "error";
  assistantLanguage: "en" | "hi" | "pa" | "ur";
  /** Interface language. Persisted locally when signed out and saved to the account when signed in. */
  language: LocaleCode;
  /** True once the first-run language step has been confirmed. */
  languageChosen: boolean;
  /** Explicit consent to contact the saved emergency contacts after a deliberate SOS. */
  dispatchConsent: boolean;
  /** Whether consented location may be shared in automatic contact messages. */
  shareLocation: boolean;
  /** Active live-location incident in the cloud, if signed in. */
  incident: { id: string; token: string } | null;
  /** Whether the current alarm was written to the account's test-mode alert history. */
  alertRecord: AlertRecordState;
  /** Server-side dispatch record for the current alarm, if one was created. */
  dispatch: DispatchView | null;
  dispatchState: "idle" | "countdown" | "sending" | "ready" | "error" | "signed-out";
}

export interface DeviceState {
  status: "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";
  name: string | null;
  /** Vitals this connection has a live subscription (or read poll) for. */
  vitals: VitalKey[];
  /** Machine reason for a failed connection, translated by the UI. */
  error?: string;
  /** How the device was discovered: filtered by standard services, or any device. */
  mode?: "standard" | "any";
  /** When this GATT connection was established; used to explain a missing reading. */
  connectedAt?: number | null;
  /** Arrival time of the newest measurement on this connection. */
  lastReadingAt?: number | null;
  /** Measurements accepted on this connection (not packets received). */
  readingCount?: number;
  /** Vitals a connection actually exposed, and the supported ones it did not. */
  servicesFound?: VitalKey[];
  missing?: VitalKey[];
  /** Time of the newest rejected packet, for "device is sending something unusable". */
  lastInvalidAt?: number | null;
  /** Services the device exposed but could not start sending from (see DeviceIssue). */
  issues?: DeviceIssue[];
  /** 1-based attempt of an automatic reconnect that is in progress. */
  recoveryAttempt?: number | null;
}

const SETTINGS_KEY = "lifeline:settings:v1";

const initial: AppState = {
  storageIssue: "none",
  demoMode: false,
  scenario: "stable",
  vitals: {},
  history: { bp: [], glucose: [], hr: [], spo2: [] },
  thresholds: DEFAULT_THRESHOLDS,
  contacts: [],
  readingDays: {},
  countryCode: "IN",
  countdownSeconds: 15,
  alarm: { phase: "idle", reason: null, startedAt: null, demo: false },
  log: [],
  location: { status: "idle", fix: null, error: null },
  places: [],
  assistantOpen: false,
  device: { status: "idle", name: null, vitals: [] },
  profile: { name: "", age: null, bloodType: "", conditions: [], allergies: [], medications: [] },
  userId: null,
  userEmail: null,
  accountStatus: "signed-out",
  assistantLanguage: "en",
  language: "en",
  languageChosen: false,
  dispatchConsent: false,
  shareLocation: false,
  incident: null,
  alertRecord: "idle",
  dispatch: null,
  dispatchState: "idle",
};

export const appStore = new Store<AppState>(initial);

export const set = (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) =>
  appStore.setState((s) => ({ ...s, ...(typeof patch === "function" ? patch(s) : patch) }));

export const emergencyNumbers = (s: AppState) =>
  EMERGENCY_BY_COUNTRY[s.countryCode] ?? {
    country: "Unknown — select your country in Contacts",
    general: "",
    police: "",
    ambulance: "",
    fire: "",
    smsVerified: false,
    smsNumber: "",
    smsNote: "Emergency numbers are not configured for this location.",
  };

let logSeq = 0;
export function addLog(kind: LogEntry["kind"], text: string) {
  set((s) => ({
    log: [{ id: `e${Date.now()}-${logSeq++}`, at: Date.now(), kind, text }, ...s.log].slice(0, 50),
  }));
}

/**
 * Records that these vitals produced a reading today, for the device-local
 * seven-day overview. Only which vitals were seen is kept — never the values.
 * Writes only when the day's set actually grows, so per-second readings do not
 * thrash storage.
 */
export function noteReadingDay(keys: VitalKey[], at = Date.now()) {
  const next = mergeDay(appStore.state.readingDays, keys, at);
  if (next === appStore.state.readingDays) return;
  saveReadingDays(next);
  set({ readingDays: next });
}

/** Start the alarm countdown. De-duplicates: an active alarm is never restarted. */
export function raiseAlarm(reason: AlarmReason, opts: { demo: boolean; immediate?: boolean }) {
  const s = appStore.state;
  if (s.alarm.phase !== "idle") return;
  const immediate = opts.immediate || s.countdownSeconds === 0;
  set({
    alarm: {
      phase: immediate ? "active" : "countdown",
      reason,
      startedAt: Date.now(),
      demo: opts.demo,
    },
    // Never cover the "I'm OK" button during the countdown.
    assistantOpen: immediate,
  });
  addLog(
    reason.type === "sos" ? "sos" : "alarm",
    `${reason.label} · ${reason.reading}${opts.demo ? " (demo)" : ""}`,
  );
}

/** Opens the action screen where the user chooses calls and messages. Nothing is sent automatically. */
export function openAlarmActions() {
  set((s) => ({ alarm: { ...s.alarm, phase: "active" }, assistantOpen: true }));
}

export function cancelAlarm(note: string) {
  const s = appStore.state;
  if (s.alarm.phase === "idle") return;
  const secs = s.alarm.startedAt ? Math.round((Date.now() - s.alarm.startedAt) / 1000) : 0;
  addLog("cancel", `${s.alarm.reason?.label ?? "Alarm"} · ${note} after ${secs} s`);
  set({
    alarm: { phase: "idle", reason: null, startedAt: null, demo: false },
    dispatch: null,
    dispatchState: "idle",
  });
  if (s.demoMode && s.scenario !== "stable") set({ scenario: "stable" });
}

/* ---- settings persistence (device-local until accounts land, see PLAN.md) ---- */

type Persisted = Pick<
  AppState,
  | "contacts"
  | "countryCode"
  | "countdownSeconds"
  | "thresholds"
  | "demoMode"
  | "profile"
  | "assistantLanguage"
  | "language"
  | "languageChosen"
  | "dispatchConsent"
  | "shareLocation"
>;

let unsubscribeSettings: { unsubscribe: () => void } | null = null;

/**
 * The contacts and profile saved on this device, as last written before the
 * visitor signed in. Used to restore what the person can see when they sign
 * out, and to offer an explicit import — never uploaded on its own.
 */
export function deviceLocalSafetySnapshot(): {
  contacts: AppState["contacts"];
  profile: AppState["profile"] | null;
} | null {
  try {
    const parsed = persistedSettingsSchema.safeParse(
      JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"),
    );
    if (!parsed.success) return null;
    return { contacts: parsed.data.contacts ?? [], profile: parsed.data.profile ?? null };
  } catch {
    return null;
  }
}
export function loadSettings() {
  unsubscribeSettings?.unsubscribe();
  const readingDays = loadReadingDays();
  if (Object.keys(readingDays).length) set({ readingDays });
  let writable = true;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = persistedSettingsSchema.safeParse(JSON.parse(raw));
      if (parsed.success) set(parsed.data);
      else {
        writable = false;
        set({ storageIssue: "invalid" });
      }
    }
  } catch {
    writable = false;
    set({ storageIssue: "blocked" });
  }
  let previous = "";
  unsubscribeSettings = appStore.subscribe((s) => {
    if (s.userId || !writable) return;
    const p: Persisted = {
      contacts: s.contacts,
      countryCode: s.countryCode,
      countdownSeconds: s.countdownSeconds,
      thresholds: s.thresholds,
      demoMode: s.demoMode,
      profile: s.profile,
      assistantLanguage: s.assistantLanguage,
      language: s.language,
      languageChosen: s.languageChosen,
      dispatchConsent: s.dispatchConsent,
      shareLocation: s.shareLocation,
    };
    const next = JSON.stringify(p);
    if (next === previous) return;
    try {
      localStorage.setItem(SETTINGS_KEY, next);
      previous = next;
    } catch {
      if (appStore.state.storageIssue !== "blocked") set({ storageIssue: "blocked" });
    }
  });
  return () => {
    unsubscribeSettings?.unsubscribe();
    unsubscribeSettings = null;
  };
}

/** Delete only this app's local records, never unrelated browser storage. */
export function deleteDeviceLocalData() {
  unsubscribeSettings?.unsubscribe();
  unsubscribeSettings = null;
  let failed = false;
  for (const key of [SETTINGS_KEY, "lifeline:reading-days:v1", "lifeline:locale"]) {
    try {
      localStorage.removeItem(key);
    } catch {
      failed = true;
    }
  }
  set({
    contacts: [],
    profile: initial.profile,
    thresholds: DEFAULT_THRESHOLDS,
    readingDays: {},
    log: [],
    vitals: {},
    history: { hr: [], spo2: [], bp: [], glucose: [] },
    location: { status: "idle", fix: null, error: null },
    places: [],
    incident: null,
    shareLocation: false,
    dispatchConsent: false,
    demoMode: false,
    scenario: "stable",
    storageIssue: failed ? "blocked" : "none",
  });
  if (!failed) loadSettings();
  return !failed;
}
