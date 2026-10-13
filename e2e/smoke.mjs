// Smoke test on a real GPU: the demo draws ink, survives a resize and has no console errors.
// Usage: node e2e/smoke.mjs [root=dist-demo] [port=4480]
import { chromium } from "playwright-core";
import { serve } from "./serve.mjs";

const root = process.argv[2] ?? "dist-demo", port = Number(process.argv[3] ?? 4480);
const CHROME = process.env.INK_CHROME ?? "/usr/bin/chromium";
const GPU = ["--use-angle=gl", "--ignore-gpu-blocklist", "--enable-gpu"];
const server = await serve(root, port);
const url = `http://127.0.0.1:${port}/`;
const fail = (msg) => { console.error("FAIL", msg); process.exitCode = 1; };

/** Share of canvas pixels that differ from the paper colour. */
const inked = (page, paper) => page.evaluate((paper) => {
  const c = document.querySelector("canvas");
  const s = document.createElement("canvas"); s.width = 320; s.height = 200;
  const x = s.getContext("2d"); x.drawImage(c, 0, 0, s.width, s.height);
  const d = x.getImageData(0, 0, s.width, s.height).data; let n = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - paper[0]) + Math.abs(d[i + 1] - paper[1]) + Math.abs(d[i + 2] - paper[2]) > 24) n++;
  return n / (s.width * s.height);
}, paper);

const browser = await chromium.launch({ executablePath: CHROME, args: GPU });
try {
  for (const scheme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon|fonts\.g/.test(m.text())) errors.push(m.text()); });
    await page.goto(url);
    await page.waitForTimeout(1500);
    const paper = scheme === "dark" ? [11, 11, 12] : [255, 255, 255];
    const share = await inked(page, paper);
    if (share < 0.005) fail(`${scheme}: canvas looks blank (${(share * 100).toFixed(2)}% inked)`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);
    const after = await inked(page, paper);
    if (after < 0.005) fail(`${scheme}: blank after resize (${(after * 100).toFixed(2)}%)`);
    if (errors.length) fail(`${scheme}: console errors: ${errors.join(" | ")}`);
    console.log(`${scheme}: ${(share * 100).toFixed(1)}% inked, ${(after * 100).toFixed(1)}% after resize, ${errors.length} errors`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (!process.exitCode) console.log("smoke ok");
