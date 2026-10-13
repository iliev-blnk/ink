import { describe, expect, it } from "vitest";
import { LOOKS, dyeColour, lookFor } from "../src/themes";

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 2));

describe("themes", () => {
  it("is night in dark mode and blue in light mode", () => {
    expect(lookFor(true)).toBe("night");
    expect(lookFor(false)).toBe("blue");
  });
  it("stores absorbance on paper", () => {
    close(dyeColour(LOOKS.blue, 0, 1), [1 - 0.102, 1 - 0.22, 1 - 0.702]);
  });
  it("stores light at night", () => {
    close(dyeColour(LOOKS.night, 0, 0.5), [0.5, 0.275, 0.1]);
  });
  it("cycles through a look's inks", () => {
    close(dyeColour(LOOKS.night, LOOKS.night.inks.length, 1), dyeColour(LOOKS.night, 0, 1));
  });
  it("has the agreed paper colours", () => {
    close(LOOKS.night.paper, [11 / 255, 11 / 255, 12 / 255]);
    close(LOOKS.blue.paper, [1, 1, 1]);
  });
});
