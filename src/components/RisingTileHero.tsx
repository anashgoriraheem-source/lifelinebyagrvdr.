import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import type * as ThreeNS from "three";
import { useI18n } from "@/i18n";

/**
 * Rising tile hero.
 *
 * A full-width section whose 3D grid lifts one tile at a time under the
 * pointer (or on its own when nobody is pointing). The art is decorative: the
 * canvas is hidden from assistive technology and every word on screen is real
 * DOM text. Colours are the sRGB equivalents of the app's semantic tokens in
 * `styles.css`, so the section reads as part of Lifeline rather than a pasted
 * widget.
 */
const C = {
  background: "#101114", // --background  oklch(0.178 0.007 275)
  tile: "#191a1f", // --card        oklch(0.218 0.010 275)
  tileSide: "#121317", // between --background and --card
  seam: "#08090b", // the floor seen through the seams
  text: "#f4f0e6", // --foreground  oklch(0.955 0.014 85)
  muted: "#a9aab0", // --muted-foreground oklch(0.74 0.008 275)
  gold: "#d6b879", // --primary     oklch(0.794 0.088 85)
  goldInk: "#101114", // --primary-foreground
} as const;

const S = {
  cols: 16,
  rows: 16,
  tileSize: 1,
  gap: 0.016,
  thickness: 0.34,
  gridSpin: 46.5,
  paperGrain: 0.5,
  roughness: 0.92,
  iconLine: 0.022,
  printedShare: 0.55,
  pressedDepth: 0.49,
  seed: 7,
  labelInset: 0.09,
  frameWeight: 0.4,
  matchGlow: 2.2,
  liftHeight: 0.62,
  liftTime: 0.75,
  lightRamp: 1.6,
  holdTime: 3,
  pauseTime: 0.9,
  idleFloat: 0.03,
  idleTilt: 1.2,
  idleSpeed: 0.35,
  pitGlow: 3.98,
  wallGlow: 1.6,
  blockGlow: 0.21,
  wallGlowHeight: 0.1,
  pitLight: 17.5,
  volLight: 0.32,
  volSource: 0.63,
  volHeight: 2.4,
  volFade: 1.05,
  volSoft: 0.14,
  volStreaks: 0.61,
  volStreakScale: 9,
  volDrift: 0.41,
  volSteps: 40,
  keyLight: 1.8,
  keyAngle: 145,
  keyHeight: 73,
  ambient: 3,
  shadowSoft: 20,
  camTilt: 58.5,
  camDistance: 10.35,
  fov: 32,
  dpr: 1.5,
  maxPixels: 2.2,
};

interface Tile {
  mesh: ThreeNS.Object3D;
  inst: ThreeNS.InstancedMesh;
  idx: number;
  i: number;
  j: number;
  a: number;
  b: number;
  cx: number;
  cy: number;
  lift: number;
  target: number;
  top: number;
  sig: number;
  rest: boolean;
}

interface StatusCopy {
  idle: string;
  active: string;
}

