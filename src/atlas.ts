// The glyphs, drawn once into a texture: a density ramp, then four contour strokes.

export const RAMP = " .,:;-=+*x#%@";
export const STROKES = "-/|\\";
export const CELL = { w: 7, h: 12 };

/** A white-on-black strip of every glyph, `scale`× the cell size for crisp minification. */
export function drawAtlas(font: string, scale = 4): HTMLCanvasElement {
  const w = CELL.w * scale, h = CELL.h * scale, glyphs = [...RAMP, ...STROKES];
  const c = document.createElement("canvas");
  c.width = w * glyphs.length;
  c.height = h;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000";
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#fff";
  x.font = `${11 * scale}px ${font}`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  glyphs.forEach((g, i) => x.fillText(g, i * w + w / 2, h / 2 + scale));
  return c;
}

export function uploadAtlas(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
