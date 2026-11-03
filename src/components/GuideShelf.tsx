import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { GUIDE_TOPICS, type GuideTopic } from "@/data/fieldGuide";
import { shortTitle } from "@/components/GuideHandbook";

/** Spine proportions and widths, as supplied by the shelf mockup. */
const H = [
  0.84, 0.92, 0.76, 0.97, 0.81, 0.88, 0.72, 0.94, 0.86, 0.79, 0.95, 0.74, 0.9, 0.83, 0.78, 0.99,
  0.85, 0.73, 0.91, 0.8,
];
const W = [44, 34, 54, 38, 60, 32, 46, 40, 56, 36, 50, 42, 30, 58, 44, 38, 52, 34, 48, 40];

/** Muted ink tones for the spines; light ones switch to dark type. */
const SPINES = [
  "#4a2b26",
  "#3d4238",
  "#333b46",
  "#4c3a2a",
  "#2f3a36",
  "#43313a",
  "#3a3830",
  "#2e3540",
  "#4a3b2c",
  "#3d2f2f",
  "#8a6a3a",
  "#c9bda6",
  "#6b5a44",
  "#5a3f3a",
  "#39443f",
  "#44403a",
  "#3b3340",
  "#51402e",
  "#7b6242",
  "#bdb09a",
];
const ANG = [4, 8, 13];
const LIFT = 10;
const GROW = 0.08;
const POP_GAP = 18;
const POP_W = 300;
const PUSH = 18;

/** Stable spine tone and type colour for a topic. */
export const spineTone = (index: number) => {
  const hex = SPINES[((index % SPINES.length) + SPINES.length) % SPINES.length];
  const n = parseInt(hex.slice(1), 16);
  const luma = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return { color: hex, ink: luma > 0.6 ? "#16181b" : "#f4efe4" };
};

interface Spine {
  topic: GuideTopic;
  index: number;
  x: number;
  w: number;
  h: number;
  lean: number;
  gap: number;
}

/**
 * Lay the shelf out the way the mockup does: upright spines until only a small
 * leaning group still fits, then three books that rest against each other. The
 * geometry is computed in JS because a leaning book needs the exact top corner
 * of the book it leans on.
 */
function buildShelf(width: number, height: number, pool: number): Spine[] {
  if (!width || !height) return [];
  const scale = Math.max(0.75, Math.min(1.25, height / 300));
  const leanGroup = (x0: number, i0: number, hp: number) => {
    let xp = x0;
    let wp = 0;
    let tp = 0;
    const out: { i: number; x: number; w: number; deg: number }[] = [];
    for (let k = 0; k < 3; k++) {
      const i = i0 + k;
      const h = H[i % H.length] * height;
      const w = Math.round(W[i % W.length] * scale);
      const t = (ANG[k] * Math.PI) / 180;
      const cx = xp + wp * Math.cos(tp) - hp * Math.sin(tp);
      const cy = wp * Math.sin(tp) + hp * Math.cos(tp);
      let x: number;
      if (cy / Math.cos(t) <= h) {
        x = cx + cy * Math.tan(t);
      } else {
        const y = h * Math.cos(t);
        const sN = (y - wp * Math.sin(tp)) / Math.cos(tp);
        x = xp + wp * Math.cos(tp) - sN * Math.sin(tp) + h * Math.sin(t);
      }
      x = Math.max(x, xp + wp * Math.cos(tp));
      out.push({ i, x, w, deg: ANG[k] });
      xp = x;
      wp = w;
      tp = t;
      hp = h;
    }
    return { out, end: xp + wp * Math.cos(tp) };
  };

  const spines: Spine[] = [];
  let x = 0;
  let i = 0;
  let lastH = 0;
  for (; i < 60; i++) {
    const w = Math.round(W[i % W.length] * scale);
    const h = H[i % H.length] * height;
    if (spines.length > 1 && leanGroup(x + w, i + 1, h).end > width - 2) break;
    spines.push({ topic: GUIDE_TOPICS[i % pool], index: i, x, w, h, lean: 0, gap: 0 });
    x += w;
    lastH = h;
  }

  let edge = x;
  for (const group of leanGroup(x, i, lastH).out) {
    spines.push({
      topic: GUIDE_TOPICS[group.i % pool],
      index: group.i,
      x: group.x,
      w: group.w,
      h: H[group.i % H.length] * height,
      lean: group.deg,
      gap: group.x - edge,
    });
    edge = group.x + group.w;
  }
  return spines;
}

