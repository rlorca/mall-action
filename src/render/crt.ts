/**
 * Presents the 256x240 frame: nearest-neighbour scaling by the largest WHOLE-NUMBER factor that fits the
 * window, centred on a black letterbox. The optional CRT effect (scanlines, mild curvature, vignette, glow and
 * a little noise) is a WebGL fragment shader. It is tuned so that it never blanks or covers any of the picture:
 * the curvature keeps all four corners in view and the vignette never drops below 62% brightness.
 */
const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform vec2 u_size;
uniform float u_crt;
uniform float u_time;
uniform float u_scale;
varying vec2 v_uv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = v_uv;
  vec3 col;
  if (u_crt < 0.5) {
    col = texture2D(u_tex, uv).rgb;
  } else {
    vec2 d = uv - 0.5;
    float r2 = dot(d, d);
    float k = 0.075;
    // mild barrel distortion anchored so the corners map to the corners (nothing is cut off at the corners)
    vec2 w = 0.5 + d * (1.0 + k * r2) / (1.0 + k * 0.5);
    col = texture2D(u_tex, w).rgb;                     // nearest-neighbour: no blur
    // scanlines: one dark line per source row, strength fades at tiny scales
    float row = fract(w.y * u_size.y);
    float line = 0.5 + 0.5 * cos((row - 0.5) * 6.2831853);
    float strength = clamp((u_scale - 1.0) / 3.0, 0.0, 1.0) * 0.34;
    col *= 1.0 - strength * (1.0 - line * line);
    // faint aperture-grille tint, only when each pixel is big enough
    float colx = fract(w.x * u_size.x * 3.0);
    float tintAmt = clamp((u_scale - 2.0) / 4.0, 0.0, 1.0) * 0.05;
    col *= 1.0 - tintAmt + tintAmt * vec3(step(colx, 0.33) + 0.5, step(0.33, colx) * step(colx, 0.66) + 0.5, step(0.66, colx) + 0.5);
    // vignette (never darker than ~62%)
    float vig = 1.0 - smoothstep(0.18, 0.52, r2);
    col *= 0.62 + 0.38 * vig;
    // slight analog noise + flicker
    float n = hash(floor(uv * u_size) + fract(u_time) * 17.0);
    col += (n - 0.5) * 0.035 * (0.25 + col);
    col *= 1.0 + 0.012 * sin(u_time * 60.0);
    col *= 1.08;
  }
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Crt {
  ok = false;
  enabled = true;
  scale = 1;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private tex: WebGLTexture | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private fallback: CanvasRenderingContext2D | null = null;
  vp = { x: 0, y: 0, w: 256, h: 240 };
  lost = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly w = 256,
    readonly h = 240,
    /** Pretend WebGL is missing (`?webgl=0`) to test the fallback message. */
    forceNoGl = false,
  ) {
    let gl: WebGLRenderingContext | null = null;
    try {
      if (forceNoGl) throw new Error('webgl disabled by ?webgl=0');
      gl = (canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false }) as WebGLRenderingContext | null) ?? null;
    } catch {
      gl = null;
    }
    if (gl) {
      this.gl = gl;
      this.ok = this.setup(gl);
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        this.lost = true;
      });
      canvas.addEventListener('webglcontextrestored', () => {
        this.lost = false;
        if (this.gl) this.ok = this.setup(this.gl);
      });
    }
    if (!this.ok) {
      // No WebGL: plain 2D integer-scaled blit (the host shows a message).
      this.gl = null;
      this.fallback = canvas.getContext('2d');
    }
    this.resize();
  }

  private setup(gl: WebGLRenderingContext): boolean {
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('shader error', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = mk(gl.VERTEX_SHADER, VERT);
    const fs = mk(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    for (const n of ['u_tex', 'u_size', 'u_crt', 'u_time', 'u_scale']) this.u[n] = gl.getUniformLocation(prog, n);
    return true;
  }

  /** Match the canvas to the window (device pixels) and compute the integer scale + centred viewport. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.floor(window.innerWidth * dpr));
    const ch = Math.max(1, Math.floor(window.innerHeight * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    this.scale = Math.max(1, Math.floor(Math.min(cw / this.w, ch / this.h)));
    const vw = this.w * this.scale;
    const vh = this.h * this.scale;
    this.vp = { x: Math.floor((cw - vw) / 2), y: Math.floor((ch - vh) / 2), w: vw, h: vh };
  }

  present(src: HTMLCanvasElement, timeSec: number): void {
    const gl = this.gl;
    if (gl && this.ok && !this.lost) {
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(this.vp.x, this.canvas.height - this.vp.y - this.vp.h, this.vp.w, this.vp.h);
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.uniform1i(this.u.u_tex, 0);
      gl.uniform2f(this.u.u_size, this.w, this.h);
      gl.uniform1f(this.u.u_crt, this.enabled ? 1 : 0);
      gl.uniform1f(this.u.u_time, timeSec);
      gl.uniform1f(this.u.u_scale, this.scale);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else if (this.fallback) {
      const c = this.fallback;
      c.fillStyle = '#000';
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
      c.imageSmoothingEnabled = false;
      c.drawImage(src, this.vp.x, this.vp.y, this.vp.w, this.vp.h);
    }
  }
}
