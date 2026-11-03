/** Shared view types for the automatic-alert screens (client-safe: no secrets). */

export interface AttemptView {
  id: string;
  channel: "sms" | "call";
  contactName: string;
  status: string;
  provider: string;
  providerStatus: string | null;
  error: string | null;
  order: number;
  updatedAt: string;
}

export interface TimelineView {
  kind: string;
  detail: string;
  at: string;
}

export interface DispatchView {
  eventId: string;
  /** "active" while the incident still expects action. */
  status: "active" | "cancelled";
  mode: "test" | "live";
  liveReady: boolean;
  incidentStatus: string;
  cancelDeadline: number | null;
  attempts: AttemptView[];
  timeline: TimelineView[];
  providerConfigured: boolean;
  blockedReason: string | null;
  round: number;
  maxRounds: number;
  nextActionAt: number | null;
  updatedAt: string;
}

export interface ProviderStatusView {
  mode: "test" | "live";
  liveReady: boolean;
  sms: boolean;
  voice: boolean;
  email: false;
  testDestinationConfigured: boolean;
  missing: string[];
  policySteps: string[];
}

export interface AlertSetupContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  emailAlerts: boolean;
  confirmedAt: string | null;
  testDestination: boolean;
  call: boolean;
  sms: boolean;
  position: number;
  automationConsent: boolean;
  consentAt: string | null;
  consentNote: string;
}

export interface AlertSetupView {
  settings: {
    identityName: string;
    automationEnabled: boolean;
    testMode: boolean;
    triggers: string[];
    countdownSeconds: number;
    includeLocation: boolean;
    escalateAfterSeconds: number;
    maxRounds: number;
    consentAt: string | null;
  } | null;
  contacts: AlertSetupContact[];
  provider: ProviderStatusView;
  recent: {
    id: string;
    startedAt: string;
    status: string;
    mode: string;
    reasonLabel: string;
    lastError: string | null;
  }[];
}

/** Human status line for an incident. */
export const INCIDENT_STATUS_LABEL: Record<string, string> = {
  queued: "Alert queued",
  countdown: "Counting down — cancels automatically when it ends",
  dispatching: "Sending now",
  escalating: "Escalation in progress",
  acknowledged: "A contact acknowledged the alert",
  resolved: "Resolved",
  canceled: "Canceled",
  failed: "No acknowledgement — nobody confirmed they are responding",
  blocked: "Not sent",
};
