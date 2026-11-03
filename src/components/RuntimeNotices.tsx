import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { useApp } from "@/hooks/useApp";
import { set } from "@/lib/store";
import { stopTracking } from "@/lib/location";
import { disconnectWearable } from "@/core/ble/connect";
import { Button } from "@/components/ui/button";
export function RuntimeNotices() {
  const { t } = useI18n();
  const issue = useApp((s) => s.storageIssue);
  const [offline, setOffline] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    online();
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        disconnectWearable();
        stopTracking();
        set({ vitals: {}, history: { hr: [], spo2: [], bp: [], glucose: [] } });
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    if ("serviceWorker" in navigator && window.isSecureContext && !import.meta.env.DEV)
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* Offline page reports registration failure. */
      });
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <aside aria-label={t("status.inactive")} className="mx-auto max-w-6xl px-4 pb-32 text-sm">
      <p className="rounded-lg border border-warning p-3">{t("release.warning")}</p>
      {offline && (
        <p role="status" className="mt-3 rounded-lg border border-border p-3">
          {t("network.offline")}
        </p>
      )}
      {issue !== "none" && (
        <p role="alert" className="mt-3 rounded-lg border border-critical p-3">
          {t(issue === "invalid" ? "release.storageInvalid" : "release.storageBlocked")}
        </p>
      )}
      {paused && (
        <div role="status" className="mt-3 rounded-lg border border-warning p-3">
          <p>{t("release.suspended")}</p>
          <Button variant="outline" className="mt-3" onClick={() => setPaused(false)}>
            {t("release.resume")}
          </Button>
        </div>
      )}
    </aside>
  );
}
