//! MALL ACTION: the Bevy shell. Bevy owns the window, the browser canvas, keyboard/gamepad events, audio
//! output and the CRT shader. Everything about the game itself lives in the dependency-free `mall-core`:
//! each rendered frame we feed it elapsed real time (fixed 60 Hz steps, capped catch-up), copy the 256x240
//! framebuffer it paints into a texture, and let a shader scale it (whole-number factor, nearest neighbour,
//! black letterbox) with the optional CRT effect.

mod audio;
mod crt;
mod ctx;
#[cfg(target_arch = "wasm32")]
mod debug;
mod web;

use bevy::{
    asset::{embedded_asset, RenderAssetUsages},
    image::ImageSampler,
    input::{
        gamepad::{Gamepad, GamepadButton},
        keyboard::{Key, KeyboardInput},
        mouse::MouseButtonInput,
    },
    prelude::*,
    render::render_resource::{Extent3d, TextureDimension, TextureFormat},
    sprite_render::Material2dPlugin,
    window::{PrimaryWindow, WindowFocused, WindowResolution},
};
use mall_core::input as pad;
use mall_core::pixel::{H, W};

use bevy::audio::AddAudioSource;
use crate::audio::SynthSource;
use crate::crt::CrtMaterial;

#[derive(Resource)]
struct Canvas {
    image: Handle<Image>,
    material: Handle<CrtMaterial>,
}

#[derive(Resource, Default)]
struct AudioState {
    started: bool,
}

fn main() {
    let params = web::params();
    ctx::install(params);
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
    .add_audio_source::<SynthSource>()
    .insert_resource(ClearColor(Color::BLACK))
    .init_resource::<AudioState>()
    .add_systems(Startup, setup)
    .add_systems(Update, (window_focus, keyboard, gamepads, simulate, start_audio, present, layout).chain());
    embedded_asset!(app, "crt.wesl");
    app.run();
}

fn setup(mut commands: Commands, mut images: ResMut<Assets<Image>>, mut meshes: ResMut<Assets<Mesh>>, mut mats: ResMut<Assets<CrtMaterial>>) {
    commands.spawn(Camera2d);
    let mut img = Image::new_fill(
        Extent3d { width: W as u32, height: H as u32, depth_or_array_layers: 1 },
        TextureDimension::D2,
        &[0, 0, 0, 255],
        TextureFormat::Rgba8UnormSrgb,
        RenderAssetUsages::MAIN_WORLD | RenderAssetUsages::RENDER_WORLD,
    );
    img.sampler = ImageSampler::nearest();
    let image = images.add(img);
    let material = mats.add(CrtMaterial { params: Vec4::new(1.0, 0.0, 0.0, 0.0), tex: image.clone() });
    commands.spawn((
        Mesh2d(meshes.add(Rectangle::default())),
        MeshMaterial2d(material.clone()),
        Transform::from_scale(Vec3::new(W as f32 * 2.0, H as f32 * 2.0, 1.0)),
    ));
    commands.insert_resource(Canvas { image, material });
}

/// Losing focus releases every held key, so nothing sticks.
fn window_focus(mut ev: MessageReader<WindowFocused>) {
    for e in ev.read() {
        if !e.focused {
            ctx::with(|c| c.input.release_all());
        }
    }
}

fn keyboard(mut ev: MessageReader<KeyboardInput>, mut mouse: MessageReader<MouseButtonInput>) {
    ctx::with(|c| {
        for e in ev.read() {
            // Physical position name (matches W3C `code`: "KeyZ", "ArrowUp", "Space"...).
            let code = format!("{:?}", e.key_code);
            // What the key prints on this layout, if it is a character key.
            let printed = match &e.logical_key {
                Key::Character(s) => s.chars().next(),
                _ => None,
            };
            if e.state.is_pressed() {
                c.interacted = true;
                if e.repeat {
                    continue;
                }
                if let Some(h) = pad::host_key(printed, &code) {
                    c.host_key(h);
                } else {
                    c.input.key_down(printed, &code);
                }
            } else {
                c.input.key_up(&code);
            }
        }
        for m in mouse.read() {
            if m.state.is_pressed() {
                c.interacted = true;
            }
        }
    });
}

