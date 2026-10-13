// mountInk: wires the fluid, the glyph pass, the stirring and the looks to one canvas.
import { CELL, drawAtlas, uploadAtlas } from "./atlas";
import { createFluid } from "./fluid";
import { createGL } from "./gl";
import { createGlyphPass, type Grid } from "./glyphs";
import { cellMask, type DOMRectLike } from "./mask";
import { clampDt, ghostAt, owner } from "./stir";
import { LOOKS, dyeColour, lookFor, type LookName } from "./themes";

export { LOOKS, lookFor } from "./themes";
export type { DOMRectLike } from "./mask";

export interface InkOptions {
  /** Rectangles (CSS px, viewport) the ink should leave as paper, such as the page's text. */
  mask?: () => DOMRectLike[];
  /** Font used to draw the glyphs. */
  font?: string;
  /** Force a look instead of following `prefers-color-scheme`. */
  look?: LookName;
  /** Seed for the opening drops, so screenshots repeat. */
  seed?: number;
}

export interface Ink {
  destroy(): void;
  refreshMask(): void;
}

const POINTER = { amount: 0.45, radius: 0.0001, force: 6000 };
const GHOST = { amount: 0.22, radius: 0.00008, force: 5200 };
const SEED = { drops: 6, amount: 0.55, radius: 0.0012, force: 900 };

function random(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function mountInk(canvas: HTMLCanvasElement, opts: InkOptions = {}): Ink {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("ink: WebGL2 is not available");
  const core = createGL(gl);
  const fluid = createFluid(core);
  const glyphs = createGlyphPass(core, uploadAtlas(gl, drawAtlas(opts.font ?? '"IBM Plex Mono", ui-monospace, monospace')));
  const dark = matchMedia("(prefers-color-scheme: dark)");
  let look = LOOKS[opts.look ?? lookFor(dark.matches)];

  let width = 0, height = 0, dpr = 1;
  const grid: Grid = { cols: 0, rows: 0, cellW: CELL.w, cellH: CELL.h };

  function refreshMask() {
    const rects = opts.mask ? opts.mask() : [];
    glyphs.setMask(cellMask(rects, grid.cols, grid.rows, CELL), grid.cols, grid.rows);
  }

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    width = canvas.clientWidth || innerWidth;
    height = canvas.clientHeight || innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    grid.cols = Math.ceil(width / CELL.w);
    grid.rows = Math.ceil(height / CELL.h);
    fluid.resize(width, height);
    refreshMask();
    seed();
  }

  const rand = random(opts.seed ?? Date.now());
  function seed() {
    for (let i = 0; i < SEED.drops; i++) {
      fluid.splat(0.55 + rand() * 0.3, 0.3 + rand() * 0.4, (rand() - 0.5) * SEED.force, (rand() - 0.5) * SEED.force,
        dyeColour(look, i, SEED.amount), SEED.radius);
    }
  }

  const ptr = { x: 0, y: 0, px: -1, py: -1, moved: false, last: -Infinity };
  let ink = 0;
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ptr.x = (e.clientX - r.left) / r.width;
    ptr.y = 1 - (e.clientY - r.top) / r.height;
    ptr.moved = true;
    ptr.last = performance.now();
  };
  const onDown = () => { ink++; };
  addEventListener("pointermove", onMove);
  addEventListener("pointerdown", onDown);

  let ghostT = 0, ghost = ghostAt(0), prev = 0, frame = 0;
  function tick(now: number) {
    const dt = clampDt(prev ? now - prev : 16);
    prev = now;
    if (ptr.moved) {
      if (ptr.px >= 0) {
        fluid.splat(ptr.x, ptr.y, (ptr.x - ptr.px) * POINTER.force, (ptr.y - ptr.py) * POINTER.force,
          dyeColour(look, ink, POINTER.amount), POINTER.radius);
      }
      ptr.px = ptr.x; ptr.py = ptr.y; ptr.moved = false;
    }
    if (owner(now, ptr.last) === "ghost") {
      ghostT += dt;
      const next = ghostAt(ghostT);
      fluid.splat(next.x, next.y, (next.x - ghost.x) * GHOST.force, (next.y - ghost.y) * GHOST.force,
        dyeColour(look, Math.floor(ghostT / 9), GHOST.amount), GHOST.radius);
      ghost = next;
    }
    fluid.step(dt);
    glyphs.draw(fluid.dye, grid, look, dpr);
    frame = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  frame = requestAnimationFrame(tick);

  return {
    refreshMask,
    destroy() {
      cancelAnimationFrame(frame);
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerdown", onDown);
      fluid.destroy();
      glyphs.destroy();
    },
  };
}