const MAXA = 3;
const ATL = 4;
const CELL = 512;
const MATCH_CELL = 15;
const ease = (p: number) => p * p * (3 - 2 * p);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function seeded(n: number) {
  let s = (n * 9301 + 49297) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

function paintPaper(x: CanvasRenderingContext2D, size: number, base: string, rnd: () => number) {
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  const img = x.getImageData(0, 0, size, size);
  const d = img.data;
  const grain = S.paperGrain * 22;
  for (let k = 0; k < d.length; k += 4) {
    const n = (rnd() - 0.5) * grain;
    d[k] += n;
    d[k + 1] += n;
    d[k + 2] += n;
  }
  x.putImageData(img, 0, 0);
}

/** Mount the scene; returns a cleanup function. */
function mountScene(
  THREE: typeof import("three"),
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  statusEl: HTMLElement,
  statusText: HTMLElement,
  copy: StatusCopy,
) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.background);
  const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.1, 200);
  camera.up.set(0, 0, 1);
  const world = new THREE.Group();
  scene.add(world);

  const key = new THREE.DirectionalLight(0xffffff, S.keyLight);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 40 });
  const ambient = new THREE.HemisphereLight(0xffffff, 0x303030, 0.5);
  scene.add(key, key.target, ambient);
  const pitLights = [...Array(MAXA)].map(() => {
    const l = new THREE.PointLight(0xff5a0a, 0, 3, 2);
    world.add(l);
    return l;
  });

  const worldInvU = { value: new THREE.Matrix4() };
  const matchGlowU = { value: S.matchGlow };
  const glowC = new THREE.Color(C.gold);

  /* Shared "opening" uniforms (up to 3 lifted tiles). */
  const glowU = {
    uAC: { value: [...Array(MAXA)].map(() => new THREE.Vector2()) },
    uAL: { value: new Array(MAXA).fill(0) },
    uAZ: { value: new Array(MAXA).fill(0) },
    uHalf: { value: 0.5 },
    uThick: { value: S.thickness },
    uGlowC: { value: new THREE.Color() },
    uBlockGlow: { value: S.blockGlow },
    uWallGlow: { value: S.wallGlow },
    uWallH: { value: S.wallGlowHeight },
    uPitGlow: { value: S.pitGlow },
  };

  const GLOW_GLSL = `
uniform vec2 uAC[${MAXA}]; uniform float uAL[${MAXA}], uAZ[${MAXA}];
uniform float uHalf, uThick, uWallGlow, uBlockGlow, uWallH, uPitGlow; uniform vec3 uGlowC;
varying vec3 vGP;
float rectDist(vec2 p, vec2 c, float h) { vec2 d = abs(p - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }`;

  type GlowKind = "top" | "side" | "floor";

  function withGlow(mat: ThreeNS.MeshStandardMaterial, kind: GlowKind) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, glowU);
      sh.vertexShader = "uniform mat4 uWorldInv;\n" + sh.vertexShader;
      sh.uniforms.uWorldInv = worldInvU;
      sh.vertexShader =
        "varying vec3 vGP;\n" +
        sh.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
#ifdef USE_INSTANCING
vGP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
vGP = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
vGP = (uWorldInv * vec4(vGP, 1.0)).xyz;`,
        );
      let add = "";
      if (kind === "top") {
        sh.uniforms.uMatchGlow = matchGlowU;
        sh.vertexShader =
          "attribute vec2 aCell; attribute float aMatch; varying vec2 vLocalUv; varying float vMatch;\n" +
          sh.vertexShader.replace(
            "#include <uv_vertex>",
            `#include <uv_vertex>
