// CRT post effect: draws the 256x240 game texture on a quad with scanlines, barrel curvature, vignette and
// a little noise. params.x = CRT on (1) / off (0), params.y = time in seconds.
import bevy_sprite_render::mesh2d::vertex_output::VertexOutput;

struct Crt {
    params: vec4<f32>,
};

@group(2) @binding(0) var<uniform> crt: Crt;
@group(2) @binding(1) var screen_tex: texture_2d<f32>;
@group(2) @binding(2) var screen_smp: sampler;

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
    var uv = in.uv;
    if (crt.params.x < 0.5) {
        return vec4<f32>(textureSample(screen_tex, screen_smp, uv).rgb, 1.0);
    }
    // barrel curvature
    let c = uv * 2.0 - 1.0;
    let r2 = dot(c, c);
    let cc = c * (1.0 + 0.045 * r2);
    let suv = cc * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) {
        return vec4<f32>(0.0, 0.0, 0.0, 1.0);
    }
    var col = textureSample(screen_tex, screen_smp, suv).rgb;
    // scanlines: one dark band per source row, visible at any integer scale
    let row = fract(suv.y * 240.0);
    let scan = 0.62 + 0.38 * smoothstep(0.0, 0.5, row) * (1.0 - smoothstep(0.5, 1.0, row));
    col = col * scan * 1.28;
    // faint phosphor mask on every third source column
    let colx = fract(suv.x * 256.0 * 3.0);
    col = col * (0.94 + 0.06 * select(0.0, 1.0, colx < 0.66));
    // vignette
    let v = clamp(1.0 - r2 * 0.22, 0.0, 1.0);
    col = col * v;
    // slight noise
    let n = fract(sin(dot(suv * 256.0 + vec2<f32>(crt.params.y * 60.0, 0.0), vec2<f32>(12.9898, 78.233))) * 43758.5453);
    col = col + (n - 0.5) * 0.035;
    return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
