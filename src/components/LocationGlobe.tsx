import { useEffect, useRef, useState } from "react";
import { Minus, Pause, Plus, RotateCw } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { landAt } from "@/lib/landGrid";
import { formatCoordinates, placeAge } from "@/lib/places";
import "../styles/location-globe.css";

/**
 * Location globe — the "Map Infographic 3" board, wired to Lifeline's own data.
 *
 * The five pins are not a demo city list: each one is a location fix this tab
 * actually recorded (see `src/lib/places.ts`), newest first, and the legend and
 * the pins are one control — hovering either half highlights both and holds the
 * spin, clicking either half only turns that place to the viewer. Nothing stays
 * selected, because hovered is the single source of truth.
 *
 * The sphere is drawn from LAND_RLE in `src/lib/landGrid.ts`, a run-length
 * encoded 2° land/sea grid of the real world (Natural Earth 110m, public
 * domain) shared with the session board. It is the only source of the
 * continents and there is no image fallback; the grid verifies its own totals.
 */

const RAD = Math.PI / 180;
/** Zoom is multiplicative, the way map zoom behaves. Past ≈1.37 the sphere
 * exactly fills the board and bleeds off its sides on purpose — that is the
 * zoomed-into-the-map look, clipped by .lg-globe-layer. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_FACTOR = 1.18;
/** Radians per MILLISECOND — about 35 s per turn on any refresh rate. */
const SPIN_RATE = 0.00018;
/** How far apart two pins must sit before the globe stops zooming in. */
const PIN_GAP_PX = 44;

/** Evenly spread points over the sphere (Fibonacci lattice), keeping the ones on land. */
function buildLandPoints(samples: number) {
  const pts: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const a = golden * i;
    const x = Math.cos(a) * ring;
    const z = Math.sin(a) * ring;
    if (landAt(Math.asin(y) / RAD, Math.atan2(x, z) / RAD)) pts.push(x, y, z);
  }
  return new Float32Array(pts);
}

type Vec = [number, number, number];

const cityVec = (lat: number, lon: number): Vec => {
  const la = lat * RAD;
  const lo = lon * RAD;
  const cl = Math.cos(la);
  return [cl * Math.sin(lo), Math.sin(la), cl * Math.cos(lo)];
};

/** Yaw by phi about the poles, then pitch by theta. z > 0 is the near face. */
function project(
  x: number,
  y: number,
  z: number,
  cp: number,
  sp: number,
  ct: number,
  st: number,
): Vec {
  const x1 = x * cp + z * sp;
  const z1 = -x * sp + z * cp;
  const y2 = y * ct - z1 * st;
  const z2 = y * st + z1 * ct;
  return [x1, y2, z2];
}

