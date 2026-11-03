import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { readSafetyAccount, saveSafetyPreferences } from "@/lib/account.functions";
import { contactsFromRows } from "@/lib/accountContacts";
import { appStore, deviceLocalSafetySnapshot, set } from "@/lib/store";
import { disconnectWearable } from "@/core/ble/connect";
import { stopTracking } from "@/lib/location";
import { isLocaleCode } from "@/i18n/locales";

const EMPTY_PROFILE = {
  name: "",
  age: null,
  bloodType: "",
  conditions: [],
  allergies: [],
  medications: [],
};

export function AccountSync() {
  const read = useServerFn(readSafetyAccount);
  const savePrefs = useServerFn(saveSafetyPreferences);
  const router = useRouter();

  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
      return;
    let active = true;
    let generation = 0;
    const sync = async () => {
      const my = ++generation;
      const { data } = await supabase.auth.getUser();
      if (!active || my !== generation) return;
      const user = data.user;
      if (appStore.state.userId === (user?.id ?? null)) return;
      disconnectWearable();
      stopTracking();
      // Signed out: show what this device saved for itself rather than an empty
      // page. Those details are never uploaded without the explicit import.
      const local = user ? null : deviceLocalSafetySnapshot();
      set({
        vitals: {},
        history: { hr: [], spo2: [], bp: [], glucose: [] },
        location: { status: "idle", fix: null, error: null },
        userId: user?.id ?? null,
        userEmail: user?.email ?? null,
        contacts: local?.contacts ?? [],
        profile: local?.profile ?? EMPTY_PROFILE,
        log: [],
        incident: null,
        accountStatus: user ? "loading" : "signed-out",
        dispatch: null,
        dispatchState: "idle",
      });
      if (!user) return;
      try {
        const safety = await read();
        if (!active || my !== generation || appStore.state.userId !== user.id) return;
        const p = safety.profile;
        const prefs = safety.preferences;
        set({
          contacts: contactsFromRows(safety.contacts),
          profile: p
            ? {
                name: p.full_name,
                age: p.age,
                bloodType: p.blood_type,
                conditions: p.conditions,
                allergies: p.allergies,
                medications: p.medications,
              }
            : EMPTY_PROFILE,
          language:
            prefs && isLocaleCode(prefs.language) ? prefs.language : appStore.state.language,
          dispatchConsent: Boolean(prefs?.dispatch_consent),
          shareLocation: Boolean(prefs?.share_location),
          accountStatus: "ready",
        });
      } catch {
        if (active && my === generation) set({ accountStatus: "error" });
      }
    };
    void sync();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) return;
      queueMicrotask(() => {
        void sync();
        void router.invalidate();
      });
    });
    return () => {
      active = false;
      generation++;
      data.subscription.unsubscribe();
    };
  }, [read, router]);

  // Persist language, dispatch consent and location sharing to the account.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let previous = "";
    const unsubscribe = appStore.subscribe((s) => {
      if (!s.userId || s.accountStatus !== "ready") return;
      const key = JSON.stringify([s.language, s.dispatchConsent, s.shareLocation]);
      if (key === previous) return;
      previous = key;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void savePrefs({
          data: {
            language: s.language,
            dispatchConsent: s.dispatchConsent,
            shareLocation: s.shareLocation,
          },
        }).catch(() => {
          // Keep the local choice; the next change retries the account write.
        });
      }, 800);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe.unsubscribe();
    };
  }, [savePrefs]);

  return null;
}
