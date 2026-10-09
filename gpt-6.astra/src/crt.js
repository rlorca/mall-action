// A single full-screen triangle. Curvature compresses inward, so no game edge is cropped.
export class Monitor {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!this.gl)
      throw Error(
        "WebGL graphics are unavailable. Please enable hardware acceleration or try a modern desktop browser.",
      );
    const gl = this.gl;
    const vertex =
      "attribute vec2 a; varying vec2 uv; void main(){uv=(a+1.)*.5;gl_Position=vec4(a,0.,1.);}";
    const fragment = `precision mediump float; varying vec2 uv; uniform sampler2D image; uniform float time; uniform float crt; void main(){vec2 q=vec2(uv.x,1.-uv.y);vec3 col;if(crt>.5){vec2 p=q*2.-1.;p+=.035*p*(1.-p*p)*vec2(p.y*p.y,p.x*p.x);vec2 t=p*.5+.5;vec2 bounded=clamp(t,vec2(0.),vec2(1.));col=texture2D(image,bounded).rgb;float edge=step(0.,t.x)*step(t.x,1.)*step(0.,t.y)*step(t.y,1.);float scan=.88+.12*sin(t.y*240.*6.28318);float vignette=1.-.17*dot(p,p);float grain=(fract(sin(dot(floor(q*vec2(768.,720.))+time,vec2(12.9898,78.233)))*43758.5453)-.5)*.022;col=col*scan*vignette+grain;col*=edge; }else col=texture2D(image,q).rgb;gl_FragColor=vec4(col,1.);}`;
    const shader = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const a = gl.getAttribLocation(program, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.time = gl.getUniformLocation(program, "time");
    this.crt = gl.getUniformLocation(program, "crt");
  }
  resize() {
    const scale = Math.max(
      1,
      Math.floor(Math.min(innerWidth / 256, innerHeight / 240)),
    );
    this.canvas.width = 256 * scale;
    this.canvas.height = 240 * scale;
    this.canvas.style.width = this.canvas.width + "px";
    this.canvas.style.height = this.canvas.height + "px";
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  draw(source, on, frame) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1f(this.time, frame % 4096);
    gl.uniform1f(this.crt, on ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
