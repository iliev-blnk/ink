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
  // The OS theme flips while the page is open: the paper follows without a reload.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
    await page.goto(url); await page.waitForTimeout(800);
    const corner = () => page.evaluate(() => {
      const c = document.querySelector("canvas"), s = document.createElement("canvas"); s.width = c.width; s.height = c.height;
      const x = s.getContext("2d"); x.drawImage(c, 0, 0); return [...x.getImageData(c.width - 3, c.height - 3, 1, 1).data.slice(0, 3)];
    });
    const light = await corner();
    await page.emulateMedia({ colorScheme: "dark" }); await page.waitForTimeout(500);
    const darkPx = await corner();
    if (light.join() !== "255,255,255") fail(`theme: light corner is ${light}`);
    if (darkPx.join() !== "11,11,12") fail(`theme: dark corner is ${darkPx}`);
    // A hidden tab pauses the loop and comes back without errors.
    await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(300);
    await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(500);
    if ((await inked(page, [11, 11, 12])) < 0.005) fail("visibility: blank after coming back");
    // A page's own theme toggle overrides the system setting, and can hand it back.
    await page.evaluate(() => window.ink.setLook("blue")); await page.waitForTimeout(300);
    const forced = await corner();
    if (forced.join() !== "255,255,255") fail(`setLook: forced blue corner is ${forced}`);
    await page.evaluate(() => window.ink.setLook(null)); await page.waitForTimeout(300);
    const back = await corner();
    if (back.join() !== "11,11,12") fail(`setLook: back to system gives ${back}`);
    console.log(`theme flip: ${light} → ${darkPx}, forced ${forced}, back ${back}`);
    await page.close();
  }
  // Reduced motion: one still frame, no loop.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await page.goto(url); await page.waitForTimeout(1000);
    const mode = await page.evaluate(() => window.ink?.mode);
    if (mode !== "still") fail(`reduced motion: mode is ${mode}`);
    if ((await inked(page, [255, 255, 255])) < 0.005) fail("reduced motion: still frame is blank");
    console.log(`reduced motion: ${mode}`);
    await page.close();
  }
  // No WebGL2: the text-art fallback shows and nothing throws.
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return type === "webgl2" ? null : get.call(this, type, ...rest); };
    });
    await page.goto(url); await page.waitForTimeout(800);
    const shown = await page.evaluate(() => { const p = document.querySelector(".ink-fallback"); return !!p && !p.hidden && p.textContent.length > 1000; });
    if (!shown || errors.length) fail(`fallback: shown=${shown} errors=${errors.join(" | ")}`);
    console.log(`fallback: shown=${shown}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (!process.exitCode) console.log("smoke ok");
