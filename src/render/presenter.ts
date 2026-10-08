import { SCREEN_H, SCREEN_W, computeScale } from '../engine/scale';
import type { Framebuffer } from '../engine/framebuffer';

/**
 * WebGL presenter: uploads the 256x240 framebuffer as a texture and draws it as a full-canvas quad.
 * The canvas is always an exact integer multiple of 256x240 DEVICE pixels (letterboxed in black by the page),
 * so nearest-neighbour sampling stays crisp. With the CRT effect on, a shader adds scanlines, a gentle barrel
 * curvature (zoom-compensated so the whole picture, HUD included, stays on screen and the corners are never
 * blank), a vignette and a little noise. With it off, the shader is a plain nearest-neighbour blit.
 */
const VS = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FS = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uCrt;
uniform float uTime;
uniform vec2 uOut;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  if (uCrt < 0.5) {
    gl_FragColor = vec4(texture2D(uTex, uv).rgb, 1.0);
    return;
  }
  // gentle barrel distortion, zoomed so the corners land exactly on the screen corners
  vec2 c = uv * 2.0 - 1.0;
  float k = 0.018;
  vec2 d = c * (1.0 + k * dot(c, c)) / (1.0 + 2.0 * k);
  vec2 suv = d * 0.5 + 0.5;
  vec3 col = texture2D(uTex, suv).rgb;

  // scanlines: one dark band per source row
  float row = fract(suv.y * ${SCREEN_H}.0);
  float scan = 0.80 + 0.20 * smoothstep(0.0, 0.5, row) * (1.0 - smoothstep(0.5, 1.0, row));
  // faint horizontal phosphor shimmer
  float col3 = fract(suv.x * ${SCREEN_W}.0 * 3.0);
  vec3 mask = vec3(1.0) - 0.06 * vec3(step(col3, 0.33), step(0.33, col3) * step(col3, 0.66), step(0.66, col3));
  col *= scan * mask;

  // vignette
  float v = 1.0 - 0.28 * dot(c * 0.62, c * 0.62);
  col *= v;

  // moving noise
  float n = hash(floor(suv * vec2(${SCREEN_W}.0, ${SCREEN_H}.0)) + fract(uTime) * 17.0);
  col += (n - 0.5) * 0.045;

  // slight brightness lift to compensate for the scanline loss
  col *= 1.12;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Presenter {
  private gl: WebGLRenderingContext;
  private tex: WebGLTexture;
  private prog: WebGLProgram;
  private uCrt: WebGLUniformLocation | null;
  private uTime: WebGLUniformLocation | null;
  private uOut: WebGLUniformLocation | null;
  private rgba = new Uint8ClampedArray(SCREEN_W * SCREEN_H * 4);
  private buffer: WebGLBuffer;
  lost = false;
  scale = 1;

  /** Returns null when WebGL is unavailable. */
  static create(canvas: HTMLCanvasElement): Presenter | null {
    const gl = (canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false }) ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    try {
      return new Presenter(canvas, gl);
    } catch {
      return null;
    }
  }

  private constructor(readonly canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
    this.gl = gl;
    this.prog = this.link();
    this.uCrt = gl.getUniformLocation(this.prog, 'uCrt');
    this.uTime = gl.getUniformLocation(this.prog, 'uTime');
    this.uOut = gl.getUniformLocation(this.prog, 'uOut');
    this.buffer = gl.createBuffer()!;
    this.tex = gl.createTexture()!;
    this.initGpu();
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.prog = this.link();
      this.uCrt = gl.getUniformLocation(this.prog, 'uCrt');
      this.uTime = gl.getUniformLocation(this.prog, 'uTime');
      this.uOut = gl.getUniformLocation(this.prog, 'uOut');
      this.buffer = gl.createBuffer()!;
      this.tex = gl.createTexture()!;
      this.initGpu();
      this.lost = false;
    });
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? 'shader error');
    return sh;
  }

  private link(): WebGLProgram {
    const gl = this.gl;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error');
    return p;
  }

  private initGpu(): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SCREEN_W, SCREEN_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  /** Fit the canvas to the window: the largest whole-number scale in device pixels. */
  resize(winW: number, winH: number, dpr: number): void {
    const s = computeScale(winW, winH, dpr);
    this.scale = s.scale;
    const c = this.canvas;
    if (c.width !== s.backingW) c.width = s.backingW;
    if (c.height !== s.backingH) c.height = s.backingH;
    c.style.width = `${s.cssW}px`;
    c.style.height = `${s.cssH}px`;
  }

  present(fb: Framebuffer, crt: boolean, timeSec: number): void {
    if (this.lost) return;
    const gl = this.gl;
    fb.toRGBA(this.rgba);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SCREEN_W, SCREEN_H, gl.RGBA, gl.UNSIGNED_BYTE, this.rgba as unknown as ArrayBufferView);
    gl.uniform1i(gl.getUniformLocation(this.prog, 'uTex'), 0);
    gl.uniform1f(this.uCrt, crt ? 1 : 0);
    gl.uniform1f(this.uTime, timeSec);
    gl.uniform2f(this.uOut, this.canvas.width, this.canvas.height);
    const loc = gl.getAttribLocation(this.prog, 'aPos');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
