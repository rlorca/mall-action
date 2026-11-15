//! CRT material: the game texture drawn with scanlines, curvature, vignette and noise (see `crt.wesl`).

use bevy::prelude::*;
use bevy::reflect::TypePath;
use bevy::render::render_resource::AsBindGroup;
use bevy::shader::ShaderRef;
use bevy::sprite_render::Material2d;

#[derive(Asset, TypePath, AsBindGroup, Debug, Clone)]
pub struct CrtMaterial {
    /// x = CRT on (1/0), y = time (s)
    #[uniform(0)]
    pub params: Vec4,
    #[texture(1)]
    #[sampler(2)]
    pub tex: Handle<Image>,
}

impl Material2d for CrtMaterial {
    fn fragment_shader() -> ShaderRef {
        "embedded://mall_app/crt.wesl".into()
    }
}
