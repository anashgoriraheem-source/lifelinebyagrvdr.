import type { Tables } from "@/integrations/supabase/types";
import type { Contact } from "./types";

/** A contact row exactly as PostgREST returns it. */
export type ContactRow = Tables<"contacts">;

/**
 * Maps a database row to the app's `Contact`. Kept in one place so the account
 * page, the global account sync and any future screen cannot drift on null
 * handling (the database uses NULL; the app uses empty values).
 */
export function contactsFromRows(rows: ContactRow[]): Contact[] {
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    relationship: c.relationship,
    phone: c.phone,
    call: c.call,
    sms: c.sms,
    email: c.email ?? "",
    emailAlerts: Boolean(c.email_alerts),
    confirmedAt: c.confirmed_at ? Date.parse(c.confirmed_at) : null,
    testDestination: c.test_destination !== false,
    automationConsent: Boolean(c.automation_consent),
    consentAt: c.consent_at ? Date.parse(c.consent_at) : null,
    consentNote: c.consent_note ?? "",
  }));
}