vLocalUv = uv; vMatch = aMatch;
#ifdef USE_MAP
vMapUv = (uv + aCell) * 0.25;
#endif`,
          );
        sh.fragmentShader =
          "uniform float uMatchGlow; varying vec2 vLocalUv; varying float vMatch;\n" +
          sh.fragmentShader.replace(
            "#include <map_fragment>",
            `
#ifdef USE_MAP
  vec4 sdc = texture2D(map, vMapUv);
  vec4 mc = texture2D(map, (vLocalUv + vec2(3.0, 0.0)) * 0.25);
  float mk = smoothstep(0.15, 0.6, vMatch);
  diffuseColor *= mix(sdc, mc, mk);
  float matchMask = smoothstep(0.08, 0.35, mc.r) * mk;
#else
  float matchMask = 0.0;
#endif`,
          );
        add = "totalEmissiveRadiance += uGlowC * matchMask * uMatchGlow;";
      }
      if (kind === "side") {
        add = `
for (int i = 0; i < ${MAXA}; i++) {
  float d = abs(rectDist(vGP.xy, uAC[i], uHalf));
  float near = 1.0 - smoothstep(0.0, uHalf * 0.12, d);
  float wall = near * smoothstep(0.0, -uThick, vGP.z);
  float bottom = uAZ[i] - uThick;
  float rim = near * step(bottom - 0.001, vGP.z) * exp(-(vGP.z - bottom) / max(uWallH * uThick, 0.001));
  totalEmissiveRadiance += uGlowC * uAL[i] * (uWallGlow * wall * 0.8 + uBlockGlow * rim);
}`;
      }
      if (kind === "floor") {
        add = `
for (int i = 0; i < ${MAXA}; i++) {
  float d = rectDist(vGP.xy, uAC[i], uHalf);
  totalEmissiveRadiance += uGlowC * uPitGlow * uAL[i] * (1.0 - smoothstep(-uHalf * 0.15, uHalf * 0.08, d));
}`;
      }
      sh.fragmentShader =
        GLOW_GLSL +
        "\n" +
        sh.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\n" + add,
        );
    };
    mat.customProgramCacheKey = () => `rt-${kind}`;
    return mat;
  }

  /* Tile tops live in one 4 x 4 atlas: cell 0 is a plain top, the last cell the glowing lock-on. */
  function drawFrame(x: CanvasRenderingContext2D, size: number, lineWidth: number) {
    const m = size * S.labelInset;
    x.lineWidth = lineWidth * S.frameWeight;
    x.strokeRect(m, m, size - 2 * m, size - 2 * m);
  }

  function topTexture(printed: boolean) {
    const size = CELL;
    const c = document.createElement("canvas");
    c.width = c.height = size * ATL;
    const x = c.getContext("2d");
    if (!x) return new THREE.Texture();
    const rnd = seeded(printed ? 3 : 5);
    paintPaper(x, size * ATL, C.tile, rnd);
    const lw = size * S.iconLine;
    for (const k of [0, MATCH_CELL]) {
      x.save();
      x.translate((k % ATL) * size, Math.floor(k / ATL) * size);
      x.beginPath();
      x.rect(0, 0, size, size);
      x.clip();
      x.strokeStyle = k === MATCH_CELL ? C.gold : `rgba(0,0,0,${S.pressedDepth})`;
      x.fillStyle = x.strokeStyle;
      x.lineCap = "butt";
      x.lineJoin = "miter";
      if (k === MATCH_CELL) {
        drawFrame(x, size, lw * 1.1);
      } else if (!printed) {
        x.save();
        x.translate(0, lw * 0.35);
        x.strokeStyle = "rgba(255,255,255,0.10)";
        drawFrame(x, size, lw);
        x.restore();
        x.strokeStyle = `rgba(0,0,0,${S.pressedDepth})`;
        drawFrame(x, size, lw);
      }
      x.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  function sideTexture() {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    if (x) paintPaper(x, size, C.tileSide, seeded(9));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const sideMat = withGlow(
    new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 }),
    "side",
  );
  const topMats = [true, false].map((printed) =>
    withGlow(new THREE.MeshStandardMaterial({ roughness: 0.9, map: topTexture(printed) }), "top"),
  );
  const floorMat = withGlow(
    new THREE.MeshStandardMaterial({ roughness: 1, color: C.seam }),
    "floor",
  );
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMat);
  floor.receiveShadow = true;
  world.add(floor);
  sideMat.map = sideTexture();

  /* Volumetric light rising from the opening. */
  const VOL_V = `uniform vec3 uBox; varying vec3 vP; void main() { vP = position * uBox; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const VOL_F = `uniform vec3 uCam, uCol, uBox; uniform float uHalf, uB, uT, uD, uH, uFade, uSoft, uStreak, uStreakScale, uTime, uAmt; uniform int uSteps;
varying vec3 vP;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + 1.0), f.x), f.y); }
float boxMask(vec2 q, float h, float soft) { vec2 d = abs(q) - h; return 1.0 - smoothstep(-soft, soft, max(d.x, d.y)); }
vec2 hitBox(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax) { vec3 inv = 1.0 / rd, t0 = (bmin - ro) * inv, t1 = (bmax - ro) * inv;
  vec3 tn = min(t0, t1), tf = max(t0, t1); return vec2(max(max(tn.x, tn.y), tn.z), min(min(tf.x, tf.y), tf.z)); }
