import { useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  addMonths,
  dayKey,
  eventsOnDay,
  gridDays,
  monthLabel,
  rangeLabelOf,
  sameDay,
  startOfMonth,
  weekdayShort,
  WEEKDAYS,
  type CareEvent,
  type CareEventInput,
} from "@/lib/schedule";
import { CareEventDialog, type DialogContext } from "./CareEventDialog";
import "../styles/care-calendar.css";

interface Props {
  month: Date;
  today: Date;
  events: CareEvent[];
  canEdit: boolean;
  onMonthChange: (month: Date) => void;
  onCreate: (input: CareEventInput) => Promise<void>;
  onUpdate: (id: string, input: CareEventInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

/**
 * The month calendar. Seven equal columns with events at the top of each day and
 * the date pinned bottom-left; under 860px the same days become a day-by-day
 * list. Only a signed-in owner gets the "+" and the edit dialog.
 */
export function CareCalendar({
  month,
  today,
  events,
  canEdit,
  onMonthChange,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [context, setContext] = useState<DialogContext | null>(null);
  const days = gridDays(month);
  const todayPosition = days.findIndex((day) => sameDay(day, today));
  const todayColumn = todayPosition >= 0 ? todayPosition % 7 : -1;

  const openAdd = (day: Date) => {
    if (!canEdit) return;
    setContext({ mode: "add", day });
  };

  const save = async (input: CareEventInput, id?: string) => {
    if (id) await onUpdate(id, input);
    else await onCreate(input);
  };

  return (
    <section className="cc-section" aria-label="Care schedule calendar">
      <div className="cc-stage">
        <div className="cc-toolbar">
          <h2 className="cc-month" aria-live="polite">
            {monthLabel(month)}
          </h2>
          <div className="cc-toolbar-nav">
            <button
              type="button"
              className="cc-tool"
              aria-label="Previous month"
              onClick={() => onMonthChange(addMonths(month, -1))}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cc-tool cc-tool--text"
              onClick={() => onMonthChange(startOfMonth(new Date()))}
            >
              Today
            </button>
            <button
              type="button"
              className="cc-tool"
              aria-label="Next month"
              onClick={() => onMonthChange(addMonths(month, 1))}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="cc-card">
          <div className="cc-head" aria-hidden="true">
            {WEEKDAYS.map((name, column) => (
              <p
                key={name}
                className={
                  column === todayColumn ? "cc-head-cell cc-head-cell--today" : "cc-head-cell"
                }
                style={{ "--cc-c": column } as CSSProperties}
              >
                {name}
              </p>
            ))}
          </div>

          <div className="cc-grid">
            {days.map((day, index) => {
              const dayEvents = eventsOnDay(events, day);
              const outside = day.getMonth() !== month.getMonth();
              const isToday = sameDay(day, today);
              const classes = [
                "cc-day",
                outside ? "cc-day--out" : "",
                dayEvents.length === 0 ? "cc-day--empty" : "",
                isToday ? "cc-day--today" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div
                  key={dayKey(day)}
                  className={classes}
                  style={
                    {
                      "--cc-r": Math.floor(index / 7),
                      "--cc-c": index % 7,
                    } as CSSProperties
                  }
                  onClick={(event) => {
                    if (!canEdit) return;
                    if ((event.target as HTMLElement).closest(".cc-ev, .cc-add")) return;
                    openAdd(day);
                  }}
                >
                  <p className="cc-meta">
                    <span className="cc-meta-day">{weekdayShort(day)}</span>
                    <span className="cc-date">{String(day.getDate()).padStart(2, "0")}</span>
                  </p>

                  <ul className="cc-events">
                    {dayEvents.map((item, position) => {
                      const shape =
                        position > 0
                          ? " cc-ev--inline"
                          : dayEvents.length === 1
                            ? " cc-ev--tall"
                            : "";
                      return (
                        <li key={item.id} className="cc-item">
                          <button
                            type="button"
                            className={`cc-ev cc-ev--${item.color}${shape}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (canEdit) setContext({ mode: "edit", day, event: item });
                            }}
                          >
                            <span className="cc-ev-title">{item.title}</span>
                            <span className="cc-ev-time">{rangeLabelOf(item)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {canEdit && (
                    <button
                      type="button"
                      className="cc-add"
                      aria-label={`Add event on ${weekdayShort(day)} ${day.getDate()}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openAdd(day);
                      }}
                    >
                      <Plus size={14} aria-hidden="true" />
                      <span className="cc-add-label">Add event</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <CareEventDialog
        context={context}
        events={events}
        onClose={() => setContext(null)}
        onSave={save}
        onDelete={onDelete}
      />
    </section>
  );
}
