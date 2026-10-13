// WebGL2 plumbing: programs, half-float targets, ping-pong pairs and the full-screen quad.

export type GL = WebGL2RenderingContext;

export interface Program {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation>;
}

export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
  texel: [number, number];
  /** Binds the texture to a unit and returns the unit, for `uniform1i`. */
  bind(unit: number): number;
}

export interface Pair {
  w: number;
  h: number;
  texel: [number, number];
  read: Target;
  write: Target;
  swap(): void;
}

const VERTEX = `#version 300 es
in vec2 p; out vec2 uv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB; uniform vec2 texel;
void main(){ uv = p*.5+.5; vL = uv-vec2(texel.x,0.); vR = uv+vec2(texel.x,0.); vT = uv+vec2(0.,texel.y); vB = uv-vec2(0.,texel.y); gl_Position = vec4(p,0,1); }`;

const HEADER = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 uv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB; out vec4 o;
`;

export function createGL(gl: GL) {
  if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("ink: EXT_color_buffer_float is not supported");
  gl.getExtension("OES_texture_float_linear");

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`ink: shader failed: ${gl.getShaderInfoLog(s)}`);
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERTEX);

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function program(fragment: string): Program {
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HEADER + fragment));
    gl.bindAttribLocation(p, 0, "p");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`ink: link failed: ${gl.getProgramInfoLog(p)}`);
    const u: Record<string, WebGLUniformLocation> = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i)!.name;
      u[name] = gl.getUniformLocation(p, name)!;
    }
    return { p, u };
  }

  function target(w: number, h: number, internal: number, format: number, filter: number): Target {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      tex, fbo, w, h, texel: [1 / w, 1 / h],
      bind(unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); return unit; },
    };
  }

  function pair(w: number, h: number, internal: number, format: number, filter: number): Pair {
    let a = target(w, h, internal, format, filter), b = target(w, h, internal, format, filter);
    return { w, h, texel: a.texel, get read() { return a; }, get write() { return b; }, swap() { [a, b] = [b, a]; } };
  }

  function free(t: Target | Pair) {
    for (const x of "read" in t ? [t.read, t.write] : [t]) { gl.deleteTexture(x.tex); gl.deleteFramebuffer(x.fbo); }
  }

  /** Draws the quad into a target, or the screen viewport when `to` is null. */
  function draw(to: Target | null) {
    if (to) { gl.viewport(0, 0, to.w, to.h); gl.bindFramebuffer(gl.FRAMEBUFFER, to.fbo); }
    else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return { gl, program, target, pair, free, draw };
}
export type Core = ReturnType<typeof createGL>;
