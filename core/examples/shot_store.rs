//! Dev tool: render the store rooms (and some states) to PNGs.
//!   cargo run -p mall-core --example shot_store -- <outdir> [scale] [only]
use mall_core::events::Out;
use mall_core::input::{PadState, A, B, DOWN, LEFT, RIGHT, UP};
use mall_core::pixel::Fb;
use mall_core::png;
use mall_core::run::RunState;
use mall_core::store::{setup_level, StoreRoom};
use mall_core::types::{Content, PowerUp, StoreId};

struct Drv(u8);
impl Drv {
    fn step(&mut self, room: &mut StoreRoom, run: &mut RunState, out: &mut Out, held: u8) {
        let pad = PadState::from_held(self.0, held);
        self.0 = held;
        room.step(pad, run, out);
    }
    fn run(&mut self, room: &mut StoreRoom, run: &mut RunState, out: &mut Out, held: u8, n: u32) {
        for _ in 0..n {
            self.step(room, run, out, held);
        }
    }
}

fn save(dir: &str, name: &str, room: &StoreRoom, run: &RunState, tick: u32, scale: usize) {
    let mut fb = Fb::new();
    room.draw(&mut fb, run, tick);
    png::save_fb(&format!("{dir}/{name}.png"), &fb, scale);
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let dir = args.get(1).cloned().unwrap_or("/tmp".into());
    let scale: usize = args.get(2).and_then(|s| s.parse().ok()).unwrap_or(3);
    let only = args.get(3).cloned();
    let want = |n: &str| only.as_ref().map_or(true, |o| n.contains(o.as_str()));
    let stores = [
        ("forever12", StoreId::Forever12),
        ("radioshock", StoreId::RadioShock),
        ("kgbtoys", StoreId::KgbToys),
        ("hotspy", StoreId::HotSpyOnAStick),
        ("sambaddy", StoreId::SamBaddy),
        ("footlockpicker", StoreId::FootLockpicker),
        ("crookstone", StoreId::Crookstone),
        ("sharperimagine", StoreId::SharperImagine),
        ("spenders", StoreId::SpendersGifts),
        ("gamestonk", StoreId::GameStonk),
    ];
    for (name, id) in stores {
        if !want(name) {
            continue;
        }
        let mut run = RunState::new(5, false);
        setup_level(&mut run);
        run.egg_done = true;
        let mut out = Out::new();
        let mut room = StoreRoom::new(id, &mut run, &mut out);
        let mut d = Drv(0);
        d.run(&mut room, &mut run, &mut out, 0, 30);
        save(&dir, &format!("room_{name}"), &room, &run, 30, scale);
    }
    // Radar view
    if want("radar") {
        let mut run = RunState::new(5, false);
        setup_level(&mut run);
        run.power.radar = true;
        run.egg_done = true;
        let mut out = Out::new();
        let mut room = StoreRoom::new(StoreId::KgbToys, &mut run, &mut out);
        let mut d = Drv(0);
        d.run(&mut room, &mut run, &mut out, 0, 200);
        save(&dir, "state_radar", &room, &run, 8, scale);
    }
    // Searching + banner + held item (Crookstone, first visit so the guard is still talking)
    if want("search") {
        let mut run = RunState::new(5, false);
        setup_level(&mut run);
        run.fixtures.get_mut(&StoreId::Crookstone).unwrap()[3] = Content::PowerUp(PowerUp::SpreadShot);
        let mut out = Out::new();
        let mut room = StoreRoom::new(StoreId::Crookstone, &mut run, &mut out);
        let mut d = Drv(0);
        d.run(&mut room, &mut run, &mut out, LEFT, 70);
        d.run(&mut room, &mut run, &mut out, UP, 4);
        save(&dir, "state_prompt", &room, &run, 0, scale);
        d.step(&mut room, &mut run, &mut out, B);
        d.run(&mut room, &mut run, &mut out, 0, 22);
        save(&dir, "state_searching", &room, &run, 0, scale);
        d.run(&mut room, &mut run, &mut out, 0, 30);
        save(&dir, "state_banner", &room, &run, 0, scale);
        eprintln!("{}", room.debug_state());
    }
    // Fight: spy telegraph
    if want("fight") {
        let mut run = RunState::new(9, false);
        setup_level(&mut run);
        run.visited.insert(StoreId::Forever12);
        let mut out = Out::new();
        let mut room = StoreRoom::new(StoreId::Forever12, &mut run, &mut out);
        let mut d = Drv(0);
        d.run(&mut room, &mut run, &mut out, UP | A, 1);
        for f in 0..2000 {
            let held = if f % 90 < 20 { LEFT } else if f % 90 < 50 { UP | A } else { RIGHT };
            d.step(&mut room, &mut run, &mut out, held);
            if room.debug_state().contains("bullets=") && f % 20 == 0 && f > 100 {
                save(&dir, &format!("state_fight_{f}"), &room, &run, f, scale);
                if f > 400 {
                    break;
                }
            }
        }
    }
    // Easter egg
    if want("egg") {
        let mut run = RunState::new(5, false);
        setup_level(&mut run);
        let mut out = Out::new();
        let mut room = StoreRoom::new(StoreId::GameStonk, &mut run, &mut out);
        let mut d = Drv(0);
        d.run(&mut room, &mut run, &mut out, 0, 70);
        save(&dir, "egg_text", &room, &run, 70, scale);
        d.run(&mut room, &mut run, &mut out, 0, 130);
        save(&dir, "egg_pedestal", &room, &run, 200, scale);
        d.run(&mut room, &mut run, &mut out, LEFT, 12);
        for _ in 0..120 {
            d.step(&mut room, &mut run, &mut out, UP);
            if room.debug_state().contains("Hold") {
                break;
            }
        }
        d.run(&mut room, &mut run, &mut out, 0, 20);
        save(&dir, "egg_hold", &room, &run, 250, scale);
        d.run(&mut room, &mut run, &mut out, 0, 140);
        save(&dir, "egg_vanish", &room, &run, 400, scale);
        d.run(&mut room, &mut run, &mut out, DOWN, 3);
    }
    // toys
    if want("toys") {
        let mut run = RunState::new(5, false);
        setup_level(&mut run);
        run.visited.insert(StoreId::KgbToys);
        let mut out = Out::new();
        let mut room = StoreRoom::new(StoreId::KgbToys, &mut run, &mut out);
        let mut d = Drv(0);
        d.run(&mut room, &mut run, &mut out, LEFT, 112);
        d.run(&mut room, &mut run, &mut out, UP, 112);
        d.step(&mut room, &mut run, &mut out, UP | A);
        d.run(&mut room, &mut run, &mut out, 0, 40);
        save(&dir, "state_toys", &room, &run, 40, scale);
    }
    eprintln!("done");
}
