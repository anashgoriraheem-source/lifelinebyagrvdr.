import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PREPAREDNESS_TOPICS } from "@/data/preparedness";
import { HEALTH_SOURCES } from "@/data/health-sources";

export const Route = createFileRoute("/preparedness")({ component: PreparednessPage });

const STORAGE_KEY = "lifeline:preparedness:v1";

function PreparednessPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const [saveNote, setSaveNote] = useState("Loading your checklist…");

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        const valid = Object.fromEntries(
          Object.entries(saved).filter(
            ([key, value]) =>
              typeof value === "boolean" &&
              PREPAREDNESS_TOPICS.some((topic) =>
                topic.checklist.some((item) => `${topic.id}:${item}` === key),
              ),
          ),
        ) as Record<string, boolean>;
        setChecked(valid);
      }
    } catch {
      setSaveNote("This browser could not read the saved checklist.");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
      setSaveNote("Checklist progress is saved on this device.");
    } catch {
      setSaveNote("Checklist changes may not persist in this browser.");
    }
  }, [checked, ready]);

  const total = PREPAREDNESS_TOPICS.reduce((sum, topic) => sum + topic.checklist.length, 0);
  const completed = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);

  const reset = () => {
    setChecked({});
  };

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
        Learning mode
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
        Emergency preparedness centre
      </h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">
        Make a practical plan for your household, travel and local hazards. Your checklist is stored
        only in this browser.
      </p>

      <section
        className="mt-6 rounded-xl border border-primary/30 bg-card p-4 sm:p-5"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClipboardCheck className="size-6 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Your preparation checklist</h2>
              <p className="text-sm text-muted-foreground">
                {completed} of {total} actions checked · {saveNote}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={reset} disabled={completed === 0}>
            Reset checklist
          </Button>
        </div>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Preparedness checklist progress"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
          />
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2" aria-label="Preparedness topics">
        {PREPAREDNESS_TOPICS.map((topic) => (
          <article key={topic.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h2 className="text-xl font-bold">{topic.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{topic.summary}</p>
            <ul className="mt-4 space-y-3">
              {topic.checklist.map((item) => {
                const key = `${topic.id}:${item}`;
                const isChecked = Boolean(checked[key]);
                return (
                  <li key={key}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                      <input
                        className="mt-1 size-4 accent-primary"
                        type="checkbox"
                        checked={isChecked}
                        onChange={(event) =>
                          setChecked((current) => ({ ...current, [key]: event.target.checked }))
                        }
                      />
                      <span className="min-w-0 flex-1 text-sm leading-relaxed">{item}</span>
                      {isChecked && (
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-primary"
                          aria-label="Completed"
                        />
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </section>

      <section
        className="mt-8 rounded-xl border border-border bg-card p-4 sm:p-5"
        aria-labelledby="preparedness-sources"
      >
        <h2 id="preparedness-sources" className="text-xl font-bold">
          Further guidance
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Follow current instructions from local emergency services and public authorities.
          Lifeline’s checklist is a planning aid and has not been clinically or jurisdictionally
          reviewed.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {HEALTH_SOURCES.filter((source) =>
            ["ifrc-first-aid", "indian-red-cross", "mohfw-health"].includes(source.id),
          ).map((source) => (
            <li key={source.id} className="rounded-lg border border-border p-3">
              <a
                className="font-medium text-primary underline"
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.title}
              </a>
              <p className="mt-1 text-xs text-muted-foreground">
                {source.publisher} · {source.jurisdiction}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to="/practice">Go to Practice Centre</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/guide">Browse First Aid Academy</Link>
        </Button>
      </div>
    </main>
  );
}
