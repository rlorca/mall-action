use bevy::{
    asset::{embedded_asset, RenderAssetUsages},
    audio::{AddAudioSource, ChannelCount, SampleRate, Source},
    input::keyboard::KeyboardInput,
    prelude::*,
    reflect::TypePath,
    render::render_resource::{AsBindGroup, Extent3d, TextureDimension, TextureFormat},
    image::ImageSampler,
    shader::ShaderRef,
    sprite_render::{Material2d, Material2dPlugin},
    window::{PrimaryWindow, WindowResolution},
};
use std::time::Duration;

#[derive(Asset, TypePath, AsBindGroup, Debug, Clone)]
struct CrtMaterial {
    #[uniform(0)]
    params: Vec4,
    #[texture(1)]
    #[sampler(2)]
    tex: Handle<Image>,
}
impl Material2d for CrtMaterial {
    fn fragment_shader() -> ShaderRef {
        "embedded://mall_app/crt.wesl".into()
    }
}

#[derive(Asset, TypePath)]
struct Beep;
struct BeepDec { n: u32 }
impl Iterator for BeepDec {
    type Item = f32;
    fn next(&mut self) -> Option<f32> {
        self.n += 1;
        if self.n > 22050 { return None; }
        Some(if (self.n / 50) % 2 == 0 { 0.2 } else { -0.2 })
    }
}
impl Source for BeepDec {
    fn current_span_len(&self) -> Option<usize> { None }
    fn channels(&self) -> ChannelCount { ChannelCount::new(1).unwrap() }
    fn sample_rate(&self) -> SampleRate { SampleRate::new(44100).unwrap() }
    fn total_duration(&self) -> Option<Duration> { None }
}
impl Decodable for Beep {
    type Decoder = BeepDec;
    fn decoder(&self) -> Self::Decoder { BeepDec { n: 0 } }
}

#[derive(Resource)]
struct Canvas(Handle<Image>, Handle<CrtMaterial>);

fn main() {
    let mut app = App::new();
    app.add_plugins(DefaultPlugins.set(WindowPlugin {
        primary_window: Some(Window {
            title: "MALL ACTION".into(),
            resolution: WindowResolution::new(768, 720),
            canvas: Some("#game".into()),
            fit_canvas_to_parent: true,
            prevent_default_event_handling: true,
            ..default()
        }),
        ..default()
    }))
    .add_plugins(Material2dPlugin::<CrtMaterial>::default())
    .add_audio_source::<Beep>()
    .insert_resource(ClearColor(Color::BLACK))
    .add_systems(Startup, setup)
    .add_systems(Update, (layout, input, draw));
    embedded_asset!(app, "crt.wesl");
    app.run();
}

fn setup(mut commands: Commands, mut images: ResMut<Assets<Image>>, mut meshes: ResMut<Assets<Mesh>>, mut mats: ResMut<Assets<CrtMaterial>>) {
    commands.spawn(Camera2d);
    let mut img = Image::new_fill(
        Extent3d { width: 256, height: 240, depth_or_array_layers: 1 },
        TextureDimension::D2, &[0, 0, 0, 255], TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::MAIN_WORLD | RenderAssetUsages::RENDER_WORLD);
    img.sampler = ImageSampler::nearest();
    let h = images.add(img);
    let m = mats.add(CrtMaterial { params: Vec4::new(1.0, 0.0, 768.0, 720.0), tex: h.clone() });
    commands.spawn((Mesh2d(meshes.add(Rectangle::default())), MeshMaterial2d(m.clone()), Transform::from_scale(Vec3::new(768.0, 720.0, 1.0))));
    commands.insert_resource(Canvas(h, m));
}

fn layout(win: Query<&Window, With<PrimaryWindow>>, mut q: Query<&mut Transform, With<Mesh2d>>) {
    let Ok(w) = win.single() else { return };
    let s = ((w.physical_width() as f32 / 256.0).floor().min((w.physical_height() as f32 / 240.0).floor())).max(1.0);
    let sc = s / w.scale_factor();
    for mut t in q.iter_mut() { t.scale = Vec3::new(256.0 * sc, 240.0 * sc, 1.0); }
}

fn input(mut ev: MessageReader<KeyboardInput>, mut commands: Commands, mut beeps: ResMut<Assets<Beep>>) {
    for e in ev.read() {
        info!("key {:?} {:?} {:?}", e.key_code, e.logical_key, e.state);
        if e.state.is_pressed() {
            let h = beeps.add(Beep);
            commands.spawn(AudioPlayer(h));
        }
    }
}

fn draw(c: Res<Canvas>, mut images: ResMut<Assets<Image>>, mut mats: ResMut<Assets<CrtMaterial>>, time: Res<Time>) {
    if let Some(mut img) = images.get_mut(&c.0) {
        let f = (time.elapsed_secs() * 60.0) as u32;
        if let Some(d) = img.data.as_mut() {
            for y in 0..240usize { for x in 0..256usize {
                let i = (y * 256 + x) * 4;
                d[i] = ((x as u32 + f) & 255) as u8; d[i+1] = y as u8; d[i+2] = ((x ^ y) & 255) as u8; d[i+3] = 255;
            }}
        }
    }
    if let Some(mut m) = mats.get_mut(&c.1) { m.params.y = time.elapsed_secs(); }
}
