//! Arcade-monitor post effect: scanlines, mild curvature, vignette and a little noise.
//! If the shader fails to compile the game simply draws without it (never a black screen).
use macroquad::prelude::*;

const VERTEX: &str = "#version 100
attribute vec3 position;
attribute vec2 texcoord;
attribute vec4 color0;
varying lowp vec2 uv;
varying lowp vec4 color;
uniform mat4 Model;
uniform mat4 Projection;
void main() {
    gl_Position = Projection * Model * vec4(position, 1.0);
    color = color0 / 255.0;
    uv = texcoord;
}
";

const FRAGMENT: &str = "#version 100
precision mediump float;
varying lowp vec2 uv;
varying lowp vec4 color;
uniform sampler2D Texture;
uniform float Time;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    // mild barrel curvature: sample slightly outward, so the whole picture stays visible and only
    // the last ~3 px of the extreme corners fall off the tube
    vec2 d = uv * 2.0 - 1.0;
    vec2 w = d * (1.0 + 0.03 * vec2(d.y * d.y, d.x * d.x));
    if (abs(w.x) > 1.0 || abs(w.y) > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    vec2 suv = w * 0.5 + 0.5;
    vec3 col = texture2D(Texture, suv).rgb;
    // scanlines: one dark band per source row
    float row = fract(suv.y * 240.0);
    float scan = 0.62 + 0.38 * sin(row * 3.14159);
    col *= scan;
    // faint aperture-grille tint on columns
    float colx = fract(suv.x * 256.0 * 3.0);
    col *= 0.94 + 0.06 * sin(colx * 6.28318);
    // vignette
    float vig = 1.0 - 0.32 * dot(d, d) * 0.5;
    col *= vig;
    // noise
    float n = hash(suv * vec2(256.0, 240.0) + fract(Time) * 91.7);
    col += (n - 0.5) * 0.035;
    // phosphor bloom compensation
    col *= 1.12;
    gl_FragColor = vec4(col, 1.0);
}
";

pub fn load() -> Option<Material> {
    load_material(
        ShaderSource::Glsl { vertex: VERTEX, fragment: FRAGMENT },
        MaterialParams { uniforms: vec![UniformDesc::new("Time", UniformType::Float1)], ..Default::default() },
    )
    .ok()
}
