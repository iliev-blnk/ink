// The two looks: amber light on black for dark mode, one blue ink on white for light mode.

export type RGB = [number, number, number];
export interface Look {
  paper: RGB;
  inks: RGB[];
  /** true: the dye is light added to dark paper. false: the dye is ink absorbing light. */
  glow: boolean;
}
export type LookName = "night" | "blue";

const hex = (h: string): RGB => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16) / 255) as RGB;

export const LOOKS: Record<LookName, Look> = {
  night: { paper: hex("#0b0b0c"), inks: ["#ff8c33", "#f24d26", "#ffd99a"].map(hex), glow: true },
  blue: { paper: hex("#ffffff"), inks: ["#1a38b3", "#142e99", "#0f2680"].map(hex), glow: false },
};

export function lookFor(dark: boolean): LookName {
  return dark ? "night" : "blue";
}

/** What a splat adds to the dye: light at night, absorbance on paper. */
export function dyeColour(look: Look, i: number, amount: number): RGB {
  const ink = look.inks[((i % look.inks.length) + look.inks.length) % look.inks.length];
  return ink.map((c) => (look.glow ? c : 1 - c) * amount) as RGB;
}
