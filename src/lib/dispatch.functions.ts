import { createServerFn } from "@tanstack/react-start";
/** No provider requests, simulated receipts, location upload or live dispatch.
 * Manual telephone and message drafts remain the only contact actions.
 */
export interface DispatchView {
  eventId: string;
  status: "active" | "cancelled";
  mode: "test" | "live";
  liveReady: boolean;
}
export const getProviderStatus = createServerFn({ method: "GET" }).handler(async () => ({
  mode: "test" as const,
  liveReady: false,
  sms: false,
  voice: false,
  email: false,
  missing: ["Live alert delivery is disabled. Use the call or message draft buttons."],
  policySteps: ["Nothing is sent automatically. Delivery cannot be confirmed here."],
}));
const blocked = async (_args: { data: unknown }): Promise<DispatchView> => {
  throw new Error("Automatic delivery is disabled. Open a call or a message draft instead.");
};
export const dispatchEmergency = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(blocked);
export const advanceDispatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(blocked);
export const getDispatchState = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(blocked);
export const cancelDispatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => data)
  .handler(blocked);
