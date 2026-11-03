import { useState } from "react";
import { useI18n } from "@/i18n";
import { appStore, deleteDeviceLocalData } from "@/lib/store";
import { disconnectWearable } from "@/core/ble/connect";
import { stopTracking } from "@/lib/location";
import { Button } from "@/components/ui/button";
export function DevicePrivacy() {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const download = () => {
    try {
      const s = appStore.state;
      const payload = {
        exportedAt: new Date().toISOString(),
        profile: s.profile,
        contacts: s.contacts,
        thresholds: s.thresholds,
        country: s.countryCode,
        language: s.language,
        readingDays: s.readingDays,
        rawSavedSettings: localStorage.getItem("lifeline:settings:v1"),
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "lifeline-device-local-data.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNotice(t("release.storageBlocked"));
    }
  };
  return (
    <section aria-labelledby="privacy-heading" className="mt-5 rounded-xl border border-border p-4">
      <h2 id="privacy-heading" className="text-xl font-bold">
        {t("privacy.title")}
      </h2>
      <p className="mt-3 text-sm leading-relaxed">{t("privacy.body")}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="outline" onClick={download}>
          {t("privacy.export")}
        </Button>
        <Button variant="outline" onClick={() => setConfirm(true)}>
          {t("privacy.clear")}
        </Button>
      </div>
      {confirm && (
        <div className="mt-4 rounded-lg border border-critical p-3">
          <p className="font-semibold">{t("privacy.confirm")}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button
              variant="destructive"
              onClick={() => {
                disconnectWearable();
                stopTracking();
                setNotice(
                  t(deleteDeviceLocalData() ? "privacy.deleted" : "release.storageBlocked"),
                );
                setConfirm(false);
              }}
            >
              {t("privacy.confirm")}
            </Button>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-3 text-sm">
        {notice}
      </p>
    </section>
  );
}
