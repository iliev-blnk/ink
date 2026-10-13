// mountInk: wires the fluid, the glyph pass, the stirring and the looks to one canvas.
import { CELL, drawAtlas, uploadAtlas } from "./atlas";
import { createFluid } from "./fluid";
import { createGL } from "./gl";
import { createGlyphPass, type Grid } from "./glyphs";
import { cellMask, type DOMRectLike } from "./mask";
import { LEVELS, WINDOW, governor } from "./quality";
import { STILL } from "./still";
import { clampDt, ghostAt, owner, strokeDelta } from "./stir";
import { LOOKS, dyeColour, lookFor, type LookName } from "./themes";

export { LOOKS, lookFor } from "./themes";
export type { DOMRectLike } from "./mask";
export type { LookName } from "./themes";

export interface InkOptions {
  /** Rectangles (CSS px, viewport) the ink should leave as paper, such as the page's text. */
  mask?: () => DOMRectLike[];
  /** Font used to draw the glyphs. */
  font?: string;
  /** Force a look instead of following `prefers-color-scheme`. */
  look?: LookName;
  /** Seed for the opening drops, so screenshots repeat. */
  seed?: number;
  /** Shown with a still frame of ink when WebGL2 isn't available. */
  fallback?: HTMLElement;
  /** Scales every drop's size and amount; above 1 for a small canvas such as a header band. */
  strength?: number;
  /** Where the unseen hand stirs at time t (seconds), in 0..1 page units with y up. Defaults to `ghostAt`. */
  ghost?: (t: number, portrait: boolean) => { x: number; y: number };
}

export interface Ink {
  destroy(): void;
  refreshMask(): void;
  /** "live", "still" (reduced motion) or "fallback" (no WebGL2). */
  readonly mode: "live" | "still" | "fallback";
  /** Force a look, for a page's own theme toggle; null follows the system again. */
  setLook(look: LookName | null): void;
}

const POINTER = { amount: 0.45, radius: 0.0001, force: 6000 };
const GHOST = { amount: 0.22, radius: 0.00008, force: 5200 };
const SEED = { drops: 6, amount: 0.55, radius: 0.0012, force: 900 };
/** Seconds of unseen stirring run before a reduced-motion still is drawn. */
const STILL_STEPS = 240;

