import { describe, expect, it } from "vitest";
import { LEVELS, governor } from "../src/quality";

const frames = (ms: number) => Array.from({ length: 60 }, () => ms);

describe("governor", () => {
  it("steps down when frames are slow", () => {
    expect(governor(frames(25), 0)).toBe("down");
  });
  it("steps back up when frames are fast at a reduced size", () => {
    expect(governor(frames(8), 1)).toBe("up");
  });
  it("never goes above the default size", () => {
    expect(governor(frames(8), 0)).toBe("hold");
  });
  it("never goes below the smallest size", () => {
    expect(governor(frames(40), LEVELS.length - 1)).toBe("hold");
  });
  it("holds in between", () => {
    expect(governor(frames(15), 1)).toBe("hold");
  });
  it("uses the median, so one hitch doesn't count", () => {
    const f = frames(10); f[3] = 400;
    expect(governor(f, 0)).toBe("hold");
  });
  it("has the agreed sizes", () => {
    expect(LEVELS).toEqual([{ sim: 128, dye: 512 }, { sim: 96, dye: 384 }, { sim: 64, dye: 256 }]);
  });
});
