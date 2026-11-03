/** Generative health answers intentionally blocked pending an approved data
 * handling design, consent flow, clinical evaluation and provider agreement.
 * Existing keys alone MUST NOT enable transmission of health records/images.
 */
interface Config {
  name: string;
}
export const aiProviderConfig = (): Config | null => null;
export async function callChatModel(
  _messages: unknown[],
  _config: Config,
): Promise<{ ok: boolean; text?: string; error?: string }> {
  return { ok: false, error: "AI health answers are not enabled in this release candidate." };
}
