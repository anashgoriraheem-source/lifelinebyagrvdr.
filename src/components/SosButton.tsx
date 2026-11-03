import { Button } from "@/components/ui/button";
import { useApp } from "@/hooks/useApp";
import { useI18n } from "@/i18n";
import { raiseAlarm } from "@/lib/store";
/** Opens actions only. Never places a call or sends a message. */
export function SosButton({ size = "lg" }: { size?: "lg" | "sm" }) {
  const demo = useApp((s) => s.demoMode);
  const { locale } = useI18n();
  return (
    <Button
      variant="destructive"
      className={`min-h-12 whitespace-normal ${size === "lg" ? "px-6 py-4" : "px-3"}`}
      onClick={() =>
        raiseAlarm(
          { type: "sos", label: "Emergency actions requested", reading: "No call or message sent" },
          { demo, immediate: true },
        )
      }
    >
      {locale === "hi" ? "आपातकालीन विकल्प खोलें" : "Open emergency options"}
    </Button>
  );
}
