import { useEffect } from "react";
import { movementRuntime } from "@/lib/movementRuntime";

/**
 * Mounted once in the root layout. It owns the app's only `devicemotion`
 * listener, so monitoring keeps working when the person moves from /monitor to
 * another page, and so the fall detector and the stillness monitor read the
 * same samples.
 */
export function MovementMonitorRunner() {
  useEffect(() => {
    movementRuntime.attach();
    return () => movementRuntime.detachListener();
  }, []);
  return null;
}