/**
 * The new-arrivals shelf, rebuilt over the app's own first-aid topics: every
 * spine is a guide that opens on `/assistant`, and the card above a lifted book
 * repeats only what the guide itself says.
 */
export function GuideShelf() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<number | null>(null);
  const [popHeight, setPopHeight] = useState(170);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => setSize({ width: scene.clientWidth, height: scene.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    measure();
    return () => observer.disconnect();
  }, []);

  const spines = useMemo(() => buildShelf(size.width, size.height, GUIDE_TOPICS.length), [size]);

  useLayoutEffect(() => {
    if (hovered === null || !popRef.current) return;
    setPopHeight(popRef.current.offsetHeight);
  }, [hovered]);

  const active = hovered === null ? null : (spines.find((s) => s.index === hovered) ?? null);
  const activeTopic = active?.topic ?? null;
  const activeTone = active ? spineTone(active.index) : null;
  // A leaning book that stands up swings its top to the right, so the books
  // after the lifted one need that much extra room.
  const leanExtra = active?.lean
    ? active.h * Math.sin((active.lean * Math.PI) / 180) +
      active.w * (1 - Math.cos((active.lean * Math.PI) / 180))
    : 0;

  const popStyle = active
    ? {
        "--px": `${Math.max(0, Math.min(size.width - POP_W, active.x + active.w / 2 - POP_W / 2))}px`,
        "--py": `${Math.max(-popHeight - 40, size.height - active.h - LIFT - active.h * GROW - popHeight - POP_GAP)}px`,
        "--cv": spineTone(active.index).color,
      }
    : undefined;

  return (
    <figure className="fg-shelf">
      <div className="fg-scene" ref={sceneRef}>
        <div className="fg-spines" onPointerLeave={() => setHovered(null)}>
          {spines.map((spine) => {
            const tone = spineTone(spine.index);
            const push =
              hovered === null || hovered === spine.index
                ? 0
                : spine.index < hovered
                  ? -PUSH
                  : Math.round(PUSH + leanExtra);
            return (
              <Link
                key={`${spine.index}-${spine.topic.id}`}
                to="/assistant"
                search={{ guide: spine.topic.id }}
                className={`fg-spine${spine.lean ? " lean" : ""}`}
                title={spine.topic.title}
                onPointerEnter={() => setHovered(spine.index)}
                onFocus={() => setHovered(spine.index)}
                style={
                  {
                    "--c": tone.color,
                    "--on": tone.ink,
                    "--h": `${(spine.h / Math.max(size.height, 1)) * 100}%`,
                    "--w": `${spine.w}px`,
                    "--lean": spine.lean ? `-${spine.lean}deg` : undefined,
                    "--lean-gap": `${spine.gap.toFixed(1)}px`,
                    "--push": `${push}px`,
                  } as React.CSSProperties
                }
              >
                {!spine.lean && spine.index % 5 === 2 ? <span className="mk" /> : null}
                <span className="st">{shortTitle(spine.topic.title)}</span>
                <span className="sa">{spine.topic.steps} steps</span>
              </Link>
            );
          })}
        </div>
        <div
          className={`fg-pop${activeTopic ? " on" : ""}`}
          ref={popRef}
          style={popStyle as React.CSSProperties}
          aria-live="polite"
        >
          {activeTopic && activeTone ? (
            <>
              <span
                className="fg-pop-cv"
                style={{ "--cv": activeTone.color } as React.CSSProperties}
              >
                <span>Field guide</span>
                <b>{shortTitle(activeTopic.title)}</b>
              </span>
              <span className="fg-pop-tx">
                <span className="fg-pop-k">
                  {activeTopic.call === "always" ? "Call the emergency number first" : "Guide"}
                </span>
                <em>{activeTopic.title}</em>
                <span className="fg-pop-a">{activeTopic.steps} steps, written to read aloud</span>
                <span className="fg-pop-row">
                  <span>Opens the guide</span>
                  <Link to="/assistant" search={{ guide: activeTopic.id }} className="fg-pop-add">
                    Read it
                  </Link>
                </span>
              </span>
            </>
          ) : null}
        </div>
      </div>
      <div className="fg-plank" aria-hidden="true" />
      <figcaption>
        <span>The guide shelf</span>
        <em>Hover a spine to preview a topic</em>
        <small>{GUIDE_TOPICS.length} topics</small>
      </figcaption>
    </figure>
  );
}
