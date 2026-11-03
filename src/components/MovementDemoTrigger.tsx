import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { raiseAlarm } from "@/lib/store";

/**
 * Demo mode only. It opens the app's normal alarm from a clearly-labelled demo
 * event so the countdown and the "I'm OK" cancellation can be checked without a
 * physical sensor. Demo alarms are stored as test incidents, so nothing reaches
 * a real contact. This is the only part of the monitor that raises an alarm on
 * purpose outside a real sensor reading.
 */
export function MovementDemoTrigger() {
  const demo = useApp((s) => s.demoMode);
  if (!demo) return null;
  return (
    <Button
      variant="outline"
      className="mt-3 min-h-11 text-xs"
      onClick={() =>
        raiseAlarm(
          {
            type: "fall",
            label: "Fall pattern detected (demo)",
            reading: "demo event — no sensor reading was measured",
          },
          { demo: true },
        )
      }
    >
      Simulate a sensor alarm (demo)
    </Button>
  );
}
