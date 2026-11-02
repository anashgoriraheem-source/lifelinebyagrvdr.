import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Download, LogOut, Save, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { persistedSettingsSchema } from "@/lib/settings";

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
      setFeedback(error instanceof Error ? error.message : "Something went wrong. Try again.");
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
      setFeedback("Password updated.");
    } else if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
        redirectTo: `${window.location.origin}/account`,
      });
      if (error) throw error;
      setFeedback("If this email has an account, a recovery link will arrive shortly.");
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email: loginEmail,
        password,
        options: { emailRedirectTo: `${window.location.origin}/account` },
      });
      if (error) throw error;
      setPassword("");
      setFeedback("Check your email and confirm your account before signing in.");
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
      : { exportedAt, profile, contacts, timeline: log };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "lifeline-private-data.json";
    a.click();
    URL.revokeObjectURL(url);
    setFeedback(
      userId ? "Your account data was exported." : "Your data on this device was exported.",
    );
  };
  const input = "mt-2 min-h-11 w-full rounded-md border border-border bg-card px-3 py-2";
  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 pb-32 pt-8">
      <div className="flex items-center gap-3">
        <UserRound className="size-7 text-primary" />
        <h1 className="font-display text-3xl font-bold">Safety account</h1>
      </div>
      <p className="mt-2 text-muted-foreground">
        Optional, private medical details and trusted contacts.
      </p>
      {(!userId || recovery) && (
        <section className="mt-8 max-w-md border-t border-border py-6">
          <h2 className="text-xl font-bold">
            {recovery
              ? "Choose a new password"
              : mode === "signup"
                ? "Create account"
                : mode === "reset"
                  ? "Recover account"
                  : "Sign in"}
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
                Email
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
                Password
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
                ? "Please wait…"
                : recovery
                  ? "Update password"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send recovery email"
                      : "Sign in with email"}
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
                    Sign in with {provider === "google" ? "Google" : "Lovable"}
                  </Button>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                >
                  {mode === "signup" ? "Already have an account?" : "Create an account"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setMode(mode === "reset" ? "signin" : "reset")}
                >
                  {mode === "reset" ? "Back to sign in" : "Forgot password?"}
                </Button>
              </div>
            </>
          )}
          <p className="mt-4 text-sm text-muted-foreground">
            Phone sign-in is not available until an SMS provider is configured. Emergency calls
            remain available without signing in.
          </p>
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
              Sign out
            </Button>
          </section>
          {status === "loading" && (
            <p role="status" className="mt-4">
              Loading private data…
            </p>
          )}
          {status === "error" && (
            <div role="alert" className="mt-4 text-critical">
              Your saved data could not be loaded.
              <Button
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    const data = await read();
                    const p = data.profile;
                    set({
                      contacts: data.contacts,
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
                Retry
              </Button>
            </div>
          )}
          <section className="border-b border-border py-6">
            <h2 className="text-xl font-bold">Import this device’s contacts</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Replaces account contacts only after confirmation. Your previous device-local contacts
              are not uploaded automatically.
            </p>
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
                    throw new Error("No saved device contacts found.");
                  if (!confirm("Replace your account contacts with this device’s saved contacts?"))
                    return;
                  const contacts = parsed.data.contacts;
                  await saveContacts({
                    data: contacts.map((c) => ({ ...c, phone: c.phone.replace(/[^\d+]/g, "") })),
                  });
                  set({ contacts });
                  setFeedback("Device contacts imported to your private account.");
                })
              }
            >
              Import saved device contacts
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
                  setFeedback("Private profile saved to your account.");
                } else {
                  setFeedback(
                    "Profile saved in this browser only. Sign in to keep it private across devices.",
                  );
                }
              });
            }}
          >
            <h2 className="text-xl font-bold">Personal safety profile</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {userId
                ? "Only you can access this profile in your private account. Including it in an emergency message requires a separate choice."
                : "Saved in this browser only — nothing is backed up or synced until you sign in. Including it in an emergency message requires a separate choice."}
            </p>
            <fieldset
              disabled={busy || (!!userId && status !== "ready")}
              className="mt-4 grid gap-4 sm:grid-cols-2"
            >
              <label>
                Name
                <input
                  className={input}
                  maxLength={120}
                  value={profile.name}
                  onChange={(e) => set({ profile: { ...profile, name: e.target.value } })}
                />
              </label>
              <label>
                Age
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
                Blood type
                <select
                  className={input}
                  value={profile.bloodType}
                  onChange={(e) => set({ profile: { ...profile, bloodType: e.target.value } })}
                >
                  {["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => (
                    <option key={v} value={v}>
                      {v || "Not provided"}
                    </option>
                  ))}
                </select>
              </label>
              {(["conditions", "allergies", "medications"] as const).map((key) => (
                <label key={key} className="capitalize">
                  {key}
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
                    Separate entries with commas.
                  </span>
                </label>
              ))}
              <Button type="submit">
                <Save className="size-4" />
                {userId ? "Save private profile" : "Save to this browser"}
              </Button>
            </fieldset>
          </form>
          <section className="py-6">
            <h2 className="text-xl font-bold">Privacy centre</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Signed-out contacts and profile stay in this browser. Signed-in profiles and
              explicitly saved contacts stay in your private cloud account. Location is held in
              memory, not uploaded. Your timeline lasts for this session. Shared texts leave
              Lifeline and follow the recipient’s privacy practices.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="outline" disabled={busy} onClick={() => void run(exportData)}>
                <Download className="size-4" />
                {userId ? "Export my account data" : "Export current data"}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    if (
                      !confirm(
                        "Delete your contacts, profile and saved incidents? This cannot be undone.",
                      )
                    )
                      return;
                    if (userId) await clear();
                    localStorage.removeItem("lifeline:settings:v1");
                    set({
                      contacts: [],
                      profile: empty,
                      log: [],
                      incident: null,
                      location: { status: "idle", fix: null, error: null },
                    });
                    setFeedback("Safety data deleted.");
                  })
                }
              >
                <Trash2 className="size-4" />
                Delete safety data
              </Button>
              {userId && (
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (!confirm("Permanently delete your account and all safety data?")) return;
                      await remove();
                      await supabase.auth.signOut();
                      setFeedback("Account deleted.");
                    })
                  }
                >
                  Delete account
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
