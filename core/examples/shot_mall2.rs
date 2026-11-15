//! Dev tool (mall agent, phase 2): spies, lights, NPCs, pickups. cargo run -p mall-core --example shot_mall2 -- <dir>
use mall_core::art;
use mall_core::pixel::{pal, Fb};
use mall_core::png;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let dir = a[1].clone();
    std::fs::create_dir_all(&dir).unwrap();
    let mut fb = Fb::new();
    fb.clear(pal::LGRAY);
    let names = ["lamp", "disco_ball", "lamp_shards", "wet_sign", "spy_stand", "spy_aim", "spy_aim_low", "spy_duck", "spy_die", "janitor_walk", "janitor_mop", "walker_a", "walker_b", "cop_segway", "kiosk", "photobooth", "photobooth_open", "fountain", "coin", "gold_coin", "agent_slip", "agent_stand"];
    let (mut x, mut y) = (4, 20);
    for n in names {
        let s = art::get(n);
        for f in 0..s.frame_count() {
            if x + 36 > 256 {
                x = 4;
                y += 38;
            }
            fb.blit(s, f, x, y, false);
            x += 36;
        }
    }
    png::save_fb(&format!("{dir}/sheet.png"), &fb, 4);
}
