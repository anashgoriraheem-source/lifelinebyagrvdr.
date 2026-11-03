import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Trash2, X } from "lucide-react";
import {
  CARE_COLORS,
  defaultEnd,
  dayHeading,
  durationLabel,
  endOptions,
  eventsOnDay,
  defaultStart,
  freeStarts,
  isoAt,
  minutesOfDay,
  timeLabel,
  type CareColor,
  type CareEvent,
  type CareEventInput,
} from "@/lib/schedule";

export type DialogContext = {
  mode: "add" | "edit";
  day: Date;
  event?: CareEvent;
};

interface Props {
  context: DialogContext | null;
  events: CareEvent[];
  onClose: () => void;
  onSave: (input: CareEventInput, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const COLOR_LABEL: Record<CareColor, string> = {
  yellow: "Gold",
  peach: "Amber",
  lilac: "Violet",
  sage: "Sage",
  stone: "Slate",
};

interface PickerProps {
  label: string;
  value: number;
  options: { value: number; duration?: number }[];
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onPick: (value: number) => void;
  onEscape: () => void;
}

/** One time dropdown: a button plus a five-row listbox, as in the design. */
function TimePicker({
  label,
  value,
  options,
  open,
  disabled,
  onToggle,
  onPick,
  onEscape,
}: PickerProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useMemo(
    () => `cc-time-${label.toLowerCase().replace(/\s+/g, "-")}-${Math.random().toString(36).slice(2, 7)}`,
    [label],
  );

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const selected =
      list.querySelector<HTMLElement>('[aria-selected="true"]') ??
      list.querySelector<HTMLElement>(".cc-opt");
    if (!selected) return;
    list.scrollTop = selected.offsetTop - (list.clientHeight - selected.offsetHeight) / 2;
    selected.focus({ preventScroll: true });
  }, [open]);

