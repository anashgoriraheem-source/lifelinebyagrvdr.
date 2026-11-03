/**
 * The world as land/sea, once, for everything that draws a map.
 *
 * `LAND_RLE` is a run-length encoded 2° land/sea grid of the real world
 * (Natural Earth 110m, public domain), 180 × 90 cells, row 0 at the north pole.
 * It is the only source of the continents on the location globe and on the
 * session board; both read their coordinates through the same equirectangular
 * mapping, so a real latitude/longitude lands where the place is.
 *
 * Format: base-36 run lengths separated by dots, left to right then top to
 * bottom, alternating SEA then LAND. Must total 16200 cells with 5392 land.
 */
export const LAND_RLE =
  "gd.8.b.a.41.1.1.b.2.p.1i.1.27.2.4.3.1.5.4.o.g.5.11.4.1w.2.a.1.2.5.4.r.h.1.16.2.1z.3.3.1.1.1.1.6.b.j.12.2.d.d.d.3.1.2.17.3.1.1.3.1.3.1.1.2.1.4.1.2.a.h.11.2.c.l.1.2.q.1.a.2.f.1.2.7.4.2.2.8.a.d.1.1.n.2.d.1.5.3.1.s.1.a.2.1.a.1.8.d.1.9.2.3.2.1.2.1.1.3.1.2.3.4.8.d.m.9.c.3.1.2.1.1b.1.8.5.15.4.5.5.a.o.e.1.1.1.c.1.1h.2.2.3.13.1.1.3.6.7.6.9.4.d.5.2.4.1.1.1.1y.8.11.9.2.1.1.7.4.p.5.2.27.7.7.1.s.8.4.b.3.o.6.2.1v.2.1.1.4.d.4.8.m.8.4.2.1.z.6.3.1n.5.1.3.1.k.1.b.m.7.7.s.2.5.1.1.2.3.1m.9.4.g.1.g.o.2.a.p.3.5.1.5.1m.a.3.y.o.2.b.n.2.1.2.2.1y.6.1.11.10.q.2.1.1x.1.1.19.1.1.r.1.1.3.2.q.1z.1.1.1a.u.5.1.p.1y.2.1.1a.s.1.2.u.7.1.8.2.1.1.5.2.16.1e.r.u.7.3.2.2.5.6.4.2.15.3.2.1a.q.w.4.4.1.2.2.1.4.1.a.2.12.5.1.1b.o.x.5.8.1.1.2.1.c.2.w.4.1.6.1.1c.n.z.2.4.3.1.1.6.b.2.y.2.2.3.2.1e.m.z.8.7.1.3.1.1.16.3.1.2.4.1f.j.10.a.c.16.5.2.1j.h.10.e.1.4.1.1a.1r.8.7.1.z.t.1.10.1q.1.1.6.8.1.x.o.1.7.2.x.1s.1.1.5.16.o.2.7.1.1.5.r.1v.4.7.2.w.q.1.b.5.n.2.1.1u.4.4.2.4.1.t.s.1.9.6.9.2.8.22.4.2.2.8.1.r.r.2.8.7.6.5.6.1.1.23.6.10.r.2.6.a.4.6.7.6.1.21.4.x.t.1.4.c.3.9.5.6.1.23.2.y.t.1.1.e.3.9.6.5.1.24.1.4.4.q.u.2.2.c.2.9.1.2.2.8.1.23.1.1.1.1.8.n.w.d.1.1.1.8.1.2.1.2g.a.n.v.f.1.l.1.26.d.l.2.1.1.4.l.o.1.1.2.5.2.2a.e.u.i.q.1.1.1.4.3.29.f.u.h.r.2.4.4.1.1.27.h.r.h.t.2.3.4.6.2.21.k.p.f.v.2.2.3.1.2.3.1.1.1.1.3.1w.n.o.e.w.1.8.1.7.4.1v.n.n.e.x.3.d.5.4.1.1q.l.o.e.12.1.3.1.7.2.1.1.6.1.1o.k.q.d.3e.j.p.e.4.1.14.3.3.1.1y.j.p.e.4.1.11.6.3.2.a.1.1o.g.q.d.3.3.10.8.2.2.20.f.q.c.4.3.10.c.20.f.r.b.4.2.y.h.7.1.1q.d.t.b.4.2.x.i.1y.b.v.a.5.1.y.j.1x.b.w.8.15.k.1v.b.x.8.15.k.1v.b.y.6.17.j.1v.a.z.5.18.4.5.9.1w.7.2f.1.a.6.b.1.1k.9.2q.5.c.1.1j.6.3a.2.1i.4.1.1.2v.2.c.2.1k.4.2x.1.b.2.1k.4.39.2.1l.4.4v.4.1w.1.2z.3.4y.3.4y.2.p2.1.4x.2.1l.4.f.1.5.9.2.c.21.2.1d.1.2.f.4.13.1u.5.w.x.2.1c.18.3.4.1.a.4.n.2k.p.g.1.1.2.i.n.2k.m.10.o.2p.h.1.2.13.e.3.4.2s.o.13.9.1.7.2q.n.4g.7.9.9.ei";

export const GRID_W = 180;
export const GRID_H = 90;
export const LAND_CELLS = 5392;

let mask: Uint8Array | null = null;

/**
 * Expands the runs, then checks the totals: a damaged string still decodes to
 * something, which is how you end up with a map with no continents.
 */
export function landMask() {
  if (mask) return mask;
  const cells = GRID_W * GRID_H;
  const out = new Uint8Array(cells);
  let at = 0;
  let isLand = 0;
  let land = 0;
  for (const run of LAND_RLE.split(".")) {
    const n = parseInt(run, 36);
    if (!(n >= 0)) throw new Error(`bad run "${run}"`);
    if (isLand) {
      land += n;
      for (let k = 0; k < n && at + k < cells; k++) out[at + k] = 1;
    }
    at += n;
    isLand ^= 1;
  }
  if (at !== cells) throw new Error(`runs cover ${at} cells, expected ${cells}`);
  if (land !== LAND_CELLS) throw new Error(`${land} land cells, expected ${LAND_CELLS}`);
  mask = out;
  return mask;
}

/** Land/sea at a real coordinate, through the equirectangular grid. */
export function landAt(lat: number, lon: number) {
  let m: Uint8Array | null = null;
  try {
    m = landMask();
  } catch (error) {
    if (typeof console !== "undefined") {
      console.error(
        "[land-grid] LAND_RLE is damaged, so the maps have no continents. " +
          "It must be copied exactly as written. (" +
          (error as Error).message +
          ")",
      );
    }
    return false;
  }
  const r = Math.min(GRID_H - 1, Math.max(0, Math.floor((90 - lat) / 2)));
  const c = Math.min(GRID_W - 1, Math.max(0, Math.floor((lon + 180) / 2)));
  return m[r * GRID_W + c] === 1;
}
