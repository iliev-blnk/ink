import { mountInk } from "../src/index";

const q = new URLSearchParams(location.search);
const look = q.get("look") as "night" | "blue" | null;
const seed = q.get("seed");
document.fonts.ready.then(() => {
  const ink = mountInk(document.getElementById("ink") as HTMLCanvasElement, {
    look: look ?? undefined,
    seed: seed ? Number(seed) : undefined,
    fallback: document.querySelector(".ink-fallback") as HTMLElement,
    mask: () => [...document.querySelectorAll("[data-mask]")].map((el) => el.getBoundingClientRect()),
  });
  (window as unknown as { ink: typeof ink }).ink = ink;
});