  const move = (delta: number) => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>(".cc-opt"));
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = items[Math.min(items.length - 1, Math.max(0, index + delta))];
    next?.focus();
  };

  return (
    <div className="cc-time">
      <button
        type="button"
        className="cc-time-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) onToggle();
          }
        }}
      >
        <span>{timeLabel(value)}</span>
        <ChevronDown className="cc-time-chev" size={12} aria-hidden="true" />
      </button>
      <ul
        ref={listRef}
        id={listId}
        className="cc-time-list"
        role="listbox"
        aria-label={label}
        hidden={!open}
        onClick={(event) => {
          const option = (event.target as HTMLElement).closest<HTMLElement>(".cc-opt");
          if (option) onPick(Number(option.dataset.value));
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            move(event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            const option = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(".cc-opt");
            if (option) onPick(Number(option.dataset.value));
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onEscape();
          } else if (event.key === "Tab") {
            onEscape();
          }
        }}
      >
        {options.map((option) => (
          <li
            key={option.value}
            className="cc-opt"
            role="option"
            tabIndex={-1}
            aria-selected={option.value === value}
            data-value={option.value}
          >
            <span>{timeLabel(option.value)}</span>
            {option.duration != null && (
              <span className="cc-opt-dur">({durationLabel(option.duration)})</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The event dialog. It is a real <dialog> opened with showModal(), so it sits in
 * the browser's top layer next to the clicked day instead of being clipped by
 * the calendar card.
 */
export function CareEventDialog({ context, events, onClose, onSave, onDelete }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [color, setColor] = useState<CareColor>("stone");
  const [start, setStart] = useState(9 * 60);
  const [end, setEnd] = useState(10 * 60);
  const [picker, setPicker] = useState<"start" | "end" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const editId = context?.mode === "edit" ? context.event?.id : undefined;
  const dayEvents = useMemo(
    () => (context ? eventsOnDay(events, context.day) : []),
    [context, events],
  );
  const startOptions = useMemo(
    () => freeStarts(dayEvents, editId).map((value) => ({ value })),
    [dayEvents, editId],
  );
  const endChoices = useMemo(
    () => endOptions(start, dayEvents, editId),
    [dayEvents, editId, start],
  );
  const dayFull = context?.mode === "add" && startOptions.length === 0;

  const reset = useCallback(() => {
    if (!context) return;
    const editing = context.mode === "edit" ? context.event : undefined;
    const nextStart = editing
      ? minutesOfDay(new Date(editing.startsAt))
      : (defaultStart(dayEvents) ?? 9 * 60);
    setTitle(editing?.title ?? "");
    setColor(editing?.color ?? "stone");
    setStart(nextStart);
    setEnd(
      editing
        ? minutesOfDay(new Date(editing.endsAt))
        : defaultEnd(nextStart, dayEvents, undefined),
    );
    setPicker(null);
    setConfirmDelete(false);
    setSaving(false);
    setError("");
  }, [context, dayEvents]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (context) {
      reset();
      if (!dialog.open) dialog.showModal();
      titleRef.current?.focus();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [context, reset]);

  const chooseStart = (value: number) => {
    setStart(value);
    setEnd(defaultEnd(value, dayEvents, editId));
    setPicker(null);
  };

  const save = async () => {
    if (!context || saving) return;
    const trimmed = title.trim();
    if (!trimmed) {
      titleRef.current?.focus();
      return;
    }
    if (dayFull) return;
    setSaving(true);
    setError("");
    try {
      await onSave(
        {
          title: trimmed,
          startsAt: isoAt(context.day, start),
          endsAt: isoAt(context.day, end),
          color,
        },
        editId,
      );
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The event was not saved. Try again.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editId || saving) return;
    setSaving(true);
    setError("");
    try {
      await onDelete(editId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The event was not deleted. Try again.");
      setSaving(false);
    }
  };

  const dayLabel = context ? dayHeading(context.day) : "";

  return (
    <dialog
      ref={dialogRef}
      className="cc-dialog"
      aria-labelledby="cc-dialog-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
          return;
        }
        if (!(event.target as HTMLElement).closest(".cc-time")) setPicker(null);
      }}
    >
      <div className="cc-form">
        <div className="cc-dlg-head">
          <p className="cc-dlg-kicker" id="cc-dialog-title">
            {context?.mode === "edit" ? "Edit event" : "New event"}
          </p>
          <button type="button" className="cc-icon-btn" aria-label="Close" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="cc-title-row">
          <span
            className="cc-chip"
            aria-hidden="true"
            style={{ background: `var(--cc-${color})` }}
          />
          <label className="cc-title-field">
            <span className="cc-sr">Event name</span>
            <input
              ref={titleRef}
              className="cc-title-input"
              name="title"
              type="text"
              placeholder="Add title"
              maxLength={80}
              autoComplete="off"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void save();
                }
              }}
            />
          </label>
        </div>

        <div className="cc-when">
          <p className={dayFull ? "cc-date-line cc-date-line--warn" : "cc-date-line"}>
            {dayLabel}
            {dayFull ? " — no free time left this day" : ""}
          </p>
          <div className="cc-time-row">
            <TimePicker
              label="Starts"
              value={start}
              options={startOptions}
              open={picker === "start"}
              onToggle={() => setPicker(picker === "start" ? null : "start")}
              onPick={chooseStart}
              onEscape={() => setPicker(null)}
            />
            <span aria-hidden="true">–</span>
            <TimePicker
              label="Ends"
              value={end}
              options={endChoices}
              open={picker === "end"}
              onToggle={() => setPicker(picker === "end" ? null : "end")}
              onPick={(value) => {
                setEnd(value);
                setPicker(null);
              }}
              onEscape={() => setPicker(null)}
            />
          </div>
        </div>

        <fieldset className="cc-colors">
          <legend className="cc-sr">Card colour</legend>
          {CARE_COLORS.map((option) => (
            <label key={option} className={`cc-swatch cc-swatch--${option}`}>
              <input
                type="radio"
                name="color"
                value={option}
                checked={color === option}
                onChange={() => setColor(option)}
              />
              <span className="cc-sr">{COLOR_LABEL[option]}</span>
            </label>
          ))}
        </fieldset>

        {error && (
          <p role="alert" className="cc-dlg-note">
            {error}
          </p>
        )}

        <div className="cc-dlg-foot" hidden={confirmDelete}>
          {editId && (
            <button
              type="button"
              className="cc-btn cc-btn--delete"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </button>
          )}
          <span className="cc-spacer" />
          <button
            type="button"
            className="cc-btn cc-btn--primary"
            disabled={saving || dayFull || !title.trim()}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="cc-dlg-foot cc-dlg-foot--confirm" hidden={!confirmDelete}>
          <p className="cc-confirm-text">Delete this event?</p>
          <span className="cc-spacer" />
          <button type="button" className="cc-btn cc-btn--ghost" onClick={() => setConfirmDelete(false)}>
            Cancel
          </button>
          <button type="button" className="cc-btn cc-btn--danger" onClick={() => void remove()}>
            Delete
          </button>
        </div>
      </div>
    </dialog>
  );
}
