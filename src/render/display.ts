import { SCREEN_H, SCREEN_W } from '../core/constants';
import { PALETTE_RGBA } from './palette';
import type { Framebuffer } from './pixels';

/**
 * Presents the 256x240 indexed framebuffer on screen.
 *
 * Scaling is always by the largest WHOLE-NUMBER factor that fits the window,
 * nearest-neighbour, at whole-pixel positions, with a black letterbox. The
 * canvas itself is sized to an exact multiple and centred by CSS, which is what
 * makes the letterbox and the pixel grid exact rather than approximately right.
 *
 * On top of that sits an optional arcade-monitor effect (scanlines, curvature,
 * vignette, slight noise). It is ON by default and drawn in a WebGL shader.
 * It must never blank or partially cover the screen, so the curvature is gentle
 * and the sampler clamps rather than dropping to black inside the picture.
 */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTex;
uniform float uTime;
uniform float uCrt;
uniform vec2 uScreen;

// Gentle barrel distortion. Scaled so the whole picture stays on screen.
vec2 curve(vec2 uv) {
  uv = uv * 2.0 - 1.0;
  vec2 offset = abs(uv.yx) / vec2(7.0, 5.5);
  uv += uv * offset * offset;
  // Deliberately NO inward scale here. Scaling in would push the outermost
  // texture rows off the screen, which would clip the top of the HUD - the
  // effect must never blank or partially cover the picture. The distortion
  // only ever pushes samples OUTWARD, so the corners show black surround
  // while every pixel of the 256x240 image stays visible.
  return uv * 0.5 + 0.5;
}

void main() {
  vec2 uv = mix(vUv, curve(vUv), uCrt);

  // Outside the tube: black surround. Inside: always a real sample, so the
  // picture is never blanked or partly covered.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec3 col = texture(uTex, uv).rgb;

  if (uCrt > 0.5) {
    // Slight chromatic separation, like a misconverged tube.
    float sep = 0.0009;
    col.r = texture(uTex, uv + vec2(sep, 0.0)).r;
    col.b = texture(uTex, uv - vec2(sep, 0.0)).b;

    // Scanlines, locked to the physical pixel rows.
    float line = sin(uv.y * uScreen.y * 3.14159);
    col *= 0.80 + 0.20 * (0.5 + 0.5 * line);

    // A faint aperture mask across the columns.
    float mask = 0.93 + 0.07 * sin(uv.x * uScreen.x * 3.14159);
    col *= mask;

    // Vignette.
    vec2 d = uv - 0.5;
    float vig = 1.0 - dot(d, d) * 0.55;
    col *= clamp(vig, 0.55, 1.0);

    // Slight noise.
    float n = fract(sin(dot(uv * uScreen + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * 0.045;

    // Lift the result so the effect reads as a monitor, not as a dark filter.
    col = clamp(col * 1.18 + 0.012, 0.0, 1.0);
  }

  fragColor = vec4(col, 1.0);
}`;

export type DisplayMode = 'webgl' | 'canvas2d';

export class Display {
  readonly canvas: HTMLCanvasElement;
  mode: DisplayMode = 'canvas2d';
  crtEnabled = true;
  scale = 1;

  private gl: WebGL2RenderingContext | null = null;
  private tex: WebGLTexture | null = null;
  private program: WebGLProgram | null = null;
  private uTime: WebGLUniformLocation | null = null;
  private uCrt: WebGLUniformLocation | null = null;
  private uScreen: WebGLUniformLocation | null = null;

  private ctx2d: CanvasRenderingContext2D | null = null;
  private srcCanvas: HTMLCanvasElement | null = null;
  private srcCtx: CanvasRenderingContext2D | null = null;

  private pixels = new Uint8ClampedArray(SCREEN_W * SCREEN_H * 4);
  private imageData: ImageData | null = null;
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /** @returns false if there is no usable graphics support at all. */
  init(): boolean {
    if (this.initWebGL()) {
      this.mode = 'webgl';
      return true;
    }
    if (this.init2D()) {
      this.mode = 'canvas2d';
      return true;
    }
    return false;
  }

  private initWebGL(): boolean {
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = this.canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: false,
      } as WebGLContextAttributes) as WebGL2RenderingContext | null;
    } catch {
      gl = null;
    }
    if (!gl) return false;

    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl!.createShader(type);
      if (!sh) return null;
      gl!.shaderSource(sh, src);
      gl!.compileShader(sh);
      if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
        console.error('shader:', gl!.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;

    const prog = gl.createProgram();
    if (!prog) return false;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // Nearest-neighbour, no blur, clamped so edges never sample to black.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SCREEN_W, SCREEN_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    this.gl = gl;
    this.program = prog;
    this.tex = tex;
    this.uTime = gl.getUniformLocation(prog, 'uTime');
    this.uCrt = gl.getUniformLocation(prog, 'uCrt');
    this.uScreen = gl.getUniformLocation(prog, 'uScreen');
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
    return true;
  }

  private init2D(): boolean {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return false;
    this.ctx2d = ctx;
    ctx.imageSmoothingEnabled = false;
    const src = document.createElement('canvas');
    src.width = SCREEN_W;
    src.height = SCREEN_H;
    const sctx = src.getContext('2d');
    if (!sctx) return false;
    this.srcCanvas = src;
    this.srcCtx = sctx;
    this.imageData = sctx.createImageData(SCREEN_W, SCREEN_H);
    return true;
  }

  /** Recompute the integer scale for the current window size. */
  resize(): void {
    const sx = Math.floor(window.innerWidth / SCREEN_W);
    const sy = Math.floor(window.innerHeight / SCREEN_H);
    const scale = Math.max(1, Math.min(sx, sy));
    if (scale === this.scale && this.canvas.width === SCREEN_W * scale) return;
    this.scale = scale;
    this.canvas.width = SCREEN_W * scale;
    this.canvas.height = SCREEN_H * scale;
    this.canvas.style.width = `${SCREEN_W * scale}px`;
    this.canvas.style.height = `${SCREEN_H * scale}px`;
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (this.ctx2d) this.ctx2d.imageSmoothingEnabled = false;
  }

  present(fb: Framebuffer): void {
    fb.toRGBA(PALETTE_RGBA, this.pixels);
    this.time += 1 / 60;

    if (this.gl && this.program) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SCREEN_W, SCREEN_H, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
      gl.uniform1f(this.uTime, this.time);
      gl.uniform1f(this.uCrt, this.crtEnabled ? 1 : 0);
      gl.uniform2f(this.uScreen, SCREEN_W, SCREEN_H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }

    // 2D fallback: integer-scaled blit, with drawn scanlines when CRT is on.
    const ctx = this.ctx2d;
    const src = this.srcCtx;
    if (!ctx || !src || !this.srcCanvas || !this.imageData) return;
    this.imageData.data.set(this.pixels);
    src.putImageData(this.imageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.srcCanvas, 0, 0, this.canvas.width, this.canvas.height);
    if (this.crtEnabled && this.scale >= 2) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#000';
      for (let y = 0; y < this.canvas.height; y += this.scale) {
        ctx.fillRect(0, y, this.canvas.width, Math.max(1, Math.floor(this.scale / 2)));
      }
      ctx.restore();
    }
  }
}
