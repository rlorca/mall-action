export class CRT {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  texture: WebGLTexture;
  canvas: HTMLCanvasElement;
  time: WebGLUniformLocation;
  enabled: WebGLUniformLocation;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl)
      throw new Error(
        "MALL ACTION needs WebGL graphics support. Enable hardware acceleration or try another desktop browser.",
      );
    this.gl = gl;
    const vertex = `attribute vec2 position;varying vec2 uv;void main(){uv=(position+1.)*.5;gl_Position=vec4(position,0.,1.);}`;
    const fragment = `precision mediump float;varying vec2 uv;uniform sampler2D screen;uniform float time;uniform float enabled;void main(){vec2 p=vec2(uv.x,1.-uv.y);vec2 q=p*2.-1.;if(enabled>.5){p=.5+q*(1.+.025*dot(q,q))*.5;p=clamp(p,vec2(.002),vec2(.998));}vec3 color=texture2D(screen,p).rgb;if(enabled>.5){float scan=.91+.09*sin(p.y*240.*6.2831853);float vignette=1.-.12*dot(q,q);float noise=fract(sin(dot(p+time,vec2(12.9898,78.233)))*43758.5453)-.5;color=color*scan*vignette*1.10+noise*.012;}gl_FragColor=vec4(color,1.);}`;
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) ?? "Graphics shader failed");
      return s;
    };
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(this.program, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw new Error("Graphics program failed");
    gl.useProgram(this.program);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(this.program, "position");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.time = gl.getUniformLocation(this.program, "time")!;
    this.enabled = gl.getUniformLocation(this.program, "enabled")!;
  }
  draw(source: HTMLCanvasElement, enabled: boolean, time: number) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1f(this.time, time / 60);
    gl.uniform1f(this.enabled, enabled ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}
