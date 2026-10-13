// Keeps the frame rate up on slow devices by shrinking the simulation, one step at a time.

export const LEVELS = [
  { sim: 128, dye: 512 },
  { sim: 96, dye: 384 },
  { sim: 64, dye: 256 },
];
export const WINDOW = 60;
const SLOW_MS = 20, FAST_MS = 12;

/** Decides from the last frame times (ms) whether to shrink, grow or keep the sim at `level`. */
export function governor(samples: number[], level: number): "up" | "hold" | "down" {
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  if (median > SLOW_MS && level < LEVELS.length - 1) return "down";
  if (median < FAST_MS && level > 0) return "up";
  return "hold";
}
