import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CareCalendar } from "@/components/CareCalendar";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import {
  createCareEvent,
  deleteCareEvent,
  listCareEvents,
  updateCareEvent,
} from "@/lib/schedule.functions";
import {
  dayHeading,
  gridRange,
  monthLabel,
  rangeLabelOf,
  sameDay,
  startOfMonth,
  type CareEvent,
  type CareEventInput,
} from "@/lib/schedule";

export const Route = createFileRoute("/schedule")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Care schedule · Lifeline" },
      {
        name: "description",
        content:
          "Plan check-ins, medication rounds and appointments in a private month calendar that only you can see and change.",
      },
      { property: "og:title", content: "Care schedule · Lifeline" },
      {
        property: "og:description",
        content: "A private month calendar for the care you have planned.",
      },
    ],
  }),
  component: SchedulePage,
});

function SchedulePage() {
  const userId = useApp((s) => s.userId);
  const load = useServerFn(listCareEvents);
  const create = useServerFn(createCareEvent);
  const update = useServerFn(updateCareEvent);
  const remove = useServerFn(deleteCareEvent);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CareEvent[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const now = useNow(30_000);

  useEffect(() => {
    if (!userId) {
      setEvents([]);
      setStatus("idle");
      return;
    }
    let active = true;
    const range = gridRange(month);
    setStatus("loading");
    setError("");
    load({
      data: { from: range.from.toISOString(), to: range.to.toISOString() },
    })
      .then((rows) => {
        if (!active) return;
        setEvents(rows);
        setStatus("ready");
      })
      .catch((cause) => {
        if (!active) return;
        setError(
          cause instanceof Error ? cause.message : "Your schedule could not be loaded. Try again.",
        );
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [load, month, reloadKey, userId]);

  const handleCreate = useCallback(
    async (input: CareEventInput) => {
      const created = await create({ data: input });
      setEvents((current) =>
        [...current.filter((event) => event.id !== created.id), created].sort(
          (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
        ),
      );
    },
    [create],
  );

  const handleUpdate = useCallback(
    async (id: string, input: CareEventInput) => {
      const saved = await update({ data: { id, ...input } });
      setEvents((current) =>
        current
          .map((event) => (event.id === saved.id ? saved : event))
          .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
      );
    },
    [update],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await remove({ data: { id } });
      setEvents((current) => current.filter((event) => event.id !== id));
    },
    [remove],
  );

  if (!userId) {
    return (
      <main id="main-content" className="mx-auto max-w-4xl px-4 pb-32 pt-6">
        <h1 className="font-display text-4xl font-extrabold">Care schedule</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          The care schedule is private. Sign in to plan check-ins, medication rounds and
          appointments, and only your own account can open or change it.
        </p>
        <Link to="/account" className="mt-6 inline-block">
          <Button className="min-h-12">Sign in or create an account</Button>
        </Link>
      </main>
    );
  }

  const viewingCurrentMonth = sameDay(month, startOfMonth(new Date(now)));
  const upcoming = viewingCurrentMonth
    ? events
        .filter((event) => Date.parse(event.endsAt) > now)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]
    : undefined;
  const startingSoon =
    upcoming != null && Date.parse(upcoming.startsAt) - now <= 30 * 60 * 1000;

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 pb-32 pt-6">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <h1 className="font-display text-4xl font-extrabold">Care schedule</h1>
        <p className="ms-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden="true" />
          Private to your account
        </p>
      </div>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Plan the check-ins, medication rounds and appointments you want to remember. Add an event on
        any day, then open it to change its time, colour or name.
      </p>

      {upcoming && (
        <section
          className="mt-4 rounded-lg border border-border bg-card p-4"
          aria-labelledby="cc-next-heading"
        >
          <h2 id="cc-next-heading" className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Next up
          </h2>
          <p className="mt-1 font-display text-lg font-bold">{upcoming.title}</p>
          <p className="text-sm text-muted-foreground">
            {dayHeading(new Date(upcoming.startsAt))} · {rangeLabelOf(upcoming)}
          </p>
          {startingSoon && (
            <p role="status" className="mt-1 text-sm font-semibold text-primary">
              Starting within the next 30 minutes.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            This reminder is shown only while the page is open. Lifeline does not run reminders in
            the background.
          </p>
        </section>
      )}

      <div className="mt-5">
        {status === "error" ? (
          <div role="alert" className="rounded-lg border border-border bg-card p-6">
            <p className="flex items-start gap-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden="true" />
              {error}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              Try again
            </Button>
          </div>
        ) : status === "ready" ? (
          <CareCalendar
            month={month}
            today={new Date(now)}
            events={events}
            canEdit
            onMonthChange={setMonth}
            onCreate={handleCreate}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <div className="rounded-lg border border-border bg-card p-6">
            <p role="status" className="text-sm text-muted-foreground">
              Loading your schedule for {monthLabel(month)}…
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 max-w-2xl text-xs text-muted-foreground">
        Times use this device&rsquo;s time zone. Two events on one day can never overlap.
      </p>
    </main>
  );
}
