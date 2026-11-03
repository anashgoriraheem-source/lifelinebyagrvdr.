import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Download, LogOut, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguagePicker } from "@/components/LanguagePicker";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useApp } from "@/hooks/useApp";
import { appStore, set } from "@/lib/store";
import {
  clearSafetyAccount,
  deleteSafetyAccount,
  exportSafetyAccount,
  readSafetyAccount,
  saveSafetyContacts,
  saveSafetyProfile,
} from "@/lib/account.functions";
import { DevicePrivacy } from "@/components/DevicePrivacy";
import { persistedSettingsSchema } from "@/lib/settings";
import { contactsFromRows } from "@/lib/accountContacts";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Private safety account · Lifeline" },
      {
        name: "description",
        content: "Sign in, manage your private medical profile and control your Lifeline data.",
      },
      { property: "og:title", content: "Private safety account · Lifeline" },
      {
        property: "og:description",
        content: "Manage private safety information and account permissions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Account,
});

function Account() {
  const { t } = useI18n();
  const userId = useApp((s) => s.userId);
  const email = useApp((s) => s.userEmail);
  const profile = useApp((s) => s.profile);
  const status = useApp((s) => s.accountStatus);
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [loginEmail, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const save = useServerFn(saveSafetyProfile);
  const saveContacts = useServerFn(saveSafetyContacts);
  const clear = useServerFn(clearSafetyAccount);
  const remove = useServerFn(deleteSafetyAccount);
  const read = useServerFn(readSafetyAccount);
  const exportAccount = useServerFn(exportSafetyAccount);
  useEffect(() => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
      return;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("type") === "recovery") setRecovery(true);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setFeedback("");
    try {
      await task();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };
  const auth = async () => {
    if (recovery) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setRecovery(false);
      setPassword("");
      setFeedback(t("account.passwordUpdated"));
    } else if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${window.location.origin}/account`,
      });
      if (error) throw error;
      setFeedback(t("account.recoverySent"));
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: loginEmail,
        password,
        options: { emailRedirectTo: `${window.location.origin}/account` },
      });
      if (error) throw error;
      setPassword("");
      setFeedback(t("account.checkEmail"));
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) throw error;
      setPassword("");
    }
  };
  const empty = {
    name: "",
    age: null,
    bloodType: "",
    conditions: [],
    allergies: [],
    medications: [],
  };
  const exportData = async () => {
    const { profile, contacts, log } = appStore.state;
    const exportedAt = new Date().toISOString();
    const payload = userId
      ? { exportedAt, timeline: log, account: await exportAccount() }
      : {
          exportedAt,
          profile,
          contacts,
          timeline: log,
          language: appStore.state.language,
          dispatchConsent: appStore.state.dispatchConsent,
          shareLocation: appStore.state.shareLocation,
        };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "lifeline-private-data.json";
    a.click();
    URL.revokeObjectURL(url);
    setFeedback(userId ? t("account.exportDoneAccount") : t("account.exportDoneLocal"));
  };
  const input = "mt-2 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2";
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 pb-32 pt-8">
      <div className="flex items-center gap-3">
        <UserRound className="size-7 text-primary" />
        <h1 className="font-display text-3xl font-bold">{t("account.title")}</h1>
      </div>
      <p className="mt-2 text-muted-foreground">{t("account.subtitle")}</p>
      <DevicePrivacy />
      {userId && (
        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-bold">Care schedule</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Plan check-ins, medication rounds and appointments in a private month calendar.
          </p>
          <Link
            to="/schedule"
            className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open my care schedule
          </Link>
        </section>
      )}
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-bold">{t("account.langHeading")}</h2>
        <LanguagePicker variant="full" className="mt-3" />
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t("account.langNote")}
        </p>
        <Link
          to="/contacts"
          className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("account.manageContacts")}
        </Link>
      </section>
      {(!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) && (
        <p role="status" className="mt-5 rounded-lg border border-border p-4">
          {t("release.cloudBlocked")}
        </p>
      )}
      {Boolean(
        import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ) &&
        (!userId || recovery) && (
          <section className="mt-8 max-w-md border-t border-border py-6">
            <h2 className="text-xl font-bold">
              {recovery
                ? t("account.passwordTitle")
                : mode === "signup"
                  ? t("account.createTitle")
                  : mode === "reset"
                    ? t("account.recoverTitle")
                    : t("account.signInTitle")}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(auth);
              }}
              className="mt-4 space-y-4"
            >
              {!recovery && (
                <label className="block text-sm">
                  {t("account.email")}
                  <input
                    className={input}
                    type="email"
                    autoComplete="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              {(recovery || mode !== "reset") && (
                <label className="block text-sm">
                  {t("account.password")}
                  <input
                    className={input}
                    type="password"
                    minLength={8}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
              )}
              <Button disabled={busy} type="submit" className="w-full">
                {busy
                  ? t("account.wait")
                  : recovery
                    ? t("account.updatePassword")
                    : mode === "signup"
                      ? t("account.createAccount")
                      : mode === "reset"
                        ? t("account.sendRecovery")
                        : t("account.signInEmail")}
              </Button>
            </form>
            {!recovery && (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["google", "lovable"] as const).map((provider) => (
                    <Button
                      variant="outline"
                      disabled={busy}
                      key={provider}
                      onClick={() =>
                        void run(async () => {
                          const result = await lovable.auth.signInWithOAuth(provider, {
                            redirect_uri: `${window.location.origin}/account`,
                          });
                          if (result.error) throw result.error;
                        })
                      }
                    >
                      {t("account.signInWith", {
                        provider: provider === "google" ? "Google" : "Lovable",
                      })}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  >
                    {mode === "signup" ? t("account.haveAccount") : t("account.noAccount")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setMode(mode === "reset" ? "signin" : "reset")}
                  >
                    {mode === "reset" ? t("account.backToSignIn") : t("account.forgotPassword")}
                  </Button>
                </div>
              </>
            )}
            <p className="mt-4 text-sm text-muted-foreground">{t("account.phoneNote")}</p>
          </section>
        )}
      {userId && !recovery && (
        <>
          <section className="mt-8 flex flex-wrap items-center gap-3 border-y border-border py-4">
            <ShieldCheck className="size-5 text-success" />
            <span className="mr-auto break-all">{email}</span>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const { error } = await supabase.auth.signOut();
                  if (error) throw error;
                })
              }
            >
              <LogOut className="size-4" />
              {t("account.signOut")}
            </Button>
          </section>
          {status === "loading" && (
            <p role="status" className="mt-4">
              {t("account.loadingPrivate")}
            </p>
          )}
          {status === "error" && (
            <div role="alert" className="mt-4 text-critical">
              {t("account.loadError")}
              <Button
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    const data = await read();
                    const p = data.profile;
                    set({
                      contacts: contactsFromRows(data.contacts),
                      profile: p
                        ? {
                            name: p.full_name,
                            age: p.age,
                            bloodType: p.blood_type,
                            conditions: p.conditions,
                            allergies: p.allergies,
                            medications: p.medications,
                          }
                        : empty,
                      accountStatus: "ready",
                    });
                  })
                }
              >
                {t("common.retry")}
              </Button>
            </div>
          )}
          <section className="border-b border-border py-6">
            <h2 className="text-xl font-bold">{t("account.importHeading")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("account.importBody")}</p>
            <Button
              className="mt-4"
              variant="outline"
              disabled={busy || status !== "ready"}
              onClick={() =>
                void run(async () => {
                  const parsed = persistedSettingsSchema.safeParse(
                    JSON.parse(localStorage.getItem("lifeline:settings:v1") || "{}"),
                  );
                  if (!parsed.success || !parsed.data.contacts?.length)
                    throw new Error(t("account.importNone"));
                  if (!confirm(t("account.importConfirm"))) return;
                  const contacts = parsed.data.contacts;
                  await saveContacts({
                    data: contacts.map((c) => ({ ...c, phone: c.phone.replace(/[^\d+]/g, "") })),
                  });
                  set({ contacts });
                  setFeedback(t("account.importDone"));
                })
              }
            >
              {t("account.importButton")}
            </Button>
          </section>
        </>
      )}
      {!recovery && (
        <>
          <form
            className="border-b border-border py-6"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (userId) {
                  await save({ data: profile });
                  setFeedback(t("account.profileSavedAccount"));
                } else {
                  setFeedback(t("account.profileSavedLocal"));
                }
              });
            }}
          >
            <h2 className="text-xl font-bold">{t("account.profileHeading")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {userId ? t("account.profileNoteAccount") : t("account.profileNoteLocal")}
            </p>
            <fieldset
              disabled={busy || (!!userId && status !== "ready")}
              className="mt-4 grid gap-4 sm:grid-cols-2"
            >
              <label>
                {t("account.fieldName")}
                <input
                  className={input}
                  maxLength={120}
                  value={profile.name}
                  onChange={(e) => set({ profile: { ...profile, name: e.target.value } })}
                />
              </label>
              <label>
                {t("account.fieldAge")}
                <input
                  className={input}
                  type="number"
                  min={0}
                  max={130}
                  value={profile.age ?? ""}
                  onChange={(e) =>
                    set({
                      profile: { ...profile, age: e.target.value ? Number(e.target.value) : null },
                    })
                  }
                />
              </label>
              <label>
                {t("account.fieldBlood")}
                <select
                  className={input}
                  value={profile.bloodType}
                  onChange={(e) => set({ profile: { ...profile, bloodType: e.target.value } })}
                >
                  {["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => (
                    <option key={v} value={v}>
                      {v || t("account.bloodNotProvided")}
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  ["conditions", t("account.fieldConditions")],
                  ["allergies", t("account.fieldAllergies")],
                  ["medications", t("account.fieldMedications")],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    className={input}
                    value={profile[key].join(",")}
                    onChange={(e) =>
                      set({
                        profile: {
                          ...profile,
                          [key]: e.target.value ? e.target.value.split(",") : [],
                        },
                      })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("account.separateWithCommas")}
                  </span>
                </label>
              ))}
              <Button type="submit">
                <Save className="size-4" />
                {userId ? t("account.savePrivate") : t("account.saveLocal")}
              </Button>
            </fieldset>
          </form>
          <section className="py-6">
            <h2 className="text-xl font-bold">{t("account.privacyHeading")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("account.privacyBody")}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="outline" disabled={busy} onClick={() => void run(exportData)}>
                <Download className="size-4" />
                {userId ? t("account.exportAccount") : t("account.exportLocal")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (!confirm(t("account.deleteDataConfirm"))) return;
                    if (userId) await clear();
                    localStorage.removeItem("lifeline:settings:v1");
                    set({
                      contacts: [],
                      profile: empty,
                      log: [],
                      incident: null,
                      location: { status: "idle", fix: null, error: null },
                    });
                    setFeedback(t("account.dataDeleted"));
                  })
                }
              >
                <Trash2 className="size-4" />
                {t("account.deleteData")}
              </Button>
              {userId && (
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (!confirm(t("account.deleteAccountConfirm"))) return;
                      await remove();
                      await supabase.auth.signOut();
                      setFeedback(t("account.accountDeleted"));
                    })
                  }
                >
                  {t("account.deleteAccount")}
                </Button>
              )}
            </div>
          </section>
        </>
      )}
      {feedback && (
        <p role="status" className="my-4 break-words rounded-md border border-border p-4">
          {feedback}
        </p>
      )}
    </main>
  );
}
