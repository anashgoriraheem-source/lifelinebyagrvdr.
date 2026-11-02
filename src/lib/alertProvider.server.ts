/**
 * Server-only boundary for automatic contact alerts (SMS / voice).
 *
 * No messaging provider is configured or verified for this project, so
 * `getAlertProvider()` returns null and every attempt is recorded truthfully
 * as `unavailable`. A real provider must implement `AlertProvider`, run only
 * on the server with its secrets in server env vars, and be enabled only when
 * LIFELINE_LIVE_ALERTS=enabled after sandbox verification and owner approval.
 */
import type { AlertChannel } from './alertPlan'

export interface AlertSendRequest {
  idempotencyKey: string
  channel: AlertChannel
  to: string
  body: string
}

/** Only states a provider can actually report at send time. Delivery and acknowledgement come later via callbacks. */
export type AlertSendResult =
  | { status: 'provider_accepted'; providerRef: string }
  | { status: 'failed'; detail: string }
  | { status: 'unknown'; detail: string }

export interface AlertProvider {
  name: string
  isSandbox: boolean
  send(req: AlertSendRequest): Promise<AlertSendResult>
}

export const MAX_SEND_ATTEMPTS = 3

export function liveAlertsEnabled(): boolean {
  return process.env.LIFELINE_LIVE_ALERTS === 'enabled'
}

export function getAlertProvider(): AlertProvider | null {
  return null
}
