// WebGL presenter: draws the 256x240 Surface canvas at an integer scale (NEAREST) on a black
// letterbox, with an optional CRT effect (scanlines, mild barrel curvature, vignette, noise).
import { computeScale } from './scale';
import { SCREEN_H, SCREEN_W } from './palette';

const VERT = `attribute vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `precision mediump float;
uniform sampler2D tex;
uniform vec4 rect;      // game rect in device px: x, y (from top), w, h
uniform vec2 canvasSize;
uniform float crt;
uniform float time;
uniform float scale;

float hash(vec2 v){ return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453); }

void main(){
  vec2 frag = vec2(gl_FragCoord.x, canvasSize.y - gl_FragCoord.y);
  vec2 uv = (frag - rect.xy) / rect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x >= 1.0 || uv.y >= 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  if (crt < 0.5) { gl_FragColor = vec4(texture2D(tex, uv).rgb, 1.0); return; }

  // Mild barrel curvature. Edge midpoints map to the picture edge, so the whole picture stays
  // visible; only the extreme output corners fall outside (dark bezel).
  vec2 c = uv * 2.0 - 1.0;
  float k = 0.05;
  float r2 = dot(c, c);
  vec2 s = c * (1.0 + k * r2) / (1.0 + k);
  vec2 suv = s * 0.5 + 0.5;
  if (suv.x < 0.0 || suv.y < 0.0 || suv.x >= 1.0 || suv.y >= 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 col = texture2D(tex, suv).rgb;

  // Scanlines: one dark band per game pixel row.
  float fy = fract(suv.y * ${SCREEN_H}.0);
  float band = 0.5 + 0.5 * cos((fy - 0.5) * 6.2831853); // 1 at row centre, 0 at row boundary
  float strength = scale >= 3.0 ? 0.42 : (scale >= 2.0 ? 0.30 : 0.18);
  col *= 1.0 - strength * (1.0 - band);

  // RGB phosphor mask (only when there are enough device pixels per game pixel).
  if (scale >= 3.0) {
    float m = mod(floor(frag.x), 3.0);
    vec3 mask = vec3(m < 1.0 ? 1.0 : 0.88, (m >= 1.0 && m < 2.0) ? 1.0 : 0.88, m >= 2.0 ? 1.0 : 0.88);
    col *= mask;
  }

  // Bloom-ish lift, vignette, noise.
  col = col * 1.12 + 0.02 * col * col;
  float vig = 1.0 - 0.32 * pow(r2 * 0.5, 1.4);
  col *= vig;
  float n = hash(frag + vec2(fract(time * 13.7) * 97.0, fract(time * 7.3) * 53.0));
  col += (n - 0.5) * 0.06;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export function showUnsupportedMessage(el: HTMLElement | null): void {
  if (!el) return;
  el.style.display = 'flex';
  el.textContent =
    'MALL ACTION needs WebGL, which this browser or device does not provide. ' +
    'Please enable hardware acceleration or try a current desktop version of Chrome, Firefox, Safari or Edge.';
}

export class Presenter {
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private tex: WebGLTexture | null = null;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private lost = false;
  private last: HTMLCanvasElement | null = null;
  private cssW = 0;
  private cssH = 0;
  private dpr = 1;

  static isSupported(): boolean {
    try {
      if (typeof document === 'undefined') return false;
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch {
      return false;
    }
  }

  constructor(private readonly canvas: HTMLCanvasElement) {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.init();
      if (this.last) this.upload(this.last);
    });
    if (!this.init()) throw new Error('WebGL unavailable');
    this.resize();
  }

  private init(): boolean {
    const gl = (this.canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false }) ||
      this.canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    this.gl = gl;
    const sh = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.prog = prog;
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    for (const n of ['tex', 'rect', 'canvasSize', 'crt', 'time', 'scale']) this.u[n] = gl.getUniformLocation(prog, n);
    gl.uniform1i(this.u.tex, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    return true;
  }

  /** Match the canvas backing store to the window size * devicePixelRatio. */
  resize(): void {
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(this.cssW * this.dpr));
    const h = Math.max(1, Math.floor(this.cssH * this.dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  upload(source: HTMLCanvasElement): void {
    this.last = source;
    const gl = this.gl;
    if (!gl || this.lost || gl.isContextLost()) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  present(opts: { crt: boolean; time: number }): void {
    const gl = this.gl;
    if (!gl || this.lost || gl.isContextLost() || !this.last) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const r = computeScale(cw, ch, 1); // canvas is already in device pixels
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform4f(this.u.rect, r.x, r.y, r.w, r.h);
    gl.uniform2f(this.u.canvasSize, cw, ch);
    gl.uniform1f(this.u.crt, opts.crt ? 1 : 0);
    gl.uniform1f(this.u.time, opts.time);
    gl.uniform1f(this.u.scale, r.scale);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Whole-window layout in device pixels (for tests / overlay alignment). */
  get gameRect(): { x: number; y: number; w: number; h: number; scale: number } {
    return computeScale(this.canvas.width, this.canvas.height, 1);
  }
}

export const NATIVE = { w: SCREEN_W, h: SCREEN_H };
