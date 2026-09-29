/**
 * Presents the 256x240 frame buffer on screen with WebGL: whole-number nearest-neighbour scaling,
 * black letterbox, and an optional arcade-monitor effect (scanlines, curvature, vignette, slight noise).
 * The curvature is paired with a slight zoom-out so the picture is never cropped or partly covered.
 */
import { SCREEN_H, SCREEN_W } from './gfx';

const VS = `
attribute vec2 pos;
varying vec2 uv;
void main() {
  uv = vec2(pos.x * 0.5 + 0.5, 0.5 - pos.y * 0.5);
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FS = `
precision mediump float;
uniform sampler2D tex;
uniform float crt;
uniform float time;
uniform vec2 src;
uniform vec2 outSize;
varying vec2 uv;

vec2 curve(vec2 p) {
  p = p * 2.0 - 1.0;
  vec2 off = abs(p.yx) / vec2(8.0, 7.0);
  p = p + p * off * off;
  return p * 0.5 + 0.5;
}
float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  if (crt < 0.5) {
    gl_FragColor = vec4(texture2D(tex, uv).rgb, 1.0);
    return;
  }
  vec2 c = curve(uv);
  c = (c - 0.5) * 0.975 + 0.5;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 col = texture2D(tex, c).rgb;
  // A touch of horizontal bleed.
  vec3 l = texture2D(tex, c - vec2(1.0 / src.x, 0.0)).rgb;
  col = mix(col, max(col, l), 0.25);
  // Scanlines: darken the lower part of every source row.
  float row = fract(c.y * src.y);
  float scan = 0.66 + 0.34 * smoothstep(0.0, 0.35, row) * (1.0 - smoothstep(0.6, 1.0, row));
  // Aperture mask.
  float m = mod(gl_FragCoord.x, 3.0);
  vec3 mask = m < 1.0 ? vec3(1.06, 0.94, 0.94) : m < 2.0 ? vec3(0.94, 1.06, 0.94) : vec3(0.94, 0.94, 1.06);
  // Vignette.
  float v = 16.0 * c.x * c.y * (1.0 - c.x) * (1.0 - c.y);
  v = clamp(pow(v, 0.22), 0.0, 1.0);
  float noise = (rand(c * outSize + time) - 0.5) * 0.06;
  col = col * scan * mask * v * 1.18 + noise;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Presenter {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private tex: WebGLTexture;
  private uCrt: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private uOut: WebGLUniformLocation;
  scale = 1;

  /** Throws if WebGL is unavailable. */
  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'screen';
    parent.appendChild(this.canvas);
    const gl = this.canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL is not available');
    this.gl = gl;
    const prog = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]] as const) {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(sh));
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(gl.getUniformLocation(prog, 'src'), SCREEN_W, SCREEN_H);
    this.uCrt = gl.getUniformLocation(prog, 'crt')!;
    this.uTime = gl.getUniformLocation(prog, 'time')!;
    this.uOut = gl.getUniformLocation(prog, 'outSize')!;
    this.resize();
  }

  /** Largest whole-number scale that fits the window, in device pixels. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth * dpr;
    const h = window.innerHeight * dpr;
    this.scale = Math.max(1, Math.floor(Math.min(w / SCREEN_W, h / SCREEN_H)));
    const pw = SCREEN_W * this.scale;
    const ph = SCREEN_H * this.scale;
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.canvas.style.width = `${pw / dpr}px`;
    this.canvas.style.height = `${ph / dpr}px`;
    this.gl.viewport(0, 0, pw, ph);
  }

  present(src: HTMLCanvasElement, crt: boolean, time: number): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.uniform1f(this.uCrt, crt ? 1 : 0);
    gl.uniform1f(this.uTime, time % 1000);
    gl.uniform2f(this.uOut, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl');
  } catch {
    return false;
  }
}
