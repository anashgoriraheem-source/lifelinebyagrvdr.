/** Single-process safety budget, NOT a distributed production limiter.
 * No raw address, text, contact, or health information is retained. Do not use
 * client-supplied forwarded headers as identity. Production needs edge limits.
 */
const windows = new Map<string, { start: number; count: number }>();
export function checkRateLimit(key: string, limit: number, duration: number, now = Date.now()) {
  for (const [k, v] of windows) if (now - v.start >= duration) windows.delete(k);
  let w = windows.get(key);
  if (!w) {
    if (windows.size >= 10000) return false;
    w = { start: now, count: 0 };
    windows.set(key, w);
  }
  if (w.count >= limit) return false;
  w.count++;
  return true;
}
export const rateKey = (scope: string, userId: string | null, _untrustedIp?: string | null) =>
  `${scope}:${userId ?? "anonymous-global"}`;
