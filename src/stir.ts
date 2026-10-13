// Who stirs the ink, and how the unseen hand moves when nobody does.

/** After this long without a pointer move, the ghost takes over. */
export const IDLE_MS = 2500;

/** Frame time in seconds, never more than 1/30 so a hidden tab can't blow up the sim. */
export function clampDt(ms: number): number {
  return Math.min(1 / 30, Math.max(0, ms) / 1000);
}

export function owner(now: number, lastPointer: number): "pointer" | "ghost" {
  return now - lastPointer > IDLE_MS ? "ghost" : "pointer";
}

/**
 * A slow Lissajous path in page units (0..1, y up), kept where the text usually isn't:
 * the right side on a wide screen, the lower middle on a tall one.
 */
export function ghostAt(t: number, portrait = false): { x: number; y: number } {
  const u = Math.sin(t * 0.31) * Math.cos(t * 0.17), v = Math.sin(t * 0.23 + 1.3);
  return portrait ? { x: 0.5 + 0.3 * u, y: 0.24 + 0.16 * v } : { x: 0.66 + 0.2 * u, y: 0.5 + 0.3 * v };
}