function random(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function showFallback(canvas: HTMLCanvasElement, el: HTMLElement | undefined, look: LookName): Ink {
  canvas.hidden = true;
  if (el) {
    el.textContent = STILL[look];
    const [r, g, b] = LOOKS[look].inks[0].map((c) => Math.round(c * 255));
    el.style.color = `rgb(${r} ${g} ${b})`;
    el.hidden = false;
  }
  const paint = (name: LookName) => {
    if (!el) return;
    const [r, g, b] = LOOKS[name].inks[0].map((c) => Math.round(c * 255));
    el.style.color = `rgb(${r} ${g} ${b})`;
    el.textContent = STILL[name];
  };
  return {
    destroy() {}, refreshMask() {}, mode: "fallback",
    setLook(name) { paint(name ?? lookFor(matchMedia("(prefers-color-scheme: dark)").matches)); },
  };
}

export function mountInk(canvas: HTMLCanvasElement, opts: InkOptions = {}): Ink {
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  let lookName: LookName = opts.look ?? lookFor(dark.matches);
  const k = opts.strength ?? 1;
  let look = LOOKS[lookName];

  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return showFallback(canvas, opts.fallback, lookName);
  const core = createGL(gl);
  const fluid = createFluid(core);
  const glyphs = createGlyphPass(core, uploadAtlas(gl, drawAtlas(opts.font ?? '"IBM Plex Mono", ui-monospace, monospace')));
  canvas.style.touchAction = "none";
  canvas.setAttribute("aria-hidden", "true");

  let width = 0, height = 0, dpr = 0, level = 0;
  const grid: Grid = { cols: 0, rows: 0, cellW: CELL.w, cellH: CELL.h };

  function refreshMask() {
    glyphs.setMask(cellMask(opts.mask ? opts.mask() : [], grid.cols, grid.rows, CELL), grid.cols, grid.rows);
  }

  const rand = random(opts.seed ?? Date.now());
  function seed() {
    for (let i = 0; i < SEED.drops; i++) {
      const tall = height > width;
      fluid.splat(tall ? 0.25 + rand() * 0.5 : 0.55 + rand() * 0.3, tall ? 0.1 + rand() * 0.3 : 0.3 + rand() * 0.4,
        (rand() - 0.5) * SEED.force, (rand() - 0.5) * SEED.force,
        dyeColour(look, i, SEED.amount), SEED.radius * k);
    }
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight, d = Math.min(2, devicePixelRatio || 1);
    if (w === width && h === height && d === dpr) return;
    dpr = d; width = w; height = h;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    grid.cols = Math.ceil(width / CELL.w);
    grid.rows = Math.ceil(height / CELL.h);
    fluid.resize(width, height, LEVELS[level].sim, LEVELS[level].dye);
    refreshMask();
    seed();
    if (mode === "still") drawStill();
  }

  // Input: the visitor stirs, a click changes the ink.
  const ptr = { x: 0, y: 0, prev: null as { x: number; y: number } | null, moved: false, last: -Infinity, gap: 0 };
  let ink = 0;
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = (e.clientX - r.left) / r.width;
    ptr.y = 1 - (e.clientY - r.top) / r.height;
    const now = performance.now();
    ptr.gap = now - ptr.last;
    ptr.moved = true;
    ptr.last = now;
  };
  const onDown = () => { ink++; };

  let ghostT = 0, ghost = (opts.ghost ?? ghostAt)(0, false);
  function stirGhost(dt: number) {
    ghostT += dt;
    const next = (opts.ghost ?? ghostAt)(ghostT, height > width);
    fluid.splat(next.x, next.y, (next.x - ghost.x) * GHOST.force, (next.y - ghost.y) * GHOST.force,
      dyeColour(look, Math.floor(ghostT / 9), GHOST.amount * Math.min(k, 2)), GHOST.radius * k);
    ghost = next;
  }

  // Reduced motion: let the ghost stir for a few simulated seconds, draw once, stop.
  function drawStill() {
    for (let i = 0; i < STILL_STEPS; i++) { stirGhost(1 / 60); fluid.step(1 / 60); }
    glyphs.draw(fluid.dye, grid, look, dpr);
  }

  const times: number[] = [];
  let cooldown = 0;
  function govern(ms: number) {
    times.push(ms);
    if (times.length < WINDOW) return;
    const call = cooldown > 0 ? "hold" : governor(times, level);
    times.length = 0;
    cooldown = Math.max(0, cooldown - 1);
    if (call === "hold") return;
    level += call === "down" ? 1 : -1;
    cooldown = 3;
    fluid.resize(width, height, LEVELS[level].sim, LEVELS[level].dye);
    seed();
  }

  let prev = 0, frame = 0, running = false;
  function tick(now: number) {
    const raw = prev ? now - prev : 16;
    const dt = clampDt(raw);
    prev = now;
    if (ptr.moved) {
      const at = { x: ptr.x, y: ptr.y }, { dx, dy } = strokeDelta(ptr.prev, at, ptr.gap);
      fluid.splat(at.x, at.y, dx * POINTER.force, dy * POINTER.force, dyeColour(look, ink, POINTER.amount), POINTER.radius * k);
      ptr.prev = at; ptr.moved = false;
    }
    if (owner(now, ptr.last) === "ghost") stirGhost(dt);
    fluid.step(dt);
    glyphs.draw(fluid.dye, grid, look, dpr);
    govern(raw);
    frame = requestAnimationFrame(tick);
  }
  function start() { if (!running && mode === "live") { running = true; prev = 0; frame = requestAnimationFrame(tick); } }
  function stop() { running = false; cancelAnimationFrame(frame); }

  let mode: Ink["mode"] = calm.matches ? "still" : "live";
  let visible = true;
  const sync = () => (visible && !document.hidden ? start() : stop());
  const io = new IntersectionObserver((e) => { visible = e[e.length - 1].isIntersecting; sync(); });
  let forced: LookName | null = opts.look ?? null;
  function applyLook(name: LookName) {
    if (name === lookName) return;
    lookName = name;
    look = LOOKS[lookName];
    fluid.clearDye();
    seed();
    if (mode === "still") drawStill();
  }
  const onTheme = () => { if (!forced) applyLook(lookFor(dark.matches)); };
  const onCalm = () => { mode = calm.matches ? "still" : "live"; if (mode === "still") { stop(); drawStill(); } else sync(); };

  addEventListener("pointermove", onMove);
  addEventListener("pointerdown", onDown);
  document.addEventListener("visibilitychange", sync);
  dark.addEventListener("change", onTheme);
  calm.addEventListener("change", onCalm);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  io.observe(canvas);
  resize();
  if (mode === "still") drawStill(); else start();

  return {
    refreshMask,
    get mode() { return mode; },
    setLook(name) { forced = name; applyLook(name ?? lookFor(dark.matches)); },
    destroy() {
      stop();
      ro.disconnect(); io.disconnect();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", sync);
      dark.removeEventListener("change", onTheme);
      calm.removeEventListener("change", onCalm);
      fluid.destroy();
      glyphs.destroy();
    },
  };
}
