import { describe, expect, it } from "vitest";
import { clampDt, ghostAt, owner } from "../src/stir";

describe("stir", () => {
  it("clamps a long frame to 1/30 s", () => {
    expect(clampDt(500)).toBeCloseTo(1 / 30);
    expect(clampDt(16)).toBeCloseTo(0.016);
  });
  it("hands the ink to the ghost 2.5 s after the last pointer move", () => {
    expect(owner(10000, 7000)).toBe("ghost");
    expect(owner(10000, 8000)).toBe("pointer");
  });
  it("stirs the lower middle of a tall screen", () => {
    for (let t = 0; t <= 600; t += 0.5) {
      const { x, y } = ghostAt(t, true);
      expect(x).toBeGreaterThanOrEqual(0.2);
      expect(x).toBeLessThanOrEqual(0.8);
      expect(y).toBeLessThanOrEqual(0.4);
    }
  });
  it("keeps the ghost on the page", () => {
    for (let t = 0; t <= 600; t += 0.5) {
      const { x, y } = ghostAt(t);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });
});

import { strokeDelta } from "../src/stir";
describe("strokeDelta", () => {
  it("pushes along the cursor's path between close moves", () => {
    expect(strokeDelta({ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.49 }, 16)).toEqual({ dx: expect.closeTo(0.02), dy: expect.closeTo(-0.01) });
  });
  it("doesn't fling the ink when the cursor comes back after a pause", () => {
    expect(strokeDelta({ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }, 400)).toEqual({ dx: 0, dy: 0 });
  });
  it("starts from rest on the first move", () => {
    expect(strokeDelta(null, { x: 0.4, y: 0.4 }, 16)).toEqual({ dx: 0, dy: 0 });
  });
});
