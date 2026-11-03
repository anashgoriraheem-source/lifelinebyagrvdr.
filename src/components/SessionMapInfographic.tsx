import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useApp } from "@/hooks/useApp";
import { useNow } from "@/hooks/useNow";
import { useI18n } from "@/i18n";
import { formatCoordinates, placeAge } from "@/lib/places";
import { sessionPins } from "@/lib/sessionMap";
import {
  DOT_COLS,
  DOT_MAP_H,
  DOT_MAP_W,
  DOT_ORIGIN_X,
  DOT_ORIGIN_Y,
  DOT_ROWS,
  DOT_STEP_X,
  DOT_STEP_Y,
  landMask,
  projectDots,
} from "@/lib/worldDots";
import "../styles/session-map-infographic.css";

/**
 * Session board — the adapted "Map Infographic" board.
 *
 * Layout, card shape, entrance, count-up and the pulsing pins are the original
 * design. What changed is the content: the pins are the places this tab's
 * location fixes actually came from, and the two counters read the app's own
 * live totals. The dot world is drawn from the app's verified 2° land grid
 * (see `worldDots.ts`), so a pin sits on the place it describes instead of on a
 * decorative continent; no pin, number or coordinate is invented.
 */

const COUNT_DURATION_MS = 2_000;
const COUNT_START_MS = 2_000;
const RING_PERIOD_MS = 2_200;
/** Canvas fills cannot read CSS custom properties, so tokens are resolved once. */
const FALLBACK_DOT = "#d8bb76";
const FALLBACK_PIN = "#57d3a2";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Counts a live total up to its value once, keeping the board's original timing. */
function useCountUp(target: number | null, delay = COUNT_START_MS) {
  const [value, setValue] = useState<number | null>(target);
  useEffect(() => {
    if (target == null) {
      setValue(null);
      return;
    }
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    let from: number | null = null;
    const step = (ts: number) => {
      if (from == null) from = ts;
      const progress = Math.min((ts - from) / COUNT_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    const timer = window.setTimeout(() => {
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, delay]);
  return value;
}

export function SessionMapInfographic() {
  const places = useApp((s) => s.places);
  const readings = useApp((s) => s.device.readingCount ?? 0);
  const fix = useApp((s) => s.location.fix);
  const locationStatus = useApp((s) => s.location.status);
  const { locale } = useI18n();
  const now = useNow(30_000);
  const hi = locale === "hi";

  const rootRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const infoRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [ready, setReady] = useState(false);

  const pins = useMemo(() => sessionPins(places), [places]);
  const accuracy = fix ? Math.round(fix.accuracy) : null;
  const countedReadings = useCountUp(readings);
  const countedAccuracy = useCountUp(accuracy);

  // Entrance, exactly as the board's original timing.
  useEffect(() => {
    if (prefersReducedMotion()) {
      setRevealed(true);
      setReady(true);
      return;
    }
    const reveal = window.setTimeout(() => setRevealed(true), 60);
    const settle = window.setTimeout(() => setReady(true), 1_200);
    return () => {
      window.clearTimeout(reveal);
      window.clearTimeout(settle);
    };
  }, []);

  // Between 520 and 920 px the board scales as one piece; the infocard's inset
  // is compensated so it keeps its distance from the card's edges.
  useEffect(() => {
    const root = rootRef.current;
    const inner = innerRef.current;
    const info = infoRef.current;
    if (!root || !inner || !info) return;
    const applyScale = () => {
      const width = root.offsetWidth;
      if (width >= 920 || width <= 520) {
        inner.style.transform = "";
        root.style.height = "";
        info.style.bottom = "";
        info.style.left = "";
        return;
      }
      const ratio = width / 920;
      inner.style.transformOrigin = "top left";
      inner.style.transform = `scale(${ratio})`;
      root.style.height = `${Math.round(518 * ratio)}px`;
      info.style.bottom = `${(24 / ratio).toFixed(2)}px`;
      info.style.left = `${(32 / ratio).toFixed(2)}px`;
    };
    applyScale();
    window.addEventListener("resize", applyScale);
    return () => window.removeEventListener("resize", applyScale);
  }, []);

  // Dots, pulsing pins and the shimmer. Re-runs only when the pins change.
  useEffect(() => {
    const root = rootRef.current;
    const wrap = root?.querySelector<HTMLElement>("[data-mig-map]") ?? null;
    const landCanvas = root?.querySelector<HTMLCanvasElement>("[data-mig-land]") ?? null;
    const pinCanvas = root?.querySelector<HTMLCanvasElement>("[data-mig-pins]") ?? null;
    const shimmerCanvas = root?.querySelector<HTMLCanvasElement>("[data-mig-shimmer]") ?? null;
    if (!root || !wrap || !landCanvas || !pinCanvas) return;
    const wrapEl: HTMLElement = wrap;
    const landCtx = landCanvas.getContext("2d");
    const pinCtx = pinCanvas.getContext("2d");
    if (!landCtx || !pinCtx) return;

    const quiet = prefersReducedMotion();
    const land: CanvasRenderingContext2D = landCtx;
    const pinLayer: CanvasRenderingContext2D = pinCtx;

    const probe = document.createElement("canvas").getContext("2d");
    const resolve = (value: string, fallback: string) => {
      if (!probe || !value) return fallback;
      probe.fillStyle = "#000000";
      probe.fillStyle = value;
      const out = probe.fillStyle as string;
      return out.toLowerCase() === "#000000" ? fallback : out;
    };
    const css = getComputedStyle(root);
    const dotA = resolve(css.getPropertyValue("--mig-c-map-dot-a").trim(), FALLBACK_DOT);
    const dotB = resolve(css.getPropertyValue("--mig-c-map-dot-b").trim(), dotA);
    const pinColor = resolve(css.getPropertyValue("--mig-c-pin").trim(), FALLBACK_PIN);
    const rgbOf = (value: string, fallback: string) => {
      const parts = value.replace(/^rgba?\(|\)$/g, "").split(",");
      if (parts.length < 3) return fallback.split(",").map(Number);
      return parts.slice(0, 3).map((part) => Math.round(Number(part.trim())));
    };
    const ringRGB = rgbOf(pinColor, "87,211,162").join(",");
    // The shimmer keeps its dither and its motion; only its colour follows the
    // theme, so it glints in the same gold as the dots it sits on.
    const shimmerTint = rgbOf(dotA, "216,187,118").map((c) => c / 255);

    const cleanup: (() => void)[] = [];
    let frame = 0;
    let shimmerFrame = 0;
    let dots: HTMLCanvasElement | null = null;
    let readyFlag = false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;

    function buildDots() {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.scale(dpr, dpr);
      const mask = landMask();
      const dotR = Math.max(0.55, (DOT_STEP_X / DOT_MAP_W) * width * 0.38);
      const x0 = (DOT_ORIGIN_X / DOT_MAP_W) * width;
      const y0 = (DOT_ORIGIN_Y / DOT_MAP_H) * height;
      const sx = (DOT_STEP_X / DOT_MAP_W) * width;
      const sy = (DOT_STEP_Y / DOT_MAP_H) * height;
      for (let row = 0; row < DOT_ROWS; row++) {
        for (let col = 0; col < DOT_COLS; col++) {
          if (!mask[row * DOT_COLS + col]) continue;
          // Isolated single cells read as noise at this size; the board's
          // original art dropped them too.
          let neighbours = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const r2 = row + dr;
              const c2 = col + dc;
              if (r2 < 0 || r2 >= DOT_ROWS || c2 < 0 || c2 >= DOT_COLS) continue;
              if (mask[r2 * DOT_COLS + c2]) neighbours++;
            }
          }
          if (neighbours < 3) continue;
          const even = (row + col) % 2 === 0;
          ctx.globalAlpha = even ? 1 : 0.62;
          ctx.fillStyle = even ? dotA : dotB;
          ctx.beginPath();
          ctx.arc(x0 + col * sx, y0 + row * sy, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      return canvas;
    }

    const sizeTo = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    function drawLand() {
      land.clearRect(0, 0, width, height);
      if (dots) land.drawImage(dots, 0, 0, width, height);
    }

    const pinPoint = (lat: number, lng: number) => {
      const [x, y] = projectDots(lat, lng);
      return [(x / DOT_MAP_W) * width, (y / DOT_MAP_H) * height] as const;
    };
    const pinRadius = (radius: number) => {
      const boost = (rootRef.current?.offsetWidth ?? 920) <= 480 ? 1.3 : 1;
      return (radius / DOT_MAP_W) * width * boost * 1.44;
    };

    function drawPins(elapsed: number) {
      pinLayer.clearRect(0, 0, width, height);
      pins.forEach((pin, i) => {
        const [px, py] = pinPoint(pin.place.lat, pin.place.lng);
        const r = pinRadius(pin.radius);
        if (!quiet) {
          const phase = (elapsed / RING_PERIOD_MS + i * 0.22) % 1;
          pinLayer.beginPath();
          pinLayer.arc(px, py, r + phase * r * 3.5, 0, Math.PI * 2);
          pinLayer.strokeStyle = `rgba(${ringRGB},${((1 - phase) * 0.5).toFixed(3)})`;
          pinLayer.lineWidth = 1.2;
          pinLayer.stroke();
        }
        pinLayer.beginPath();
        pinLayer.arc(px, py, r, 0, Math.PI * 2);
        pinLayer.fillStyle = pinColor;
        pinLayer.fill();
        pinLayer.lineWidth = 1;
        pinLayer.strokeStyle = "rgba(255,255,255,0.55)";
        pinLayer.stroke();
      });
    }

    function loop(ts: number) {
      drawPins(ts);
      frame = requestAnimationFrame(loop);
    }

    function measure() {
      const rect = wrapEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      width = rect.width;
      height = rect.height;
      sizeTo(landCanvas!, land);
      sizeTo(pinCanvas!, pinLayer);
      dots = buildDots();
      drawLand();
      return true;
    }

    if (measure()) {
      readyFlag = true;
      wrapEl.setAttribute("data-mig-ready", "");
      drawPins(0);
      if (!quiet) frame = requestAnimationFrame(loop);
    }

    const observer = new ResizeObserver(() => {
      if (!measure()) return;
      if (!readyFlag) {
        readyFlag = true;
        wrapEl.setAttribute("data-mig-ready", "");
        if (!quiet) frame = requestAnimationFrame(loop);
      }
      if (quiet) drawPins(0);
    });
    observer.observe(wrapEl);
    cleanup.push(() => observer.disconnect());

    /* hovers and taps pick the nearest pin; the tooltip itself is React's */
    const nearest = (clientX: number, clientY: number, slop: number) => {
      const rect = wrapEl.getBoundingClientRect();
      if (!rect.width) return null;
      const bx = ((clientX - rect.left) / rect.width) * DOT_MAP_W;
      const by = ((clientY - rect.top) / rect.height) * DOT_MAP_H;
      let hit: number | null = null;
      let best = Infinity;
      pins.forEach((pin, i) => {
        const [x, y] = projectDots(pin.place.lat, pin.place.lng);
        const d = Math.hypot(bx - x, by - y);
        const limit = Math.max(slop, pin.radius * 2.4);
        if (d < limit && d < best) {
          best = d;
          hit = i;
        }
      });
      return hit;
    };

    const onMove = (event: PointerEvent) => {
      const hit = nearest(event.clientX, event.clientY, 14);
      setHovered((prev) => (prev === hit ? prev : hit));
      wrapEl.style.cursor = hit == null ? "default" : "pointer";
    };
    const onLeave = () => {
      setHovered(null);
      wrapEl.style.cursor = "default";
    };
    let tapTimer = 0;
    const onTouch = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const hit = nearest(touch.clientX, touch.clientY, 22);
      setHovered(hit);
      window.clearTimeout(tapTimer);
      if (hit != null) tapTimer = window.setTimeout(() => setHovered(null), 2_500);
    };

    wrapEl.addEventListener("pointermove", onMove);
    wrapEl.addEventListener("pointerleave", onLeave);
    wrapEl.addEventListener("touchstart", onTouch, { passive: true });
    cleanup.push(() => {
      wrapEl.removeEventListener("pointermove", onMove);
      wrapEl.removeEventListener("pointerleave", onLeave);
      wrapEl.removeEventListener("touchstart", onTouch);
      window.clearTimeout(tapTimer);
    });

    /* Bayer-dithered noise over the land, exactly as the original board. */
    if (shimmerCanvas && !quiet) {
      const gl = shimmerCanvas.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: false,
      });
      if (gl) {
        const glVS = "#version 300 es\nin vec2 a_pos;\nvoid main(){gl_Position=vec4(a_pos,0.,1.);}";
        const glFS = [
          "#version 300 es",
          "precision mediump float;",
          "uniform vec2 uResolution;",
          "uniform float uTime;",
          "uniform sampler2D uLandMap;",
          "uniform vec3 uTint;",
          "const float PIXEL_SIZE=4.;",
          "const float CELL_PIXEL_SIZE=8.*PIXEL_SIZE;",
          "out vec4 fragColor;",
          "float Bayer2(vec2 a){a=floor(a);return fract(a.x/2.+a.y*a.y*.75);}",
          "#define Bayer4(a) (Bayer2(.5*(a))*.25+Bayer2(a))",
          "#define Bayer8(a) (Bayer4(.5*(a))*.25+Bayer2(a))",
          "#define FBM_OCTAVES 5",
          "#define FBM_LACUNARITY 1.25",
          "#define FBM_GAIN 1.",
          "#define FBM_SCALE 4.0",
          "float hash11(float n){return fract(sin(n)*43758.5453);}",
          "float vnoise(vec3 p){",
          "  vec3 ip=floor(p),fp=fract(p);",
          "  float n000=hash11(dot(ip+vec3(0,0,0),vec3(1,57,113)));",
          "  float n100=hash11(dot(ip+vec3(1,0,0),vec3(1,57,113)));",
          "  float n010=hash11(dot(ip+vec3(0,1,0),vec3(1,57,113)));",
          "  float n110=hash11(dot(ip+vec3(1,1,0),vec3(1,57,113)));",
          "  float n001=hash11(dot(ip+vec3(0,0,1),vec3(1,57,113)));",
          "  float n101=hash11(dot(ip+vec3(1,0,1),vec3(1,57,113)));",
          "  float n011=hash11(dot(ip+vec3(0,1,1),vec3(1,57,113)));",
          "  float n111=hash11(dot(ip+vec3(1,1,1),vec3(1,57,113)));",
          "  vec3 w=fp*fp*fp*(fp*(fp*6.-15.)+10.);",
          "  float y0=mix(mix(n000,n100,w.x),mix(n010,n110,w.x),w.y);",
          "  float y1=mix(mix(n001,n101,w.x),mix(n011,n111,w.x),w.y);",
          "  return mix(y0,y1,w.z)*2.-1.;}",
          "float fbm2(vec2 uv,float t){",
          "  vec3 p=vec3(uv*FBM_SCALE,t);",
          "  float amp=1.,freq=1.,sum=1.;",
          "  for(int i=0;i<FBM_OCTAVES;++i){sum+=amp*vnoise(p*freq);freq*=FBM_LACUNARITY;amp*=FBM_GAIN;}",
          "  return sum*.5+.5;}",
          "void main(){",
          "  vec2 fc=gl_FragCoord.xy-uResolution*.5;",
          "  float ar=uResolution.x/uResolution.y;",
          "  vec2 cellId=floor(fc/CELL_PIXEL_SIZE);",
          "  vec2 uv=(cellId*CELL_PIXEL_SIZE/uResolution)*vec2(ar,1.);",
          "  float feed=fbm2(uv,uTime*.1);",
          "  feed=feed*.5-.65;",
          "  float bayer=Bayer8(fc/PIXEL_SIZE)-.5;",
          "  float bw=step(.5,feed+bayer);",
          "  vec2 uvMap=vec2(gl_FragCoord.x/uResolution.x,1.-gl_FragCoord.y/uResolution.y);",
          "  float isLand=step(.5,texture(uLandMap,uvMap).r);",
          "  float v=bw*isLand; fragColor=vec4(uTint*v,v);}",
        ].join("\n");

        const shader = (type: number, src: string) => {
          const s = gl.createShader(type);
          if (!s) return null;
          gl.shaderSource(s, src);
          gl.compileShader(s);
          return s;
        };
        const vertex = shader(gl.VERTEX_SHADER, glVS);
        const fragment = shader(gl.FRAGMENT_SHADER, glFS);
        const program = gl.createProgram();
        if (vertex && fragment && program) {
          gl.attachShader(program, vertex);
          gl.attachShader(program, fragment);
          gl.linkProgram(program);
          gl.useProgram(program);

          const vao = gl.createVertexArray();
          gl.bindVertexArray(vao);
          const buffer = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
            gl.STATIC_DRAW,
          );
          const pos = gl.getAttribLocation(program, "a_pos");
          gl.enableVertexAttribArray(pos);
          gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

          const uResolution = gl.getUniformLocation(program, "uResolution");
          const uTime = gl.getUniformLocation(program, "uTime");
          const uLandMap = gl.getUniformLocation(program, "uLandMap");
          const uTint = gl.getUniformLocation(program, "uTint");

          const mask = landMask();
          const landData = new Uint8Array(DOT_COLS * DOT_ROWS * 4);
          for (let i = 0; i < DOT_COLS * DOT_ROWS; i++) {
            const v = mask[i] ? 255 : 0;
            landData[i * 4] = v;
            landData[i * 4 + 1] = v;
            landData[i * 4 + 2] = v;
            landData[i * 4 + 3] = v;
          }
          const texture = gl.createTexture();
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            DOT_COLS,
            DOT_ROWS,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            landData,
          );
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.uniform1i(uLandMap, 0);
          gl.uniform3f(uTint, shimmerTint[0], shimmerTint[1], shimmerTint[2]);

          const started = performance.now();
          const shimmer = () => {
            const w = Math.round(shimmerCanvas.clientWidth * dpr);
            const h = Math.round(shimmerCanvas.clientHeight * dpr);
            if (w && h && (shimmerCanvas.width !== w || shimmerCanvas.height !== h)) {
              shimmerCanvas.width = w;
              shimmerCanvas.height = h;
              gl.viewport(0, 0, w, h);
            }
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.uniform2f(uResolution, w, h);
            gl.uniform1f(uTime, (performance.now() - started) / 1000);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            shimmerFrame = requestAnimationFrame(shimmer);
          };
          shimmerFrame = requestAnimationFrame(shimmer);
          cleanup.push(() => cancelAnimationFrame(shimmerFrame));
        }
      }
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (shimmerFrame) cancelAnimationFrame(shimmerFrame);
      cleanup.forEach((fn) => fn());
      dots = null;
    };
  }, [pins]);

  const readingValue = countedReadings == null ? "0" : String(Math.round(countedReadings));
  const accuracyValue = countedAccuracy == null ? "—" : `±${Math.round(countedAccuracy)} m`;

  const labels = pins.map((pin) => {
    const [x, y] = projectDots(pin.place.lat, pin.place.lng);
    return {
      pin,
      left: `${(x / DOT_MAP_W) * 100}%`,
      top: `${(y / DOT_MAP_H) * 100}%`,
      coords: formatCoordinates(pin.place.lat, pin.place.lng),
      age: placeAge(now - pin.place.at, locale),
    };
  });

  const emptyText = hi
    ? locationStatus === "requesting"
      ? "स्थान की अनुमति का इंतज़ार है…"
      : "अभी कोई स्थान नहीं। ऊपर नक्शे में अनुमति दें; इस टैब को मिला हर स्थान पिन बनेगा।"
    : locationStatus === "requesting"
      ? "Waiting for location permission…"
      : "No location yet. Allow location in the map above; each place this tab receives becomes a pin.";

  const summary = hi
    ? `इस टैब को मिली ${pins.length} जगहें, असली निर्देशांक पर।`
    : `${pins.length} ${pins.length === 1 ? "place" : "places"} recorded in this tab, at their real coordinates.`;

  return (
    <section
      ref={rootRef}
      className={`mig-section${revealed ? " mig-revealed" : ""}${ready ? " mig-ready" : ""}`}
      aria-labelledby="session-map-title"
    >
      <div className="mig-inner" ref={innerRef}>
        <div className="mig-badges">
          <span className="mig-ticker">
            <span className="mig-ticker-dot" aria-hidden="true" />
            <span className="mig-val">{readingValue}</span>
            <span className="mig-label">
              {hi ? "इस कनेक्शन में रीडिंग" : "Readings this connection"}
            </span>
          </span>
          <span className="mig-ticker">
            <span className="mig-ticker-dot" aria-hidden="true" />
            <span className="mig-val">{accuracyValue}</span>
            <span className="mig-label">{hi ? "स्थान की सटीकता" : "Location accuracy"}</span>
          </span>
        </div>

        <div className="mig-map-outer">
          <div className="mig-map-wrap" data-mig-map="">
            <canvas
              className="mig-layer"
              data-mig-land=""
              role="img"
              aria-label={`${summary} ${pins.length ? "" : emptyText}`}
            />
            <canvas className="mig-layer mig-shimmer" data-mig-shimmer="" aria-hidden="true" />
            <canvas className="mig-layer" data-mig-pins="" aria-hidden="true" />
            <div className="mig-labels" aria-hidden="true">
              {labels.map(({ pin, left, top, coords, age }, i) => (
                <div
                  key={pin.place.id}
                  className={`mig-marker-label${hovered === i ? " is-visible" : ""}`}
                  style={{ left, top }}
                >
                  <span className="mig-label-icon">
                    <MapPin aria-hidden="true" strokeWidth={1.9} />
                  </span>
                  <span className="mig-label-text">
                    <span className="mig-label-metric">
                      ±{Math.round(pin.place.accuracy)} m · {age}
                    </span>
                    <span className="mig-label-name">
                      {coords}
                      {pin.count > 1
                        ? hi
                          ? ` · ${pin.count} स्थान`
                          : ` · ${pin.count} fixes`
                        : ""}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mig-infocard" ref={infoRef}>
          <div className="mig-info-pink" aria-hidden="true">
            <svg viewBox="0 0 340 146" preserveAspectRatio="none" focusable="false">
              <rect width="340" height="146" />
            </svg>
          </div>
          <div className="mig-info-box">
            <div className="mig-info-yellow" aria-hidden="true">
              <svg viewBox="0 0 347 161" preserveAspectRatio="none" focusable="false">
                <defs>
                  <clipPath id="mig-info-clip">
                    <rect width="347" height="161" />
                  </clipPath>
                </defs>
                <g clipPath="url(#mig-info-clip)">
                  <path d="M397 161H0V141.811H4.91406C5.19639 143.705 6.83039 145.159 8.80371 145.159H11.2764C13.4485 145.159 15.209 143.398 15.209 141.226V138.884C15.209 136.712 13.4485 134.95 11.2764 134.95H8.80371C6.82942 134.95 5.1952 136.406 4.91406 138.302H0V100.148H4.91406C5.19679 102.043 6.83071 103.496 8.80371 103.496H11.2764C13.4483 103.496 15.2087 101.735 15.209 99.5635V97.2217C15.209 95.0496 13.4485 93.2881 11.2764 93.2881H8.80371C6.82942 93.2882 5.1952 94.7435 4.91406 96.6396H0V58.4883H4.91406C5.19675 60.3826 6.83068 61.8358 8.80371 61.8359H11.2764C13.4483 61.8359 15.2087 60.0752 15.209 57.9033V55.5615C15.209 53.3894 13.4485 51.6279 11.2764 51.6279H8.80371C6.82946 51.6281 5.19525 53.0834 4.91406 54.9795H0V16.8252H4.91406C5.196 18.7204 6.83007 20.1747 8.80371 20.1748H11.2764C13.4485 20.1748 15.209 18.4133 15.209 16.2412V13.8994C15.2089 11.7274 13.4484 9.96582 11.2764 9.96582H8.80371C6.82983 9.96596 5.19571 11.4209 4.91406 13.3164H0V-24.834H4.91406C5.19636 -22.9392 6.83037 -21.4855 8.80371 -21.4854H11.2764C13.4483 -21.4854 15.2087 -23.2461 15.209 -25.418V-27.7607C15.209 -29.9328 13.4485 -31.6943 11.2764 -31.6943H8.80371C6.82942 -31.6942 5.1952 -30.2389 4.91406 -28.3428H0V-47H397V161Z" />
                </g>
              </svg>
            </div>
            <div className="mig-info-text">
              <h2 className="mig-title" id="session-map-title">
                {hi ? (
                  <>
                    यह टैब,
                    <br />
                    नक्शे पर
                  </>
                ) : (
                  <>
                    This tab,
                    <br />
                    on the map
                  </>
                )}
              </h2>
              <p className="mig-desc">
                {pins.length
                  ? hi
                    ? "हर पिन इस टैब को मिले स्थान पर है, असली निर्देशांक के साथ। कुछ सहेजा नहीं जाता; कोई पिन मिले स्थान से ज़्यादा सटीक नहीं है।"
                    : "Each pin is a place this tab's location fixes came from, at its real coordinates. Nothing is saved, and no pin is more precise than its fix."
                  : emptyText}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* The dots are geography, not readings — say so instead of letting the
          map imply more than it knows. */}
      <p className="mig-caption">
        {hi
          ? "बिंदु ज़मीन दिखाते हैं, कोई रीडिंग नहीं। पिन इस टैब में दर्ज जगहें हैं।"
          : "Dots show land, not readings. Pins are places this tab recorded."}
      </p>

      <ul className="mig-sr">
        {labels.map(({ pin, coords, age }) => (
          <li key={pin.place.id}>
            {hi ? "स्थान" : "Place"} {age}: {coords}, ±{Math.round(pin.place.accuracy)} m
            {pin.count > 1 ? (hi ? `, ${pin.count} स्थान` : `, ${pin.count} fixes`) : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
