// Frame-time probe: desktop, and a phone profile with the CPU throttled 4×.
import { chromium } from "playwright-core";
import { serve } from "./serve.mjs";

const port = 4483, server = await serve("dist-demo", port);
const browser = await chromium.launch({ executablePath: process.env.INK_CHROME ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] });
for (const [name, viewport, throttle, dpr] of [["desktop 1440", { width: 1440, height: 900 }, 1, 1], ["phone 390 ×4 cpu", { width: 390, height: 844 }, 4, 3]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: dpr });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForTimeout(6000);
  const fps = await page.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else ok(n / 3); }; requestAnimationFrame(f); }));
  console.log(`${name}: ${fps.toFixed(0)} fps`);
  await page.close();
}
await browser.close(); server.close();
