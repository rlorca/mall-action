//! MALL ACTION - Macroquad shell. Owns the window, the CRT shader, keyboard/gamepad input,
//! audio playback and the browser glue. All game rules live in `mall-core`.
mod audio;
mod crt;
mod keys;
mod platform;

use macroquad::prelude::*;
use mall_core::fixedstep::FixedStep;
use mall_core::game::Game;
use mall_core::input::{Action, Pad};
use mall_core::pixel::Canvas;
use mall_core::render::{Renderer, SCREEN_H, SCREEN_W};

fn window_conf() -> Conf {
    Conf {
        window_title: "MALL ACTION - FLICKERSOFT".to_owned(),
        window_width: (SCREEN_W * 3) as i32,
        window_height: (SCREEN_H * 3) as i32,
        high_dpi: true,
        sample_count: 1,
        ..Default::default()
    }
}

#[macroquad::main(window_conf)]
async fn main() {
    let seed = platform::param_seed().unwrap_or_else(|| (macroquad::miniquad::date::now() * 1000.0) as u64);
    let debug = platform::flag(0);
    let gallery = platform::flag(1);
    let mut game = Game::new(seed, debug);
    let renderer = Renderer::new();
    let mut canvas = Canvas::new(SCREEN_W, SCREEN_H);
    let mut image = Image::gen_image_color(SCREEN_W as u16, SCREEN_H as u16, BLACK);
    let tex = Texture2D::from_image(&image);
    tex.set_filter(FilterMode::Nearest);
    let crt_mat = crt::load();
    let mut crt_on = platform::storage_get(0).map(|v| v != 0).unwrap_or(true);
    let mut audio = audio::Audio::new();
    let mut keys = keys::Keys::new();
    let mut pad = Pad::new();
    let mut fixed = FixedStep::new();
    let mut gallery_page = 0usize;
    let mut gallery_t = 0i32;
    let mut focus_seen = platform::focus_lost();
    let mut first_input = false;

    loop {
        // ---------------- input ----------------
        let actions = keys.poll();
        if !actions.is_empty() {
            first_input = true;
        }
        let lost = platform::focus_lost();
        if lost != focus_seen {
            focus_seen = lost;
            for a in keys.release_all() {
                pad.apply(a, false);
            }
        }
        for (a, down) in actions {
            match (a, down) {
                (Action::ToggleCrt, true) => {
                    crt_on = !crt_on;
                    platform::storage_set(0, crt_on as i32);
                    game.toast(if crt_on { "CRT ON" } else { "CRT OFF" });
                }
                (Action::ToggleMute, true) => {
                    let m = audio.toggle_mute();
                    game.toast(if m { "SOUND OFF" } else { "SOUND ON" });
                }
                (Action::Pad(_), d) => pad.apply(a, d),
                _ => {}
            }
        }
        if is_mouse_button_pressed(MouseButton::Left) {
            first_input = true;
        }
        let gp = platform::gamepad_mask();
        if gp != 0 {
            first_input = true;
        }
        pad.set_gamepad(gp);
        if first_input {
            audio.unlock();
        }

        // ---------------- simulation ----------------
        if gallery {
            let ps = pad.begin_step();
            if ps.pressed(mall_core::input::RIGHT) {
                gallery_page += 1;
            }
            if ps.pressed(mall_core::input::LEFT) {
                gallery_page = gallery_page.wrapping_add(usize::MAX);
            }
            gallery_t += 1;
            let pages = renderer.gallery_pages().len();
            gallery_page %= pages;
            renderer.draw_gallery(&mut canvas, gallery_t, gallery_page);
        } else {
            if let Some((n, mask)) = platform::debug_take_steps() {
                // ?debug=1 hook: step N frames with the given buttons held
                for _ in 0..n {
                    pad.set_gamepad(mask);
                    let ps = pad.begin_step();
                    game.step(ps);
                    if audio.unlocked() {
                        // keep audio flags consumed so the queue cannot grow
                        let _ = game.take_sfx();
                    }
                }
                pad.set_gamepad(0);
            }
            let steps = fixed.advance(get_frame_time() as f64);
            for _ in 0..steps {
                let ps = pad.begin_step();
                game.step(ps);
                audio.sfx(game.take_sfx());
            }
            audio.update(&game).await;
            renderer.render(&game, &mut canvas);
            platform::debug_publish(&game, crt_on, audio.muted());
        }

        // ---------------- present ----------------
        image.bytes.copy_from_slice(&canvas.data);
        tex.update(&image);
        clear_background(BLACK);
        let dpi = screen_dpi_scale();
        let (pw, ph) = (screen_width() * dpi, screen_height() * dpi);
        let scale = (pw / SCREEN_W as f32).min(ph / SCREEN_H as f32);
        let scale = if scale >= 1.0 { scale.floor() } else { scale };
        let (dw, dh) = (SCREEN_W as f32 * scale, SCREEN_H as f32 * scale);
        let x = ((pw - dw) / 2.0).floor() / dpi;
        let y = ((ph - dh) / 2.0).floor() / dpi;
        let params = DrawTextureParams { dest_size: Some(vec2(dw / dpi, dh / dpi)), ..Default::default() };
        match (&crt_mat, crt_on) {
            (Some(m), true) => {
                m.set_uniform("Time", get_time() as f32);
                gl_use_material(m);
                draw_texture_ex(&tex, x, y, WHITE, params);
                gl_use_default_material();
            }
            _ => draw_texture_ex(&tex, x, y, WHITE, params),
        }
        next_frame().await;
    }
}