export function LocationGlobe() {
  const places = useApp((s) => s.places);
  const location = useApp((s) => s.location);
  const { locale } = useI18n();
  const now = useNow(30_000);
  const rootRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<{ setSpin(v: boolean): void } | null>(null);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const [spinning, setSpinning] = useState(!reduceMotion);

  // The engine owns the canvas and geometry; it asks React for nothing but the
  // spin state, so a re-render never tears down the frame loop.
  useEffect(() => {
    const found = rootRef.current;
    if (!found) return;
    const root: HTMLDivElement = found;
    // Non-null aliases: the engine's own functions are declarated, not closures,
    // so TypeScript will not carry the guards into them.
    const stage = root.querySelector<HTMLElement>("[data-lg-stage]");
    const layer = root.querySelector<HTMLElement>("[data-lg-layer]");
    const canvas = root.querySelector<HTMLCanvasElement>("[data-lg-canvas]");
    if (!stage || !layer || !canvas) return;
    const stageEl: HTMLElement = stage;
    const layerEl: HTMLElement = layer;
    const canvasEl: HTMLCanvasElement = canvas;
    const context = canvasEl.getContext("2d");
    if (!context) return;
    const ctx: CanvasRenderingContext2D = context;

    const cleanups: (() => void)[] = [];
    const on = (
      target: EventTarget,
      type: string,
      fn: EventListener,
      opts?: boolean | AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn, opts);
      cleanups.push(() => target.removeEventListener(type, fn, opts));
    };

    // Canvas only accepts parsed colours; resolve the theme tokens through a
    // probe so oklch() works everywhere and a miss falls back to a hex value.
    const probe = document.createElement("canvas").getContext("2d");
    const resolveColor = (value: string, fallback: string) => {
      if (!probe || !value) return fallback;
      probe.fillStyle = "#000000";
      probe.fillStyle = value;
      const out = probe.fillStyle as string;
      return out.toLowerCase() === "#000000" ? fallback : out;
    };
    const css = getComputedStyle(root);
    const COL = {
      sea: resolveColor(css.getPropertyValue("--lg-sea").trim(), "#202127"),
      edge: resolveColor(css.getPropertyValue("--lg-sea-edge").trim(), "#17181d"),
      land: resolveColor(css.getPropertyValue("--lg-land").trim(), "#d8bb76"),
      grid: resolveColor(css.getPropertyValue("--lg-grid").trim(), "#33343b"),
    };

    const pinEls = () => Array.from(root.querySelectorAll<HTMLElement>(".lg-pin"));
    const cityEls = () => Array.from(root.querySelectorAll<HTMLElement>("[data-lg-city]"));

    const home = () => {
      const els = pinEls();
      if (!els.length) return { phi: 0.62, theta: 0.3 };
      let lat = 0;
      let lon = 0;
      for (const el of els) {
        lat += Number(el.dataset.lat);
        lon += Number(el.dataset.lng);
      }
      return {
        phi: -(lon / els.length) * RAD,
        theta: Math.max(-0.6, Math.min(0.6, (lat / els.length) * RAD)),
      };
    };

    const start = home();
    let phi = start.phi;
    let theta = start.theta;
    let zoom = 1;
    let zoomTarget = 1;
    let spin = true;
    let w = 0;
    let h = 0;
    let cx = 0;
    let cy = 0;
    let baseR = 0;
    let curR = 0;
    let points = new Float32Array(0);
    let vel = 0;
    let flying: { phi: number; theta: number } | null = null;
    let frame = 0;
    let dragging = false;
    let lastFrameT = 0;
    let zoomInit = false;
    let hovered: string | null = null;
    let touchHold = 0;
    const canHover = window.matchMedia?.("(hover: hover)").matches ?? true;
    const vectors = new WeakMap<Element, { key: string; v: Vec }>();

    /* ---------------- geometry + drawing ---------------- */
    function resize() {
      const lr = layerEl.getBoundingClientRect();
      const sr = stageEl.getBoundingClientRect();
      if (!lr.width || !sr.width) return false;
      // Canvas backing size follows its CSS size at device pixel ratio, or the
      // globe renders blurry.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = lr.width;
      h = lr.height;
      canvasEl.width = Math.round(w * dpr);
      canvasEl.height = Math.round(h * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      // The globe is centred on the SPACER and sized from it, so at rest it sits
      // exactly where the board puts it.
      cx = sr.left - lr.left + sr.width / 2;
      cy = sr.top - lr.top + sr.height / 2;
      const nextR = Math.min(sr.width, sr.height) / 2;
      if (Math.abs(nextR - baseR) > 1 || !points.length) {
        baseR = nextR;
        const samples = Math.max(6000, Math.min(20000, Math.round(baseR * baseR * 0.32)));
        points = buildLandPoints(samples);
      }
      return true;
    }

    /** Starts zoomed in when every place would otherwise stack on one spot. */
    function initialZoom() {
      const els = pinEls();
      if (els.length < 2 || baseR <= 0) return 1;
      let minChord = Infinity;
      for (let i = 0; i < els.length; i++) {
        const a = cityVec(Number(els[i].dataset.lat), Number(els[i].dataset.lng));
        for (let j = i + 1; j < els.length; j++) {
          const b = cityVec(Number(els[j].dataset.lat), Number(els[j].dataset.lng));
          minChord = Math.min(minChord, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
        }
      }
      if (!Number.isFinite(minChord) || minChord <= 0) return 1;
      const needed = PIN_GAP_PX / (baseR * minChord);
      return Math.min(ZOOM_MAX, Math.max(1, Math.round(needed * 1000) / 1000));
    }

    function drawGraticule(R: number, cp: number, sp: number, ct: number, st: number) {
      ctx.strokeStyle = COL.grid;
      ctx.lineWidth = Math.max(0.5, R * 0.0035);
      for (let lat = -80; lat <= 80; lat += 20) {
        const cl = Math.cos(lat * RAD);
        const sl = Math.sin(lat * RAD);
        ctx.beginPath();
        let started = false;
        for (let lon = 0; lon <= 360; lon += 4) {
          const lr = lon * RAD;
          const p = project(cl * Math.sin(lr), sl, cl * Math.cos(lr), cp, sp, ct, st);
          if (p[2] <= 0) {
            started = false;
            continue;
          }
          const sx = cx + R * p[0];
          const sy = cy - R * p[1];
          if (started) ctx.lineTo(sx, sy);
          else {
            ctx.moveTo(sx, sy);
            started = true;
          }
        }
        ctx.stroke();
      }
      for (let lon = 0; lon < 360; lon += 20) {
        const lr2 = lon * RAD;
        const sn = Math.sin(lr2);
        const cs = Math.cos(lr2);
        ctx.beginPath();
        let started = false;
        for (let lat = -88; lat <= 88; lat += 4) {
          const c2 = Math.cos(lat * RAD);
          const p = project(c2 * sn, Math.sin(lat * RAD), c2 * cs, cp, sp, ct, st);
          if (p[2] <= 0) {
            started = false;
            continue;
          }
          const sx = cx + R * p[0];
          const sy = cy - R * p[1];
          if (started) ctx.lineTo(sx, sy);
          else {
            ctx.moveTo(sx, sy);
            started = true;
          }
        }
        ctx.stroke();
      }
    }

    function draw() {
      if (!w) return;
      const R = baseR * zoom;
      curR = R;
      const cp = Math.cos(phi);
      const sp = Math.sin(phi);
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      ctx.clearRect(0, 0, w, h);

      // The sphere's face, lit from the upper left.
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R);
      g.addColorStop(0, COL.sea);
      g.addColorStop(0.62, COL.sea);
      g.addColorStop(1, COL.edge);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();

      drawGraticule(R, cp, sp, ct, st);

      // Land dots in three depth bands, so the sphere reads as round. Collecting
      // first keeps fillStyle changes to three per frame instead of one per dot.
      const d = Math.max(1, Math.round(R * 0.0105 * 2) / 2);
      const near: number[] = [];
      const mid: number[] = [];
      const far: number[] = [];
      for (let i = 0; i < points.length; i += 3) {
        const x1 = points[i] * cp + points[i + 2] * sp;
        const z1 = -points[i] * sp + points[i + 2] * cp;
        const y2 = points[i + 1] * ct - z1 * st;
        const z2 = points[i + 1] * st + z1 * ct;
        if (z2 <= 0.02) continue;
        const sx = cx + R * x1 - d / 2;
        const sy = cy - R * y2 - d / 2;
        if (z2 > 0.6) near.push(sx, sy);
        else if (z2 > 0.28) mid.push(sx, sy);
        else far.push(sx, sy);
      }
      const bands: [number[], number][] = [
        [near, 1],
        [mid, 0.82],
        [far, 0.55],
      ];
      for (const [arr, alpha] of bands) {
        if (!arr.length) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = COL.land;
        for (let k = 0; k < arr.length; k += 2) ctx.fillRect(arr[k], arr[k + 1], d, d);
      }
      ctx.globalAlpha = 1;

      placePins(R, cp, sp, ct, st);
      layerEl.setAttribute("data-lg-ready", "");
    }

    function placePins(R: number, cp: number, sp: number, ct: number, st: number) {
      const pinW = R * 2 * 0.07003; // the board's pin, 35.7px on a 510px globe
      for (const el of pinEls()) {
        const key = `${el.dataset.lat},${el.dataset.lng}`;
        let cached = vectors.get(el);
        if (!cached || cached.key !== key) {
          cached = { key, v: cityVec(Number(el.dataset.lat), Number(el.dataset.lng)) };
          vectors.set(el, cached);
        }
        const p = project(cached.v[0], cached.v[1], cached.v[2], cp, sp, ct, st);
        if (p[2] <= 0.05) {
          el.setAttribute("data-lg-behind", "");
          continue;
        }
        el.removeAttribute("data-lg-behind");
        el.style.setProperty("--lg-x", `${(cx + R * p[0]).toFixed(1)}px`);
        el.style.setProperty("--lg-y", `${(cy - R * p[1]).toFixed(1)}px`);
        el.style.setProperty("--lg-depth", (0.72 + 0.28 * p[2]).toFixed(3));
        el.style.setProperty("--lg-pin-w", `${pinW.toFixed(1)}px`);
        // Fade out over the last sliver before the limb; by then it is almost
        // transparent, so nothing is ever sliced in half by the clip.
        el.style.setProperty("--lg-fade", Math.min(1, (p[2] - 0.05) / 0.2).toFixed(3));
      }
    }

    /* ---------------- the frame loop ----------------
       Runs only while something moves, then stops. The spin pauses while someone
       is ON a place (hover or keyboard focus) or dragging, so a name never drifts
       away mid-read. Nothing stays selected. */
    const spinning = () => spin && !hovered && !dragging && !flying;
    const zooming = () => Math.abs(zoomTarget - zoom) > 0.0004;
    const needsFrame = () =>
      spinning() || flying !== null || zooming() || Math.abs(vel) > 0.00012 || dragging;

    function tick(nowMs?: number) {
      frame = 0;
      const t = nowMs ?? window.performance?.now?.() ?? Date.now();
      // Measured in elapsed milliseconds so the motion runs at one speed on every
      // display. Clamped at both ends: a backwards clock would tip the poles.
      const ms = lastFrameT ? Math.max(0, Math.min(50, t - lastFrameT)) : 16.7;
      lastFrameT = t;
      const step = ms / 16.7;
      if (flying) {
        const dphi = flying.phi - phi;
        const dth = flying.theta - theta;
        if (Math.abs(dphi) < 0.002 && Math.abs(dth) < 0.002) {
          phi = flying.phi;
          theta = flying.theta;
          flying = null;
        } else {
          const k = Math.max(0, Math.min(1, 1 - Math.pow(0.88, step)));
          phi += dphi * k;
          theta = Math.max(-0.62, Math.min(0.62, theta + dth * k));
        }
      }
      if (zooming()) {
        zoom += (zoomTarget - zoom) * Math.max(0, Math.min(1, 1 - Math.pow(0.86, step)));
      } else {
        zoom = zoomTarget;
      }
      if (!flying && !dragging) {
        if (spinning()) phi += SPIN_RATE * ms;
        if (Math.abs(vel) > 0.00012) {
          phi += vel * step;
          vel *= Math.pow(0.945, step);
        } else vel = 0;
      }
      draw();
      if (needsFrame()) frame = requestAnimationFrame(tick);
      else lastFrameT = 0;
    }

    function kick() {
      if (!frame) frame = requestAnimationFrame(tick);
    }

    /* ---------------- zoom ---------------- */
    function applyZoom() {
      for (const b of Array.from(root.querySelectorAll<HTMLButtonElement>("[data-lg-zoom]"))) {
        b.disabled =
          b.dataset.lgZoom === "in"
            ? zoomTarget >= ZOOM_MAX - 0.001
            : zoomTarget <= ZOOM_MIN + 0.001;
      }
      draw();
    }

    /* ---------------- pin ↔ legend highlight ---------------- */
    function highlight(city: string | null) {
      for (const el of cityEls()) {
        el.classList.toggle("is-active", !!city && el.dataset.lgCity === city);
      }
    }

    // Turn the globe until the chosen place faces the viewer.
    function flyTo(el: HTMLElement) {
      const lat = Number(el.dataset.lat);
      const lng = Number(el.dataset.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      let target = -lng * RAD;
      // shortest way round, so it never takes the long way home
      while (target - phi > Math.PI) target -= Math.PI * 2;
      while (target - phi < -Math.PI) target += Math.PI * 2;
      flying = { phi: target, theta: Math.max(-0.45, Math.min(0.45, lat * RAD)) };
      vel = 0;
      kick();
    }

    function hold(el: HTMLElement | null) {
      window.clearTimeout(touchHold);
      hovered = el?.dataset.lgCity ?? null;
      highlight(hovered);
      kick();
    }

    const target = (event: Event, attr: string) => {
      const node = event.target as Element | null;
      const el = node?.closest?.(`[${attr}]`) as HTMLElement | null;
      return el && root.contains(el) ? el : null;
    };

    /* ---------------- wiring ----------------
       Delegated, so a re-render that replaces the pin and legend nodes cannot
       leave the engine listening to detached elements. */
    on(root, "pointerover", (event) => {
      const el = target(event as PointerEvent, "data-lg-city");
      if (!el) return;
      const rel = (event as PointerEvent).relatedTarget as Node | null;
      if (rel && el.contains(rel)) return;
      hold(el);
    });
    on(root, "pointerout", (event) => {
      const el = target(event as PointerEvent, "data-lg-city");
      if (!el) return;
      const rel = (event as PointerEvent).relatedTarget as Node | null;
      if (rel && el.contains(rel)) return;
      hold(null);
    });
    on(root, "focusin", (event) => {
      const el = target(event, "data-lg-city");
      if (!el) return;
      hold(el);
      flyTo(el);
    });
    on(root, "focusout", () => hold(null));

    let swallowClick = false;
    on(root, "click", (event) => {
      const zoomBtn = target(event, "data-lg-zoom");
      if (zoomBtn) {
        const dir = zoomBtn.dataset.lgZoom;
        zoomTarget *= dir === "in" ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
        zoomTarget = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoomTarget * 1000) / 1000));
        applyZoom();
        kick();
        return;
      }
      const city = target(event, "data-lg-city");
      if (!city || swallowClick) return;
      flyTo(city);
      // A touch screen has no hover, so a tap is the only way to read a name.
      // Show it, then let go on its own — a click never leaves anything selected.
      if (!canHover) {
        window.clearTimeout(touchHold);
        hovered = city.dataset.lgCity ?? null;
        highlight(hovered);
        touchHold = window.setTimeout(() => hold(null), 2000);
      }
    });

    /* ---------------- drag to spin ---------------- */
    let down: { x: number; y: number } | null = null;
    let moved = false;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;

    on(layerEl, "pointerdown", (event) => {
      const e = event as PointerEvent;
      if (e.button !== undefined && e.button !== 0) return;
      // The layer covers the whole board, so only a press ON the sphere starts a
      // spin — the bare margins beside it are not the globe.
      const lr = layerEl.getBoundingClientRect();
      const dx0 = e.clientX - lr.left - cx;
      const dy0 = e.clientY - lr.top - cy;
      if (dx0 * dx0 + dy0 * dy0 > curR * curR) return;
      down = { x: e.clientX, y: e.clientY };
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp || Date.now();
      moved = false;
      vel = 0;
      flying = null;
      // a drag that ended off the stage leaves this armed with no click to spend
      // it on — clear it so the next real click always lands
      swallowClick = false;
    });
    on(
      window,
      "pointermove",
      (event) => {
        const e = event as PointerEvent;
        if (!down) return;
        if (!moved) {
          if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) < 4) return;
          moved = true;
          dragging = true;
          layerEl.setAttribute("data-lg-dragging", "");
        }
        const R = Math.max(1, baseR * zoom);
        const stepX = (e.clientX - lastX) / (R * 0.95);
        const stepY = (e.clientY - lastY) / (R * 1.9);
        phi += stepX;
        // clamped, so a hard upward drag can never flip the globe over a pole
        theta = Math.max(-0.62, Math.min(0.62, theta + stepY));
        const stamp = e.timeStamp || Date.now();
        vel = Math.max(-0.09, Math.min(0.09, (stepX / Math.max(1, stamp - lastT)) * 14));
        lastX = e.clientX;
        lastY = e.clientY;
        lastT = stamp;
        kick();
      },
      { passive: true },
    );
    on(
      window,
      "pointerup",
      () => {
        if (!down) return;
        down = null;
        if (dragging) {
          dragging = false;
          layerEl.removeAttribute("data-lg-dragging");
          swallowClick = true;
          kick();
        }
      },
      { passive: true },
    );
    // A spin that passed over a pin must not also select it.
    on(
      layer,
      "click",
      (event) => {
        if (!swallowClick) return;
        swallowClick = false;
        event.stopPropagation();
        event.preventDefault();
      },
      true,
    );

    /* ---------------- start ---------------- */
    if (resize()) {
      if (!zoomInit) {
        zoomInit = true;
        zoom = zoomTarget = initialZoom();
      }
      applyZoom();
      kick();
    }
    const ro = new ResizeObserver(() => {
      if (resize()) applyZoom();
    });
    ro.observe(layer);
    ro.observe(stage);
    cleanups.push(() => ro.disconnect());

    // Safety net for a frozen or hidden mount: if the entrance never ran, the
    // pins would stay invisible. Snap them to their resting state.
    const net = window.setTimeout(() => {
      const last = root.querySelector<HTMLElement>(".lg-pin .lg-pin-drop");
      if (last && getComputedStyle(last).opacity === "0") root.classList.add("lg-no-entrance");
    }, 2000);
    cleanups.push(() => window.clearTimeout(net));

    function setSpin(value: boolean) {
      spin = value;
      kick();
    }
    engineRef.current = { setSpin };

    return () => {
      cleanups.forEach((f) => f());
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(touchHold);
      engineRef.current = null;
    };
  }, []);

  // Keep the engine's spin state in step with the button React renders.
  useEffect(() => {
    engineRef.current?.setSpin(spinning);
  }, [spinning]);

  const canHover =
    typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches !== false;

  const labels = places.map((place) => ({
    place,
    age: placeAge(now - place.at, locale),
    coords: formatCoordinates(place.lat, place.lng),
  }));

  return (
    <section ref={rootRef} className="lg-section" aria-labelledby="lg-title">
      <div className="lg-inner">
        <header className="lg-head">
          <h2 className="lg-title" id="lg-title">
            {locale === "hi" ? "ये टैब जहाँ रहा" : "Places recorded in this tab"}
          </h2>
          <p className="lg-sub">
            {locale === "hi"
              ? `इस टैब में मिले स्थान · ${canHover ? "नाम पर रुकें" : "नाम दबाएँ"}, ग्लोब पर वह जगह दिखेगी`
              : `Location fixes this tab received · ${
                  canHover ? "hover a name" : "tap a name"
                } to turn the globe to it`}
          </p>
        </header>

        <div className="lg-controls">
          <button className="lg-btn" type="button" data-lg-zoom="in" aria-label="Zoom in">
            <Plus aria-hidden="true" strokeWidth={2} />
          </button>
          <button className="lg-btn" type="button" data-lg-zoom="out" aria-label="Zoom out">
            <Minus aria-hidden="true" strokeWidth={2} />
          </button>
          <button
            className="lg-btn lg-btn-turn"
            type="button"
            data-lg-turn=""
            aria-pressed={spinning}
            aria-label={spinning ? "Pause the spinning globe" : "Spin the globe"}
            onClick={() => setSpinning((v) => !v)}
          >
            {/* Both icons live in the button; CSS picks one off aria-pressed, so
                what is drawn and what is announced can never disagree. */}
            <RotateCw className="lg-icon-rotate" aria-hidden="true" strokeWidth={1.8} />
            <Pause className="lg-icon-pause" aria-hidden="true" strokeWidth={1.8} />
          </button>
        </div>

        {/* The canvas covers the WHOLE board, so a zoomed-in globe grows behind
            the title and the legend instead of being cropped. */}
        <div className="lg-globe-layer" data-lg-layer="">
          <canvas
            className="lg-globe"
            data-lg-canvas=""
            role="img"
            aria-label={`A globe with ${places.length} recorded ${
              places.length === 1 ? "place" : "places"
            }. Drag to spin.`}
          />

          {labels.map(({ place, age, coords }, i) => (
            <button
              key={place.id}
              className={`lg-pin lg-pin--p${i}`}
              type="button"
              data-lg-city={place.id}
              data-lat={place.lat}
              data-lng={place.lng}
              aria-label={`${age} — ${coords}, ±${Math.round(place.accuracy)} m`}
            >
              <span className="lg-pin-drop">
                <span className="lg-pin-body">
                  <svg
                    className="lg-pin-shape"
                    viewBox="0 0 35.714 58.8231"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      className="lg-pin-fill"
                      d="M35.714 17.6774C35.714 27.4404 17.857 58.8231 17.857 58.8231C17.857 58.8231 0 27.4404 0 17.6774C0 7.91444 7.99485 0 17.857 0C27.7192 0 35.714 7.91444 35.714 17.6774Z"
                    />
                    <path
                      className="lg-pin-star"
                      d="M17.5843 8.89766L19.3618 13.0848L23.7437 11.8638L21.5782 15.8642L25.2649 18.5288L20.7872 19.3299L21.0025 23.8737L17.5843 20.8724L14.1662 23.8737L14.3815 19.3299L9.90376 18.5288L13.5904 15.8642L11.425 11.8638L15.8069 13.0848L17.5843 8.89766Z"
                    />
                  </svg>
                  <span className="lg-pin-label" aria-hidden="true">
                    {age}
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Empty on purpose: holds the board's square open and is what the
            engine measures for the globe's centre and resting radius. */}
        <div className="lg-stage" data-lg-stage="" />

        <ul className="lg-legend">
          {labels.length === 0 && (
            <li>
              <p className="lg-empty">
                {location.status === "requesting"
                  ? locale === "hi"
                    ? "स्थान की अनुमति का इंतज़ार है…"
                    : "Waiting for location permission…"
                  : locale === "hi"
                    ? "अभी कोई स्थान दर्ज नहीं हुआ। ऊपर नक्शे में स्थान की अनुमति देने पर इस टैब को मिला हर स्थान यहाँ पिन बन जाएगा।"
                    : "No place recorded yet. Allow location in the map above and each spot this tab receives gets a pin here."}
              </p>
            </li>
          )}
          {labels.map(({ place, age, coords }, i) => (
            <li key={place.id}>
              <button
                className={`lg-key lg-key--p${i}`}
                type="button"
                data-lg-city={place.id}
                data-lat={place.lat}
                data-lng={place.lng}
                aria-label={`${age} — ${coords}`}
              >
                <span className="lg-star" aria-hidden="true">
                  <svg viewBox="0 0 19.3477 17.8147" preserveAspectRatio="none" focusable="false">
                    <path d="M9.67387 0L11.9126 4.98086L17.4317 3.52843L14.7043 8.28702L19.3477 11.4567L13.7079 12.4097L13.9791 17.8147L9.67387 14.2445L5.36859 17.8147L5.63979 12.4097L0 11.4567L4.64346 8.28702L1.91603 3.52843L7.43513 4.98086L9.67387 0Z" />
                  </svg>
                </span>
                {age}
              </button>
            </li>
          ))}
        </ul>

        <ul className="lg-sr">
          {labels.map(({ place, age, coords }) => (
            <li key={place.id}>
              {locale === "hi" ? "स्थान" : "Place"} {age}: {coords}, ±{Math.round(place.accuracy)} m
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
