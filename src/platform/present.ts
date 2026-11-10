/** WebGL presenter: integer nearest-neighbour scaling, black letterbox, optional CRT post-effect. */
import { Fb, SCREEN_W, SCREEN_H } from '../gfx/fb';

const VERT = `
attribute vec2 a;
varying vec2 v;
void main() { v = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5); gl_Position = vec4(a, 0.0, 1.0); }`;

// The warp maps the edge midpoints of the output rect exactly onto the image edges, so the
// whole picture stays visible (only the empty corners round off). Darkening is bounded: the
// effect can never blank the screen.
const FRAG = `
precision mediump float;
varying vec2 v;
uniform sampler2D tex;
uniform float crt;
uniform float time;
const vec2 RES = vec2(256.0, 240.0);
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
void main() {
  vec2 uv = v;
  if (crt < 0.5) {
    // exact texel centres: plain nearest-neighbour at whole-number scale
    gl_FragColor = vec4(texture2D(tex, (floor(uv * RES) + 0.5) / RES).rgb, 1.0);
    return;
  }
  vec2 p = uv * 2.0 - 1.0;
  vec2 q = p;
  q.x *= 1.0 + 0.030 * p.y * p.y;
  q.y *= 1.0 + 0.040 * p.x * p.x;
  uv = q * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  // nearest-neighbour under the curve too: no blur, pixels stay hard-edged
  vec3 c = texture2D(tex, (floor(uv * RES) + 0.5) / RES).rgb;
  float scan = 1.0 - 0.30 * (0.5 + 0.5 * cos(uv.y * 240.0 * 6.2831853));
  float mask = 1.0 - 0.06 * (0.5 + 0.5 * cos(uv.x * 256.0 * 6.2831853));
  float vig = 1.0 - 0.30 * pow(length(p * vec2(0.80, 0.86)), 3.0);
  float n = (hash(gl_FragCoord.xy) - 0.5) * 0.07;
  c = c * scan * mask * vig * 1.18 + n + 0.015;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class Presenter {
  private gl: WebGLRenderingContext;
  private rgba = new Uint8Array(SCREEN_W * SCREEN_H * 4);
  private uCrt: WebGLUniformLocation | null;
  private uTime: WebGLUniformLocation | null;
  crt = true;
  scale = 1;
  private frame = 0;

  /** Throws if WebGL is unavailable. */
  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = (canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true }) ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;
    const sh = (type: number, src: string) => {
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
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SCREEN_W, SCREEN_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.rgba);
    this.uCrt = gl.getUniformLocation(prog, 'crt');
    this.uTime = gl.getUniformLocation(prog, 'time');
    this.resize();
  }

  /** Largest whole-number scale that fits the window, in device pixels (no blur at any DPR). */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const availW = Math.floor(window.innerWidth * dpr);
    const availH = Math.floor(window.innerHeight * dpr);
    const s = Math.max(1, Math.floor(Math.min(availW / SCREEN_W, availH / SCREEN_H)));
    this.scale = s;
    const w = SCREEN_W * s, h = SCREEN_H * s;
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    const st = this.canvas.style;
    st.width = w / dpr + 'px';
    st.height = h / dpr + 'px';
    st.left = Math.max(0, Math.floor((availW - w) / 2)) / dpr + 'px';
    st.top = Math.max(0, Math.floor((availH - h) / 2)) / dpr + 'px';
    this.gl.viewport(0, 0, w, h);
  }

  present(fb: Fb): void {
    const gl = this.gl;
    fb.toRGBA(this.rgba);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SCREEN_W, SCREEN_H, gl.RGBA, gl.UNSIGNED_BYTE, this.rgba);
    gl.uniform1f(this.uCrt, this.crt ? 1 : 0);
    // Render-side noise only: never touches the game RNG.
    gl.uniform1f(this.uTime, (this.frame++ % 600) * 0.37);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
