import { describe, expect, it } from "vitest";
import { cellMask } from "../src/mask";

describe("cellMask", () => {
  it("marks the cells under a line of text, with a small pad", () => {
    const cols = 40, rows = 20;
    const m = cellMask([{ left: 31, top: 51, right: 100, bottom: 68 }], cols, rows, { w: 7, h: 12 });
    expect(m.length).toBe(cols * rows);
    const marked: [number, number][] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (m[r * cols + c] === 255) marked.push([c, r]);
    expect(new Set(marked.map(([, r]) => r))).toEqual(new Set([3, 4, 5, 6]));
    for (const [c] of marked) { expect(c).toBeGreaterThanOrEqual(2); expect(c).toBeLessThanOrEqual(16); }
  });
  it("ignores rectangles off the grid", () => {
    const m = cellMask([{ left: -500, top: -500, right: -400, bottom: -400 }], 10, 10, { w: 7, h: 12 });
    expect(m.every((v) => v === 0)).toBe(true);
  });
});

describe("cellMask feather", () => {
  it("fades outward from a feathered rectangle", () => {
    const cols = 60, rows = 4, cell = { w: 10, h: 10 };
    const m = cellMask([{ left: 0, top: 0, right: 100, bottom: 40, feather: 200 }], cols, rows, cell);
    const row = Array.from({ length: cols }, (_, c) => m[1 * cols + c]);
    expect(row[5]).toBe(255);                       // inside
    expect(row[14]).toBeGreaterThan(row[20]);        // fading with distance
    expect(row[20]).toBeGreaterThan(row[28]);
    expect(row[20]).toBeGreaterThan(0);
    expect(row[40]).toBe(0);                         // beyond the feather
    for (let c = 1; c < cols; c++) if (c > 12) expect(row[c]).toBeLessThanOrEqual(row[c - 1]);
  });
  it("keeps the strongest value where rectangles overlap", () => {
    const m = cellMask([{ left: 0, top: 0, right: 50, bottom: 50, feather: 100 }, { left: 0, top: 0, right: 200, bottom: 50 }], 30, 5, { w: 10, h: 10 });
    expect(m[2 * 30 + 15]).toBe(255);
  });
});
