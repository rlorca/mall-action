import bevy_sprite_render::mesh2d::vertex_output::VertexOutput;

struct Crt {
    params: vec4<f32>,   // x = crt on (1/0), y = time, z = out width px, w = out height px
};

@group(2) @binding(0) var<uniform> crt: Crt;
@group(2) @binding(1) var screen_tex: texture_2d<f32>;
@group(2) @binding(2) var screen_smp: sampler;

@fragment
fn fragment(in: VertexOutput) -> @location(0) vec4<f32> {
    var uv = in.uv;
    if (crt.params.x > 0.5) {
        let c = uv * 2.0 - 1.0;
        let off = c * c.yx * 0.035;
        uv = uv + c * off * 0.9;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
    }
    var col = textureSample(screen_tex, screen_smp, uv).rgb;
    if (crt.params.x > 0.5) {
        let py = in.uv.y * crt.params.w;
        let scan = 0.78 + 0.22 * abs(sin(py * 3.14159));
        col = col * scan;
        let v = in.uv * (1.0 - in.uv);
        col = col * clamp(pow(v.x * v.y * 16.0, 0.25), 0.0, 1.0);
        let n = fract(sin(dot(in.uv + vec2<f32>(crt.params.y, 0.0), vec2<f32>(12.9898, 78.233))) * 43758.5453);
        col = col + (n - 0.5) * 0.04;
        col = col * 1.12;
    }
    return vec4<f32>(col, 1.0);
}