void main() {
  vec3 ro = uCam, rd = normalize(vP - uCam);
  vec2 tv = hitBox(ro, rd, vec3(-uBox.xy * 0.5, 0.0), vec3(uBox.xy * 0.5, uBox.z));
  float t0 = max(tv.x, 0.0), t1 = tv.y;
  vec2 tb = hitBox(ro, rd, vec3(-uHalf, -uHalf, uB), vec3(uHalf, uHalf, uB + uT));
  if (tb.x < tb.y && tb.y > 0.0) t1 = min(t1, tb.x);
  float M = uHalf + 2.0 * uSoft * (1.0 + uH / uD);
  for (int k = 0; k < 4; k++) {
    float sx = (k == 0) ? 1.0 : (k == 1) ? -1.0 : 0.0, sy = (k == 2) ? 1.0 : (k == 3) ? -1.0 : 0.0;
    float a = (sx * ro.x + sy * ro.y) * uD - M * (uD + ro.z), b = (sx * rd.x + sy * rd.y) * uD - M * rd.z;
    if (abs(b) < 1e-6) { if (a > 0.0) discard; }
    else if (b > 0.0) t1 = min(t1, -a / b); else t0 = max(t0, -a / b);
  }
  if (t1 <= t0) discard;
  int steps = int(clamp(ceil((t1 - t0) / (uH / float(uSteps))), 4.0, float(uSteps)));
  float n = float(steps), dt = (t1 - t0) / n, t = t0 + dt * h21(gl_FragCoord.xy + fract(uTime)), sum = 0.0;
  for (int i = 0; i < 96; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t; t += dt;
    if (p.z <= 0.0) continue;
    float k = uD / (uD + p.z);
    vec2 q0 = p.xy * k;
    float soft = uSoft * (1.0 + p.z / uD);
    float lit = boxMask(q0, uHalf, soft);
    if (p.z > uB) lit *= 1.0 - boxMask(p.xy * (uD + uB) / (uD + p.z), uHalf, soft);
    if (lit <= 0.001) continue;
    float str = mix(1.0, vnoise(q0 * uStreakScale / uHalf + vec2(uTime * 0.7, -uTime * 0.4)) * 1.6, uStreak);
    float fall = k * k * exp(-p.z / uFade) * (1.0 - smoothstep(uH * 0.6, uH, p.z));
    sum += lit * str * fall * dt;
  }
  gl_FragColor = vec4(uCol * sum * uAmt, 1.0);
}`;

  const volGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  const vols = [...Array(MAXA)].map(() => {
    const m = new THREE.Mesh(
      volGeo,
      new THREE.ShaderMaterial({
        vertexShader: VOL_V,
        fragmentShader: VOL_F,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uCam: { value: new THREE.Vector3() },
          uCol: { value: new THREE.Color() },
          uBox: { value: new THREE.Vector3(1, 1, 1) },
          uHalf: { value: 0.5 },
          uB: { value: 0 },
          uT: { value: 0.3 },
          uD: { value: 1 },
          uH: { value: 2 },
          uFade: { value: 1 },
          uSoft: { value: 0.05 },
          uStreak: { value: 0.5 },
          uStreakScale: { value: 9 },
          uTime: { value: 0 },
          uAmt: { value: 0 },
          uSteps: { value: 40 },
        },
      }),
    );
    m.visible = false;
    m.frustumCulled = false;
    m.renderOrder = 2;
    world.add(m);
    return m;
  });

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const camLocal = new THREE.Vector3();
  const pv = new THREE.Vector3();
  const cornerNdc: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const cornerHit = new THREE.Vector3();

  let W = 1;
  let H = 1;
  let dirty = true;
  let gridFresh = true;
  let tiles: Tile[] = [];
  let gridKey = "";
  let volOff = false;
  let pitch = 1;
  let gCols = S.cols;
  let gRows = S.rows;
  let inst: ThreeNS.InstancedMesh[] = [];
  let coverExt = 9;
  let quality = 1;
  let frames = 0;
  let frameSum = 0;
  let volTime = 0;
  let idleT = 0;
  let autoTile: Tile | null = null;
  let autoT = 0;
  let autoPhase: "pause" | "up" = "pause";
  let pointer: [number, number] | null = null;
  let rawPointer: [number, number] | null = null;
  let tapHold = 0;
  let statusSig = "";
  let disposed = false;
  let onScreen = true;
  let last = performance.now();
  let drewLast = 0;
  let raf = 0;

  function tileHash(a: number, b: number) {
    let h =
      Math.imul(a * 2 + 1000, 73856093) ^
      Math.imul(b * 2 + 1000, 19349663) ^
      Math.imul(S.seed + 7, 83492791);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function cover() {
    camera.updateMatrixWorld();
    let mx = 0;
    let my = 0;
    let far = 0;
    for (const [x, y] of cornerNdc) {
      ndc.set(x, y);
      ray.setFromCamera(ndc, camera);
      let d = ray.ray.distanceToPlane(plane);
      if (d === null || d > 60 * pitch) d = 60 * pitch;
      ray.ray.at(d, cornerHit);
      far = Math.max(far, Math.hypot(cornerHit.x, cornerHit.y));
      cornerHit.applyMatrix4(worldInvU.value);
      mx = Math.max(mx, Math.abs(cornerHit.x));
      my = Math.max(my, Math.abs(cornerHit.y));
    }
    coverExt = far;
    const need = (m: number, min: number) => {
      let n = Math.max(min, Math.ceil(2 * (m / pitch + 1.5)));
      if ((n - min) % 2) n++;
      return Math.min(n, 121);
    };
    gCols = need(mx, S.cols);
    gRows = need(my, S.rows);
  }

  function build() {
    // The grid only changes size when the layout does; rebuilding it on every
    // quality tick would stall low-end devices.
    const key = `${gCols}x${gRows}`;
    if (key === gridKey) return;
    gridKey = key;
    const old = new Map(tiles.map((t) => [`${t.a},${t.b}`, t]));
    inst.forEach((m) => {
      world.remove(m);
      m.geometry.dispose();
      m.dispose();
    });
    pitch = S.tileSize;
    const s = S.tileSize * (1 - S.gap);
    const T = S.tileSize * S.thickness;
    const n = gCols * gRows;
    inst = [0, 1].map((k) => {
      const g = new THREE.BoxGeometry(s, s, T);
      g.setAttribute("aCell", new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2));
      g.setAttribute(
        "aMatch",
        new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage),
      );
      const m = new THREE.InstancedMesh(
        g,
        [sideMat, sideMat, sideMat, sideMat, topMats[k], sideMat],
        n,
      );
      m.castShadow = m.receiveShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      world.add(m);
      return m;
    });
    tiles = [];
    for (let j = 0; j < gRows; j++) {
      for (let i = 0; i < gCols; i++) {
        const a = i - (gCols - 1) / 2;
        const b = j - (gRows - 1) / 2;
        const k = tileHash(a, b) < S.printedShare ? 0 : 1;
        const m = inst[k];
        const prev = old.get(`${a},${b}`);
        const t: Tile = {
          mesh: new THREE.Object3D(),
          inst: m,
          idx: m.count++,
          i,
          j,
          a,
          b,
          cx: a * pitch,
          cy: b * pitch,
          lift: prev?.lift ?? 0,
          target: 0,
          top: 0,
          sig: -1,
          rest: false,
        };
        m.geometry.attributes.aCell.setXY(t.idx, 0, ATL - 1);
        if (prev && autoTile === prev) autoTile = t;
        t.mesh.position.set(t.cx, t.cy, -T / 2);
        tiles.push(t);
      }
    }
    floor.scale.set(gCols * pitch + 4, gRows * pitch + 4, 1);
    floor.position.z = -T - 0.002;
    gridFresh = true;
    dirty = true;
  }

  function layout() {
    W = Math.max(1, root.clientWidth);
    H = Math.max(1, root.clientHeight);
    const budget = Math.sqrt((S.maxPixels * 1e6) / (W * H));
    renderer.setPixelRatio(
      Math.max(0.6, Math.min(window.devicePixelRatio || 1, S.dpr, budget) * quality),
    );
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    dirty = true;
  }

  function adapt(dtMs: number) {
    frames++;
    frameSum += dtMs;
    if (frames < 20) return;
    const avg = frameSum / frames;
    frames = 0;
    frameSum = 0;
    if (avg > 70 && !volOff) {
      // Software rendering or a low-end GPU: drop the volumetric pass first.
      volOff = true;
      quality = 0.6;
      layout();
    } else if (avg > 24 && quality > 0.55) {
      quality = Math.max(0.55, quality * 0.85);
      layout();
    } else if (avg < 15 && quality < 1) {
      quality = Math.min(1, quality * 1.08);
      layout();
    }
  }

  function setStatus(t: Tile | null) {
    const txt = t
      ? copy.active.replace(
          "{id}",
          `${String(t.i).padStart(2, "0")}·${String(t.j).padStart(2, "0")}`,
        )
      : copy.idle;
    if (txt === statusSig) return;
    statusSig = txt;
    statusText.textContent = txt;
    statusEl.classList.toggle("on", Boolean(t));
  }

  function tileUnderPointer(): Tile | null {
    if (!pointer) return null;
    ndc.set((pointer[0] / W) * 2 - 1, 1 - (pointer[1] / H) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    hit.applyMatrix4(worldInvU.value);
    const i = Math.round(hit.x / pitch + (gCols - 1) / 2);
    const j = Math.round(hit.y / pitch + (gRows - 1) / 2);
    if (i < 0 || j < 0 || i >= gCols || j >= gRows) return null;
    return tiles[j * gCols + i] ?? null;
  }

  function pickAuto() {
    const copyRects = [...root.querySelectorAll("[data-hero-block]")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0);
    const rr = root.getBoundingClientRect();
    const pick = (reachX: number, reachY: number, pad: number) =>
      tiles.filter((t) => {
        if (t === autoTile) return false;
        pv.set(t.cx, t.cy, 0).applyMatrix4(world.matrixWorld).project(camera);
        if (Math.abs(pv.x) > reachX || Math.abs(pv.y) > reachY) return false;
        const sx = rr.left + ((pv.x + 1) / 2) * W;
        const sy = rr.top + ((1 - pv.y) / 2) * H;
        if (
          copyRects.some(
            (cr) =>
              sx > cr.left - pad &&
              sx < cr.right + pad &&
              sy > cr.top - pad &&
              sy < cr.bottom + pad,
          )
        )
          return false;
        return true;
      });
    let list = pick(0.6, 0.55, 90);
    if (!list.length) list = pick(0.85, 0.8, 60);
    if (!list.length) list = pick(0.85, 0.8, 0);
    if (!list.length) list = pick(0.85, 0.8, -1e6);
    return list[Math.floor(Math.random() * list.length)] ?? tiles[0];
  }

  function setup() {
    world.rotation.z = (S.gridSpin * Math.PI) / 180;
    world.updateMatrixWorld();
    worldInvU.value.copy(world.matrixWorld).invert();
    camera.fov = S.fov;
    const tl = (S.camTilt * Math.PI) / 180;
    camera.position.set(0, -Math.sin(tl) * S.camDistance, Math.cos(tl) * S.camDistance);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    cover();
    build();
    const se = Math.min(coverExt + 2, 40);
    const sc = key.shadow.camera;
    if (sc.right !== se) {
      Object.assign(sc, { left: -se, right: se, top: se, bottom: -se, far: 2 * (12 + se) });
      sc.updateProjectionMatrix();
    }
    const a = (S.keyAngle * Math.PI) / 180;
    const e = (S.keyHeight * Math.PI) / 180;
    const kd = 12 + se;
    key.position.set(
      Math.cos(a) * Math.cos(e) * kd,
      Math.sin(a) * Math.cos(e) * kd,
      Math.sin(e) * kd,
    );
    key.intensity = S.keyLight;
    key.shadow.radius = S.shadowSoft;
    ambient.intensity = S.ambient;
    sideMat.roughness = S.roughness;
    topMats.forEach((m) => (m.roughness = S.roughness));
  }

  function animate(dt: number, still: boolean, T: number) {
    const hovered = tileUnderPointer();
    if (tapHold > 0) tapHold -= dt;
    const useHover = Boolean(pointer) || tapHold > 0;
    if (!useHover && !still) {
      autoT -= dt;
      if (autoT <= 0) {
        if (autoPhase === "pause") {
          autoTile = pickAuto();
          autoPhase = "up";
          autoT = S.liftTime + S.holdTime;
        } else {
          autoPhase = "pause";
          autoT = S.pauseTime + S.liftTime;
        }
      }
    }
    let moved = false;
    let anyActive = false;
    const act: Tile[] = [];
    for (const t of tiles) {
      t.target = useHover ? (t === hovered ? 1 : 0) : autoPhase === "up" && t === autoTile ? 1 : 0;
      const step = still ? 1 : dt / Math.max(0.05, S.liftTime);
      t.lift = still
        ? t.target
        : t.target > t.lift
          ? clamp01(Math.min(t.target, t.lift + step))
          : clamp01(Math.max(t.target, t.lift - step));
      const eased = ease(t.lift);
      if (eased > 0.002) act.push(t);
      const active = eased > 0;
      if (active) anyActive = true;
      if (!active && t.rest && !gridFresh) continue;
      t.rest = !active;
      const up = still ? 0 : eased * eased;
      const ph = idleT * S.idleSpeed * Math.PI * 2 + t.a * 1.3 + t.b * 2.1;
      const bob = Math.sin(ph) * S.idleFloat * S.tileSize * up;
      const sway = ((S.idleTilt * Math.PI) / 180) * up;
      t.mesh.rotation.set(Math.sin(ph * 0.73 + 1.1) * sway, Math.sin(ph * 0.61 + 2.3) * sway, 0);
      t.mesh.position.z = -T / 2 + eased * S.liftHeight * S.tileSize + bob;
      t.top = t.mesh.position.z + T / 2;
      const sig = eased * 7.3 + bob * 13 + (up ? ph : 0);
      if (sig !== t.sig || gridFresh) {
        t.sig = sig;
        moved = true;
        t.mesh.updateMatrix();
        t.inst.setMatrixAt(t.idx, t.mesh.matrix);
        t.inst.geometry.attributes.aMatch.array[t.idx] = Math.min(1, eased);
      }
    }
    gridFresh = false;
    if (moved) {
      inst.forEach((m) => {
        m.instanceMatrix.needsUpdate = true;
        m.geometry.attributes.aMatch.needsUpdate = true;
      });
      renderer.shadowMap.needsUpdate = true;
    }
    volTime += still ? 0 : dt * S.volDrift;
    idleT += still ? 0 : dt;
    matchGlowU.value = S.matchGlow;
    act.sort((p, q) => q.lift - p.lift);
    act.length = Math.min(act.length, MAXA);
    setStatus(act[0] && act[0].lift > 0.5 && act[0].target > 0 ? act[0] : null);
    const gc = glowC.set(C.gold);
    glowU.uHalf.value = (S.tileSize * (1 - S.gap)) / 2;
    glowU.uThick.value = T;
    glowU.uGlowC.value.copy(gc);
    glowU.uBlockGlow.value = S.blockGlow;
    glowU.uWallGlow.value = S.wallGlow;
    glowU.uWallH.value = S.wallGlowHeight;
    glowU.uPitGlow.value = S.pitGlow;
    for (let i = 0; i < MAXA; i++) {
      const t = act[i];
      const l = t ? Math.pow(Math.min(1, t.lift), S.lightRamp) : 0;
      const z = t ? t.top : 0;
      if (t) glowU.uAC.value[i].set(t.cx, t.cy);
      glowU.uAL.value[i] = l;
      glowU.uAZ.value[i] = z;
      const pl = pitLights[i];
      pl.color.copy(gc);
      pl.intensity = S.pitLight * l;
      pl.distance = pitch * 2.2;
      if (t) pl.position.set(t.cx, t.cy, -T * 0.55);
      const v = vols[i];
      v.visible = Boolean(t) && S.volLight > 0 && !volOff;
      if (t) {
        const u = v.material.uniforms;
        const half = (S.tileSize * (1 - S.gap)) / 2;
        const D = S.volSource * pitch;
        const Hh = S.volHeight * pitch;
        const bw = 2 * ((half * (D + Hh)) / D + S.volSoft * pitch * (1 + Hh / D) * 2);
        v.position.set(t.cx, t.cy, 0);
        v.scale.set(bw, bw, Hh);
        u.uBox.value.set(bw, bw, Hh);
        camLocal.copy(camera.position);
        world.worldToLocal(camLocal);
        camLocal.x -= t.cx;
        camLocal.y -= t.cy;
        u.uCam.value.copy(camLocal);
        u.uCol.value.copy(gc);
        u.uHalf.value = half;
        u.uB.value = z - T;
        u.uT.value = T;
        u.uD.value = D;
        u.uH.value = Hh;
        u.uFade.value = S.volFade * pitch;
        u.uSoft.value = S.volSoft * pitch;
        u.uStreak.value = S.volStreaks;
        u.uStreakScale.value = S.volStreakScale;
        u.uTime.value = volTime;
        u.uAmt.value = S.volLight * l * 12;
        u.uSteps.value = Math.round(S.volSteps);
      }
    }
    return moved || (!still && anyActive && S.volLight > 0);
  }

  function tick(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!onScreen) return;
    if (rawPointer) {
      const r = root.getBoundingClientRect();
      pointer = [rawPointer[0] - r.left, rawPointer[1] - r.top];
      rawPointer = null;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const still = reduced.matches;
    if (dirty) setup();
    const moving = animate(dt, still, S.tileSize * S.thickness);
    if (moving || dirty) {
      if (dirty) renderer.shadowMap.needsUpdate = true;
      if (drewLast) adapt(now - drewLast);
      renderer.render(scene, camera);
      dirty = false;
      drewLast = now;
    } else {
      drewLast = 0;
    }
  }

  const overCopy = (e: PointerEvent) =>
    Boolean((e.target as HTMLElement | null)?.closest?.("[data-hero-block]"));

  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (overCopy(e)) {
      rawPointer = null;
      pointer = null;
      return;
    }
    rawPointer = [e.clientX, e.clientY];
  };
  const onPointerLeave = () => {
    pointer = null;
    rawPointer = null;
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" && !overCopy(e) && !(e.target as HTMLElement)?.closest?.("a")) {
      rawPointer = [e.clientX, e.clientY];
      tapHold = 2.5;
    }
  };

  root.addEventListener("pointermove", onPointerMove);
  root.addEventListener("pointerleave", onPointerLeave);
  root.addEventListener("pointerdown", onPointerDown);
  const resize = new ResizeObserver(layout);
  resize.observe(root);
  const visible = new IntersectionObserver(([en]) => {
    onScreen = en.isIntersecting;
    if (onScreen) {
      last = performance.now();
      dirty = true;
    }
  });
  visible.observe(root);

  layout();
  setStatus(null);
  raf = requestAnimationFrame(tick);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    resize.disconnect();
    visible.disconnect();
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("pointerleave", onPointerLeave);
    root.removeEventListener("pointerdown", onPointerDown);
    inst.forEach((m) => {
      m.geometry.dispose();
      m.dispose();
    });
    topMats.forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
    sideMat.map?.dispose();
    sideMat.dispose();
    floorMat.dispose();
    floor.geometry.dispose();
    volGeo.dispose();
    vols.forEach((v) => (v.material as ThreeNS.ShaderMaterial).dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  };
}

export function RisingTileHero() {
  const { t } = useI18n();
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const statusTextRef = useRef<HTMLSpanElement>(null);

  const statusIdle = t("hero.statusIdle");
  const statusActive = t("hero.statusActive");

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const status = statusRef.current;
    const text = statusTextRef.current;
    if (!root || !canvas || !status || !text) return;
    if (typeof window === "undefined" || !window.WebGLRenderingContext) {
      canvas.hidden = true;
      return;
    }
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    // Loaded on demand: the artwork is decorative and must not delay the page.
    import("three")
      .then((THREE) => {
        if (cancelled) return;
        cleanup = mountScene(THREE, root, canvas, status, text, {
          idle: statusIdle,
          active: statusActive,
        });
      })
      .catch((error) => {
        // No WebGL or a broken driver: the static grid behind the canvas stays.
        canvas.hidden = true;
        if (import.meta.env.DEV) console.warn("Rising tile hero: WebGL unavailable", error);
      });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [statusIdle, statusActive]);

  const specs: { label: string; value: string }[] = [
    { label: t("hero.specReadings"), value: t("hero.specReadingsValue") },
    { label: t("hero.specAlerts"), value: t("hero.specAlertsValue") },
    { label: t("hero.specLanguages"), value: t("hero.specLanguagesValue") },
  ];

  return (
    <section
      ref={rootRef}
      aria-labelledby="rt-title"
      className="rising-tile relative my-8 h-[clamp(560px,72vh,720px)] w-full overflow-clip bg-background"
    >
      <div aria-hidden="true" className="rising-grid pointer-events-none absolute inset-0 z-0" />
      <canvas ref={canvasRef} className="absolute inset-0 z-0 block size-full" aria-hidden="true" />
      {/* Scrims keep the copy readable over a moving grid. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[58%] bg-gradient-to-t from-background via-background/70 to-transparent opacity-90"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[30%] bg-gradient-to-b from-background via-background/65 to-transparent"
      />
      <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col justify-between py-8">
        <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-6 px-4 sm:px-6">
          <div data-hero-block className="pointer-events-auto">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {t("hero.eyebrow")}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{t("hero.tagline")}</p>
            <p
              ref={statusRef}
              className="rising-status mt-4 flex items-center gap-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em]"
              aria-live="off"
            >
              <span aria-hidden="true" className="rising-dot size-[7px] shrink-0 rounded-full" />
              <span ref={statusTextRef} />
            </p>
          </div>
          <dl
            data-hero-block
            className="pointer-events-auto hidden gap-7 min-[760px]:flex"
            aria-label={t("hero.specsLabel")}
          >
            {specs.map((s) => (
              <div key={s.label} className="border-s border-border ps-3">
                <dt className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {s.label}
                </dt>
                <dd className="mt-1.5 text-base font-medium text-foreground">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 text-center sm:px-6">
          <h2
            id="rt-title"
            data-hero-block
            className="pointer-events-auto font-display text-[clamp(2.1rem,7vw,4.6rem)] font-normal leading-[0.95] tracking-[-0.035em] text-foreground"
          >
            <span className="block">{t("hero.titleLine1")}</span>
            <span className="block">{t("hero.titleLine2")}</span>
          </h2>
          <Link
            data-hero-block
            to="/monitor"
            className="rising-cta pointer-events-auto inline-flex min-h-14 items-center rounded-full bg-primary px-7 text-base font-semibold text-primary-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
          >
            {t("hero.cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
