import { mountInk } from "../src/index";

const look = new URLSearchParams(location.search).get("look") as "night" | "blue" | null;
document.fonts.ready.then(() => {
  const ink = mountInk(document.getElementById("ink") as HTMLCanvasElement, {
    look: look ?? undefined,
    mask: () => [...document.querySelectorAll("[data-mask]")].map((el) => el.getBoundingClientRect()),
  });
  (window as unknown as { ink: typeof ink }).ink = ink;
});
