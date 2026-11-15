//! Dev tool (screens agent 2): HUD worst cases, map overlay (with / without radar, in a store), pause.
//!   cargo run -p mall-core --example shot_game -- out_dir [scale]
use mall_core::events::Out;
use mall_core::mall::MapInfo;
use mall_core::pixel::{pal, Fb};
use mall_core::png;
use mall_core::run::RunState;
use mall_core::screens::hud::{self, HudData};
use mall_core::screens::{map, pause};
use mall_core::types::{Floor, PowerUp, StoreId};

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let dir = &a[1];
    let scale: usize = a.get(2).and_then(|s| s.parse().ok()).unwrap_or(3);
    let save = |name: &str, fb: &Fb| png::save_fb(&format!("{dir}/{name}.png"), fb, scale);

    // HUD sheet: several states stacked, each strip over a mall-ish backdrop
    let mut sheet = Fb::new();
    sheet.clear(pal::DBLUE);
    let base = HudData {
        score: 12_340,
        packages: 2,
        lives: 3,
        timed: None,
        armor: false,
        radar: false,
        alarm: false,
        floor: Floor::F3,
        marquee: None,
        tick: 0,
    };
    let worst = HudData {
        score: 999_999,
        packages: 6,
        lives: 9,
        timed: Some((hud::short_name(PowerUp::OrangeJuliOoze), 0.6)),
        armor: true,
        radar: true,
        alarm: true,
        floor: Floor::Roof,
        marquee: None,
        tick: 0,
    };
    let states = [
        base.clone(),
        HudData { timed: Some(("RAPID FIRE", 0.9)), armor: true, floor: Floor::Parking, ..base.clone() },
        HudData { timed: Some(("CINNABOMB", 0.2)), radar: true, packages: 5, floor: Floor::F4, tick: 0, ..base.clone() },
        worst.clone(),
        HudData { marquee: Some("BLOCKBLUSTER VIDEO"), tick: 30, ..worst.clone() },
        HudData { marquee: Some("HOT SPY ON A STICK"), tick: 120, ..worst.clone() },
        HudData { floor: Floor::F1, ..worst.clone() },
        HudData { floor: Floor::F2, alarm: false, ..worst.clone() },
    ];
    for (i, s) in states.iter().enumerate() {
        let mut fb = Fb::new();
        fb.clear(pal::DBLUE);
        hud::draw(&mut fb, s);
        // copy strip into the sheet at row i*20
        for y in 0..16 {
            for x in 0..256 {
                sheet.put(x, 4 + i as i32 * 20 + y, fb.get(x, y));
            }
        }
    }
    save("hud", &sheet);

    // map overlay
    let mut run = RunState::new(1, false);
    let mut out = Out::new();
    run.take_package(StoreId::KgbToys, &mut out);
    run.take_package(StoreId::Forever12, &mut out);
    for n in ["PET ROCK", "MOOD RING", "EXPIRED COUPON"] {
        run.inventory.push(n.into());
    }
    let info = MapInfo { player_floor: Floor::F2, player_x: 330, car_floor_pos: [1.0, 2.6, 5.0] };
    let mut fb = Fb::new();
    map::draw(&mut fb, &run, &info, None, 0);
    save("map", &fb);
    run.power.grant(PowerUp::Radar);
    run.photo_done = true;
    let mut fb = Fb::new();
    map::draw(&mut fb, &run, &info, None, 0);
    save("map_radar", &fb);
    let mut fb = Fb::new();
    map::draw(&mut fb, &run, &info, Some(StoreId::SamBaddy), 0);
    save("map_store", &fb);

    // pause over a fake scene
    let mut fb = Fb::new();
    for y in 16..240 {
        for x in 0..256 {
            fb.put(x, y, if (x / 16 + y / 16) % 2 == 0 { pal::TAN } else { pal::BROWN });
        }
    }
    hud::draw(&mut fb, &worst);
    pause::draw_over(&mut fb, 0);
    save("pause", &fb);
}
