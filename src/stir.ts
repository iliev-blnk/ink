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

/** A slow Lissajous path in page units (0..1, y up), biased to the right where the text isn't. */
export function ghostAt(t: number): { x: number; y: number } {
  return {
    x: 0.66 + 0.2 * Math.sin(t * 0.31) * Math.cos(t * 0.17),
    y: 0.5 + 0.3 * Math.sin(t * 0.23 + 1.3),
  };
}
