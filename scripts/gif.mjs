// Records the demo with a scripted stir and writes docs/ink.gif (needs ffmpeg).
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { serve } from "../e2e/serve.mjs";

const look = process.argv[2] ?? "night", out = process.argv[3] ?? "docs/ink.gif";
const port = 4484, server = await serve("dist-demo", port), dir = mkdtempSync(join(tmpdir(), "ink-"));
const size = { width: 960, height: 540 };
const browser = await chromium.launch({ executablePath: process.env.INK_CHROME ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: size });
await page.goto(`http://127.0.0.1:${port}/?look=${look}&seed=7`);
await page.waitForTimeout(2500);
// Screenshots as fast as they come while the cursor sweeps, then the frame rate they really had.
const FRAMES = 110, t0 = Date.now();
for (let i = 0; i < FRAMES; i++) {
  const t = i / FRAMES;
  if (t < 0.45) await page.mouse.move(380 + 900 * t, 270 + Math.sin(t * Math.PI * 6) * 150);
  await page.screenshot({ path: join(dir, `f${String(i).padStart(4, "0")}.png`) });
}
const fps = (FRAMES / ((Date.now() - t0) / 1000)).toFixed(2);
await browser.close(); server.close();
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", fps, "-i", join(dir, "f%04d.png"), "-vf",
  "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none", out]);
console.log("capture fps", fps);
console.log("wrote", out);
