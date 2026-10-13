// Stable fluids (Stam 1999) on the GPU: velocity and dye advected, pressure solved by Jacobi,
// and vorticity confinement to keep the curls alive.
import type { Core, Pair, Target } from "./gl";

export interface FluidSettings {
  curl: number;
  velocityDissipation: number;
  dyeDissipation: number;
  pressureIterations: number;
}

export const DEFAULTS: FluidSettings = { curl: 34, velocityDissipation: 0.15, dyeDissipation: 0.06, pressureIterations: 24 };

export function createFluid(core: Core, settings: FluidSettings = DEFAULTS) {
  const { gl, program } = core;
  const P = {
    splat: program(`uniform sampler2D T; uniform float aspect; uniform vec3 color; uniform vec2 point; uniform float radius;
      void main(){ vec2 d = uv-point; d.x *= aspect; o = vec4(texture(T,uv).xyz + exp(-dot(d,d)/radius)*color, 1.); }`),
    advect: program(`uniform sampler2D V; uniform sampler2D S; uniform vec2 texel; uniform float dt; uniform float dissipation;
      void main(){ vec2 c = uv - dt*texture(V,uv).xy*texel; o = texture(S,c) / (1.+dissipation*dt); }`),
    divergence: program(`uniform sampler2D V;
      void main(){ float l=texture(V,vL).x, r=texture(V,vR).x, t=texture(V,vT).y, b=texture(V,vB).y;
        vec2 c = texture(V,uv).xy; if(vL.x<0.) l=-c.x; if(vR.x>1.) r=-c.x; if(vT.y>1.) t=-c.y; if(vB.y<0.) b=-c.y;
        o = vec4(.5*(r-l+t-b),0,0,1); }`),
    curl: program(`uniform sampler2D V;
      void main(){ o = vec4(.5*(texture(V,vR).y-texture(V,vL).y-texture(V,vT).x+texture(V,vB).x),0,0,1); }`),
    vorticity: program(`uniform sampler2D V; uniform sampler2D C; uniform float curl; uniform float dt;
      void main(){ float l=texture(C,vL).x, r=texture(C,vR).x, t=texture(C,vT).x, b=texture(C,vB).x, c=texture(C,uv).x;
        vec2 f = .5*vec2(abs(t)-abs(b), abs(r)-abs(l)); f /= length(f)+1e-4; f *= curl*c; f.y *= -1.;
        o = vec4(clamp(texture(V,uv).xy + f*dt, -1000., 1000.), 0, 1); }`),
    pressure: program(`uniform sampler2D Pr; uniform sampler2D D;
      void main(){ o = vec4((texture(Pr,vL).x+texture(Pr,vR).x+texture(Pr,vB).x+texture(Pr,vT).x-texture(D,uv).x)*.25,0,0,1); }`),
    gradient: program(`uniform sampler2D Pr; uniform sampler2D V;
      void main(){ vec2 v = texture(V,uv).xy - vec2(texture(Pr,vR).x-texture(Pr,vL).x, texture(Pr,vT).x-texture(Pr,vB).x); o = vec4(v,0,1); }`),
    scale: program(`uniform sampler2D T; uniform float value; void main(){ o = value*texture(T,uv); }`),
  };

  let aspect = 1;
  let vel!: Pair, dye!: Pair, prs!: Pair, div!: Target, curlT!: Target;

  /** Sizes the grids for a viewport aspect; `sim` and `dyeRes` are cells on the short side. */
  function resize(width: number, height: number, sim = 128, dyeRes = 512) {
    if (vel) [vel, dye, prs, div, curlT].forEach(core.free);
    aspect = width / height;
    const grid = (n: number) => [Math.round(n * Math.max(1, aspect)), Math.round(n * Math.max(1, 1 / aspect))];
    const [sw, sh] = grid(sim), [dw, dh] = grid(dyeRes);
    vel = core.pair(sw, sh, gl.RG16F, gl.RG, gl.LINEAR);
    dye = core.pair(dw, dh, gl.RGBA16F, gl.RGBA, gl.LINEAR);
    prs = core.pair(sw, sh, gl.R16F, gl.RED, gl.NEAREST);
    div = core.target(sw, sh, gl.R16F, gl.RED, gl.NEAREST);
    curlT = core.target(sw, sh, gl.R16F, gl.RED, gl.NEAREST);
  }

  /** Adds a push of (dx, dy) and some dye at (x, y) in 0..1 page units, y up. */
  function splat(x: number, y: number, dx: number, dy: number, rgb: [number, number, number], radius: number) {
    gl.useProgram(P.splat.p);
    gl.uniform1f(P.splat.u.aspect, aspect);
    gl.uniform2f(P.splat.u.point, x, y);
    gl.uniform1i(P.splat.u.T, vel.read.bind(0));
    gl.uniform3f(P.splat.u.color, dx, dy, 0);
    gl.uniform1f(P.splat.u.radius, radius);
    core.draw(vel.write); vel.swap();
    gl.uniform1i(P.splat.u.T, dye.read.bind(0));
    gl.uniform3fv(P.splat.u.color, rgb);
    gl.uniform1f(P.splat.u.radius, radius * 1.6);
    core.draw(dye.write); dye.swap();
  }

  function step(dt: number) {
    const t = vel.texel;
    gl.useProgram(P.curl.p); gl.uniform2fv(P.curl.u.texel, t); gl.uniform1i(P.curl.u.V, vel.read.bind(0)); core.draw(curlT);
    gl.useProgram(P.vorticity.p); gl.uniform2fv(P.vorticity.u.texel, t);
    gl.uniform1i(P.vorticity.u.V, vel.read.bind(0)); gl.uniform1i(P.vorticity.u.C, curlT.bind(1));
    gl.uniform1f(P.vorticity.u.curl, settings.curl); gl.uniform1f(P.vorticity.u.dt, dt); core.draw(vel.write); vel.swap();
    gl.useProgram(P.divergence.p); gl.uniform2fv(P.divergence.u.texel, t); gl.uniform1i(P.divergence.u.V, vel.read.bind(0)); core.draw(div);
    gl.useProgram(P.scale.p); gl.uniform1i(P.scale.u.T, prs.read.bind(0)); gl.uniform1f(P.scale.u.value, 0.8); core.draw(prs.write); prs.swap();
    gl.useProgram(P.pressure.p); gl.uniform2fv(P.pressure.u.texel, t); gl.uniform1i(P.pressure.u.D, div.bind(1));
    for (let i = 0; i < settings.pressureIterations; i++) { gl.uniform1i(P.pressure.u.Pr, prs.read.bind(0)); core.draw(prs.write); prs.swap(); }
    gl.useProgram(P.gradient.p); gl.uniform2fv(P.gradient.u.texel, t);
    gl.uniform1i(P.gradient.u.Pr, prs.read.bind(0)); gl.uniform1i(P.gradient.u.V, vel.read.bind(1)); core.draw(vel.write); vel.swap();
    gl.useProgram(P.advect.p); gl.uniform2fv(P.advect.u.texel, t); gl.uniform1f(P.advect.u.dt, dt);
    gl.uniform1i(P.advect.u.V, vel.read.bind(0)); gl.uniform1i(P.advect.u.S, vel.read.bind(0));
    gl.uniform1f(P.advect.u.dissipation, settings.velocityDissipation); core.draw(vel.write); vel.swap();
    gl.uniform1i(P.advect.u.V, vel.read.bind(0)); gl.uniform1i(P.advect.u.S, dye.read.bind(1));
    gl.uniform1f(P.advect.u.dissipation, settings.dyeDissipation); core.draw(dye.write); dye.swap();
  }

  return {
    resize, splat, step,
    get dye() { return dye.read; },
    destroy() { [vel, dye, prs, div, curlT].forEach(core.free); },
  };
}
export type Fluid = ReturnType<typeof createFluid>;
