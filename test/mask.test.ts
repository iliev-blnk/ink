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