/// Merge every connected gamepad into the virtual pad. Disconnecting simply stops contributing.
fn gamepads(pads: Query<&Gamepad>) {
    let mut mask = 0u8;
    let mut any = false;
    for g in pads.iter() {
        any = true;
        let b = |btn| g.pressed(btn);
        if b(GamepadButton::South) {
            mask |= pad::A;
        }
        if b(GamepadButton::East) {
            mask |= pad::B;
        }
        if b(GamepadButton::Select) {
            mask |= pad::SELECT;
        }
        if b(GamepadButton::Start) {
            mask |= pad::START;
        }
        if b(GamepadButton::DPadUp) {
            mask |= pad::UP;
        }
        if b(GamepadButton::DPadDown) {
            mask |= pad::DOWN;
        }
        if b(GamepadButton::DPadLeft) {
            mask |= pad::LEFT;
        }
        if b(GamepadButton::DPadRight) {
            mask |= pad::RIGHT;
        }
        let s = g.left_stick();
        // Bevy's stick Y is up-positive; the core expects screen-style (down-positive).
        mask |= pad::stick_mask(s.x, -s.y);
    }
    ctx::with(|c| {
        c.input.set_gamepad(mask);
        if mask != 0 && any {
            c.interacted = true;
        }
    });
}

/// Feed real elapsed time to the fixed-step clock and run the game's 60 Hz steps (capped catch-up).
fn simulate(time: Res<Time<Real>>) {
    let dt = time.delta_secs_f64();
    ctx::with(|c| {
        if !c.realtime {
            return;
        }
        let n = c.fixed.advance(dt);
        for _ in 0..n {
            let p = c.input.step();
            c.sim_step(p);
        }
    });
}

/// Browsers only allow audio after a user gesture: start the output stream on the first interaction.
fn start_audio(mut commands: Commands, mut state: ResMut<AudioState>, mut sources: ResMut<Assets<SynthSource>>) {
    if state.started {
        return;
    }
    let go = ctx::with(|c| c.interacted).unwrap_or(false);
    if !go {
        return;
    }
    state.started = true;
    if let Some((synth, muted)) = ctx::with(|c| (c.synth.clone(), c.muted.clone())) {
        let handle = sources.add(SynthSource { synth, muted });
        commands.spawn(AudioPlayer(handle));
    }
}

/// Copy the game's framebuffer into the texture and update the shader uniforms.
fn present(canvas: Res<Canvas>, mut images: ResMut<Assets<Image>>, mut mats: ResMut<Assets<CrtMaterial>>, time: Res<Time>) {
    ctx::with(|c| {
        if c.dirty || c.toast.is_some() {
            c.render();
        }
        if let Some(mut img) = images.get_mut(&canvas.image) {
            if let Some(data) = img.data.as_mut() {
                c.fb.to_rgba(data);
            }
        }
        if let Some(mut m) = mats.get_mut(&canvas.material) {
            m.params.x = if c.crt { 1.0 } else { 0.0 };
            m.params.y = time.elapsed_secs() % 1000.0;
        }
    });
}

/// Largest whole-number scale that fits the window; black letterbox around it.
fn layout(win: Query<&Window, With<PrimaryWindow>>, mut q: Query<&mut Transform, With<Mesh2d>>) {
    let Ok(w) = win.single() else { return };
    let sx = (w.physical_width() as f32 / W as f32).floor();
    let sy = (w.physical_height() as f32 / H as f32).floor();
    let s = sx.min(sy).max(1.0);
    let k = s / w.scale_factor();
    for mut t in q.iter_mut() {
        t.scale = Vec3::new(W as f32 * k, H as f32 * k, 1.0);
        // keep the quad on whole physical pixels
        t.translation = Vec3::ZERO;
    }
}
