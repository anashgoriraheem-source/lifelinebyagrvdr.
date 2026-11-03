import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Eye,
  Lightbulb,
  Pause,
  Phone,
  RotateCcw,
  ShieldAlert,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import type { PracticeScenario } from "@/data/practice";
import { practiceSourceById } from "@/data/practice";
import { Button } from "@/components/ui/button";
import type { PracticeAnswersSession } from "@/lib/practice";
import { safeChoiceCount } from "@/lib/practice";

interface Props {
  scenario: PracticeScenario;
  initialSession: PracticeAnswersSession | null;
  emergencyNumber: string;
  jurisdictionLabel: string;
  levelCompleted: boolean;
  nextTitle: string | null;
  onSessionChange: (session: PracticeAnswersSession | null) => void;
  onExit: () => void;
  onComplete: (scenario: PracticeScenario, safeChoices: number, total: number) => Promise<void>;
  onRepeat: () => void;
  onNext: () => void;
}

export function ScenarioPlayer({
  scenario,
  initialSession,
  emergencyNumber,
  jurisdictionLabel,
  levelCompleted,
  nextTitle,
  onSessionChange,
  onExit,
  onComplete,
  onRepeat,
  onNext,
}: Props) {
  const resumed = initialSession?.scenarioId === scenario.id ? initialSession : null;
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => resumed?.answers ?? scenario.decisions.map(() => null),
  );
  const [step, setStep] = useState(() => Math.min(resumed?.step ?? 0, scenario.decisions.length - 1));
  // A paused scenario resumes on the decision it stopped at. If that decision was
  // already answered, its explanation is shown again rather than silently losing it.
  const [chosen, setChosen] = useState<number | null>(() => {
    const answer = resumed ? resumed.answers[resumed.step] : null;
    return typeof answer === "number" ? answer : null;
  });
  const [hintShown, setHintShown] = useState(() => resumed?.hintShown ?? false);
  const [phase, setPhase] = useState<"playing" | "debrief">("playing");
  const [saving, setSaving] = useState(false);

  const decisions = scenario.decisions;
  const decision = decisions[step];
  const result = useMemo(() => safeChoiceCount(decisions, answers), [decisions, answers]);
  const option = chosen === null ? null : decision.options[chosen];

  useEffect(() => {
    if (phase === "playing") {
      onSessionChange({ scenarioId: scenario.id, answers, step, hintShown });
    }
    // onSessionChange is intentionally not a dependency: it is a stable writer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id, answers, step, hintShown, phase]);

  const beginDebrief = useCallback(
    async (finalAnswers: (number | null)[]) => {
      const counted = safeChoiceCount(decisions, finalAnswers);
      setPhase("debrief");
      onSessionChange(null);
      setSaving(true);
      try {
        await onComplete(scenario, counted.safe, counted.total);
      } catch {
        /* The debrief still shows; the page tells the learner if saving failed. */
      } finally {
        setSaving(false);
      }
    },
    [decisions, onComplete, onSessionChange, scenario],
  );

  const choose = (index: number) => {
    if (chosen !== null) return;
    const nextAnswers = [...answers];
    nextAnswers[step] = index;
    setAnswers(nextAnswers);
    setChosen(index);
  };

  const advance = () => {
    if (chosen === null) return;
    if (step < decisions.length - 1) {
      setStep(step + 1);
      setChosen(null);
      setHintShown(false);
      return;
    }
    void beginDebrief(answers);
  };

  const restart = () => {
    setAnswers(decisions.map(() => null));
    setStep(0);
    setChosen(null);
    setHintShown(false);
    setPhase("playing");
    onRepeat();
  };

  const sources = scenario.sources
    .map((id) => practiceSourceById(id))
    .filter((source): source is NonNullable<typeof source> => Boolean(source));

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/60 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
          <Stethoscope className="size-3.5" aria-hidden="true" />
          Practice simulation
        </span>
        <span className="text-sm text-muted-foreground">
          Level {scenario.level} · Scenario {scenario.index} of 10
        </span>
        <Button variant="ghost" className="ms-auto" onClick={onExit}>
          <Pause className="size-4" aria-hidden="true" />
          Pause and exit
        </Button>
      </div>

      <div className="mt-5 rounded-xl border border-warning/50 bg-warning-soft p-4 text-sm leading-relaxed">
        <p className="flex gap-2 font-semibold">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This is educational practice, not a real emergency.
        </p>
        <p className="mt-1 text-muted-foreground">
          Nothing you choose here calls anyone, sends a message, shares your location or starts an
          SOS. In a real emergency, call {emergencyNumber || "your local emergency number"} yourself.
        </p>
      </div>

      <article className="mt-6">
        <h1 className="text-2xl font-bold sm:text-3xl">{scenario.title}</h1>
        <p className="mt-3 leading-relaxed">{scenario.setting}</p>
        <dl className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Your role</dt>
            <dd className="mt-1 text-muted-foreground">{scenario.role}</dd>
          </div>
          <div>
            <dt className="font-semibold">Learning objective</dt>
            <dd className="mt-1 text-muted-foreground">{scenario.objective}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="flex items-center gap-1.5 font-semibold">
              <Eye className="size-4" aria-hidden="true" /> What you can observe
            </dt>
            <dd>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-muted-foreground">
                {scenario.sees.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </article>

      {phase === "playing" ? (
        <section
          className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5"
          aria-labelledby="decision-heading"
        >
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Decision {step + 1} of {decisions.length}
            </p>
            <div
              className="h-1.5 min-w-24 flex-1 rounded-full bg-secondary"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={decisions.length}
              aria-valuenow={step + 1}
              aria-label="Scenario progress"
            >
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${((step + 1) / decisions.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">No timer · take your time</span>
          </div>

          <h2 id="decision-heading" className="mt-4 text-lg font-semibold sm:text-xl">
            {decision.prompt}
          </h2>

          <div className="mt-4 grid gap-2">
            {decision.options.map((entry, index) => {
              const selected = chosen === index;
              const isCorrect = entry.correct;
              const reveal = chosen !== null;
              return (
                <button
                  key={entry.label}
                  type="button"
                  onClick={() => choose(index)}
                  disabled={reveal}
                  aria-pressed={selected}
                  className={[
                    "min-h-11 w-full rounded-lg border px-4 py-3 text-start text-sm leading-relaxed transition",
                    reveal && isCorrect
                      ? "border-success bg-success-soft text-foreground"
                      : reveal && selected
                        ? "border-critical bg-critical-soft text-foreground"
                        : selected
                          ? "border-primary bg-accent text-foreground"
                          : "border-border bg-background hover:border-primary/60 hover:bg-accent/40",
                    reveal && !isCorrect && !selected ? "opacity-70" : "",
                  ].join(" ")}
                >
                  <span className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-current text-[11px] font-semibold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{entry.label}</span>
                    {reveal && isCorrect ? (
                      <CheckCircle2 className="ms-auto mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          {chosen === null ? (
            <div className="mt-4">
              {!hintShown ? (
                <Button variant="outline" onClick={() => setHintShown(true)}>
                  <Lightbulb className="size-4" aria-hidden="true" />
                  Show a hint
                </Button>
              ) : (
                <p className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Hint: </span>
                  {decision.hint}
                </p>
              )}
            </div>
          ) : (
            <div
              className={`mt-4 rounded-lg border p-4 text-sm leading-relaxed ${
                option?.correct ? "border-success bg-success-soft" : "border-warning bg-warning-soft"
              }`}
              role="status"
              aria-live="polite"
            >
              <p className="flex items-center gap-2 font-semibold">
                {option?.correct ? (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                ) : (
                  <CircleAlert className="size-4" aria-hidden="true" />
                )}
                {option?.correct ? "That is a safe priority" : "That choice adds risk"}
              </p>
              <p className="mt-1 text-muted-foreground">{option?.why}</p>
              {!option?.correct ? (
                <p className="mt-2 text-muted-foreground">
                  Mistakes here are how the safe order becomes familiar. Read the explanation, then
                  continue — you can repeat this scenario at any time.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={advance}>
                  {step < decisions.length - 1 ? "Next decision" : "See the debrief"}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" onClick={restart}>
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Start again
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="mt-6 grid gap-5" aria-labelledby="debrief-heading">
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Debrief · {result.safe} of {result.total} safe priorities chosen
            </p>
            <h2 id="debrief-heading" className="mt-2 text-xl font-bold">
              Scenario complete
            </h2>
            <p className="mt-2 leading-relaxed">{scenario.debrief}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.safe === result.total
                ? "Every decision followed the safe priority. That is good practice — it is not a certificate or proof that you could perform these skills in person."
                : "This scenario is marked for review so you can come back to the decisions that added risk. Nothing here is a score against you."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldAlert className="size-5 text-primary" aria-hidden="true" />
              Safe priority order
            </h3>
            <ol className="mt-3 list-decimal space-y-2 ps-5 leading-relaxed">
              {scenario.safeSequence.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ol>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-critical/40 bg-critical-soft p-4">
              <h3 className="font-semibold">Common unsafe actions</h3>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed">
                {scenario.avoid.map((entry) => (
                  <li key={entry.action}>
                    <span className="font-medium">{entry.action}.</span>{" "}
                    <span className="text-muted-foreground">{entry.why}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <Phone className="size-4" aria-hidden="true" /> Contact emergency services
              </h3>
              <p className="mt-2 text-sm leading-relaxed">
                <span className="font-medium">
                  {scenario.emergency.urgency === "now"
                    ? "Call now."
                    : scenario.emergency.urgency === "if-worse"
                      ? "Call if it worsens."
                      : "Call if you are unsure."}
                </span>{" "}
                {scenario.emergency.note}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Report: {scenario.report.join("; ")}. Give the exact location, what happened, how
                many people are hurt, and stay on the line for instructions.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Local number for {jurisdictionLabel}:{" "}
                <span className="font-semibold text-foreground">{emergencyNumber || "not set"}</span>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <BookOpen className="size-5" aria-hidden="true" />
              Sources and review status
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {sources.map((source) => (
                <li key={source.id}>
                  <a
                    className="text-primary underline underline-offset-4"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {source.title}
                  </a>{" "}
                  <span className="text-muted-foreground">
                    — {source.publisher}
                    {source.published ? `, ${source.published}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm leading-relaxed">
              <span className="font-semibold">Awaiting clinical review.</span> Guidance version{" "}
              {scenario.guidanceVersion}. Review date: not reviewed. This scenario has not been
              checked by a clinician or a recognised first-aid educator, so it is not certified
              training and must not be read as medical advice.
            </p>
          </div>

          {levelCompleted ? (
            <div className="rounded-xl border border-primary/60 bg-accent p-4 sm:p-5">
              <h3 className="text-lg font-semibold">Level {scenario.level} practised</h3>
              <p className="mt-2 text-sm leading-relaxed">
                You have now completed every scenario in this level. Completing app practice is not
                certification or proof of competence — these are decision exercises. Book hands-on
                training with a recognised provider to practise CPR, AED use, choking response and
                bleeding control on a manikin with an instructor.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={restart}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Repeat scenario
            </Button>
            {nextTitle ? (
              <Button variant="outline" onClick={onNext}>
                Next: {nextTitle}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            ) : null}
            <Button variant="ghost" onClick={onExit}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to level
            </Button>
            {saving ? (
              <span className="self-center text-xs text-muted-foreground">Saving progress…</span>
            ) : null}
          </div>

          <div className="rounded-xl border-2 border-critical/60 bg-card p-4">
            <h3 className="font-semibold">This is not the simulation</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              If someone is in danger now, leave practice mode. Calling opens your phone's dialler —
              Lifeline cannot place the call for you.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-critical px-4 py-2 text-sm font-semibold text-destructive-foreground"
                href={`tel:${emergencyNumber.replace(/[^\d+]/g, "") || "112"}`}
              >
                <Phone className="size-4" aria-hidden="true" />
                Call {emergencyNumber || "112"}
              </a>
              <Link
                to="/guide"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold"
              >
                <BookOpen className="size-4" aria-hidden="true" />
                Open the real field guide
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
