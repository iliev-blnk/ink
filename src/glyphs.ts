// The render pass: one character per cell, chosen by how much ink the cell holds.
import { RAMP, STROKES } from "./atlas";
import type { Core, Target } from "./gl";
import type { Look } from "./themes";

export interface Grid {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
}

export function createGlyphPass(core: Core, atlas: WebGLTexture) {
  const { gl } = core;
  const prog = core.program(`uniform sampler2D Dye; uniform sampler2D Atlas; uniform sampler2D Mask;
    uniform vec2 grid; uniform vec2 cellPx; uniform float ramp; uniform float strokes; uniform float edges;
    uniform vec3 paper; uniform float glow;
    float lum(vec3 c){ return max(c.r, max(c.g, c.b)); }
    vec3 dyeAt(vec2 cell){ vec2 c = (cell+.5)/grid; vec2 h = .25/grid;
      return (texture(Dye,c-h).rgb + texture(Dye,c+vec2(h.x,-h.y)).rgb + texture(Dye,c+vec2(-h.x,h.y)).rgb + texture(Dye,c+h).rgb)*.25; }
    void main(){
      vec2 px = vec2(uv.x, 1.-uv.y) * grid * cellPx;
      vec2 cell = floor(px/cellPx); vec2 inCell = fract(px/cellPx);
      if (texture(Mask, (cell+.5)/grid).r > .5) { o = vec4(paper,1); return; }
      vec2 cellUp = vec2(cell.x, grid.y-1.-cell.y);
      vec3 d = dyeAt(cellUp); float raw = lum(d); float v = smoothstep(.03, .5, raw);
      float idx = floor(v*(ramp-1.)+.5);
      if (edges > .5) {
        float gx = lum(dyeAt(cellUp+vec2(1,0)))-lum(dyeAt(cellUp-vec2(1,0)));
        float gy = lum(dyeAt(cellUp+vec2(0,1)))-lum(dyeAt(cellUp-vec2(0,1)));
        if (length(vec2(gx,gy)) > .12 && v > .15) idx = ramp + mod(floor((atan(gy,gx)+.3927)/.7854), 4.);
      }
      float m = texture(Atlas, vec2((idx+inCell.x)/(ramp+strokes), inCell.y)).r;
      vec3 hue = d / max(raw, 1e-3);
      vec3 ink = glow > .5 ? hue : vec3(1.) - hue*.9;
      float a = glow > .5 ? min(1., v*1.6+.25) : min(1., .6+v);
      o = vec4(mix(paper, ink, m*a), 1);
    }`);

  let maskTex = gl.createTexture()!;

  function setMask(mask: Uint8Array, cols: number, rows: number) {
    const rgba = new Uint8Array(cols * rows * 4);
    for (let i = 0; i < mask.length; i++) rgba[i * 4] = mask[i];
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  /** Draws into the canvas; `dpr` maps the CSS grid onto device pixels from the top-left. */
  function draw(dye: Target, grid: Grid, look: Look, dpr: number, edges = false) {
    gl.useProgram(prog.p);
    gl.uniform1i(prog.u.Dye, dye.bind(0));
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlas); gl.uniform1i(prog.u.Atlas, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, maskTex); gl.uniform1i(prog.u.Mask, 2);
    gl.uniform2f(prog.u.grid, grid.cols, grid.rows);
    gl.uniform2f(prog.u.cellPx, grid.cellW, grid.cellH);
    gl.uniform1f(prog.u.ramp, RAMP.length);
    gl.uniform1f(prog.u.strokes, STROKES.length);
    gl.uniform1f(prog.u.edges, edges ? 1 : 0);
    gl.uniform3fv(prog.u.paper, look.paper);
    gl.uniform1f(prog.u.glow, look.glow ? 1 : 0);
    const h = grid.rows * grid.cellH * dpr;
    gl.viewport(0, gl.drawingBufferHeight - h, grid.cols * grid.cellW * dpr, h);
    core.draw(null);
  }

  return { draw, setMask, destroy() { gl.deleteTexture(maskTex); gl.deleteProgram(prog.p); } };
}
