//! Dev tool (mall agent, phase 2): spies, lights, NPCs, pickups. cargo run -p mall-core --example shot_mall2 -- <dir> [scale]
use mall_core::events::Out;
use mall_core::input::{PadState, A, B, DOWN, LEFT, RIGHT, UP};
use mall_core::layout::{self, floor_y};
use mall_core::mall::spies::SpyState;
use mall_core::mall::Mall;
use mall_core::pixel::{pal, Fb};
use mall_core::png;
use mall_core::run::RunState;
use mall_core::types::{Floor, PowerUp};

struct S {
    m: Mall,
    run: RunState,
    out: Out,
    held: u8,
    tick: u32,
}

impl S {
    fn new(seed: u64) -> S {
        let mut run = RunState::new(seed, false);
        let mut out = Out::new();
        let mut m = Mall::new(&mut run, &mut out);
        m.debug_quiet();
        m.debug_teleport(Floor::Roof, 120);
        let mut s = S { m, run, out, held: 0, tick: 0 };
        s.frames(0, 3);
        s
    }
    fn step(&mut self, h: u8) {
        let pad = PadState::from_held(self.held, h);
        self.held = h;
        self.m.step(pad, &mut self.run, &mut self.out);
        self.tick += 1;
        self.run.frames += 1;
    }
    fn frames(&mut self, h: u8, n: u32) {
        for _ in 0..n {
            self.step(h);
        }
    }
    fn at(&mut self, f: Floor, x: i32) {
        self.m.debug_teleport(f, x);
        self.frames(0, 2);
    }
    fn shot(&self, dir: &str, name: &str, scale: usize) {
        let mut fb = Fb::new();
        fb.clear(pal::BLACK);
        self.m.draw(&mut fb, &self.run, self.tick);
        png::save_fb(&format!("{dir}/{name}.png"), &fb, scale);
    }
}

impl S {
    /// Crop of the screen (x, y, w, h) saved at a big scale.
    fn crop(&self, dir: &str, name: &str, r: (usize, usize, usize, usize), scale: usize) {
        let mut fb = Fb::new();
        fb.clear(pal::BLACK);
        self.m.draw(&mut fb, &self.run, self.tick);
        let mut out = Fb::new();
        out.clear(pal::BLACK);
        for yy in 0..r.3 {
            for xx in 0..r.2 {
                out.px[yy * mall_core::pixel::W + xx] = fb.px[(r.1 + yy) * mall_core::pixel::W + r.0 + xx];
            }
        }
        png::save_fb(&format!("{dir}/{name}.png"), &out, scale);
    }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let dir = a[1].clone();
    let scale: usize = a.get(2).map(|s| s.parse().unwrap()).unwrap_or(3);
    std::fs::create_dir_all(&dir).unwrap();

    // ---- spies: aiming high, aiming low, ducking, dying, door
    let mut s = S::new(5);
    s.at(Floor::F4, 300);
    s.m.spies.add_walking(Floor::F4, 350, -1);
    s.m.spies.add_walking(Floor::F4, 240, 1);
    for sp in s.m.spies.spies.iter_mut() { sp.shot_cd = 0; }
    s.frames(0, 12);
    for sp in &s.m.spies.spies { eprintln!("{:?} x={} dir={}", sp.state, sp.x, sp.dir); }
    s.shot(&dir, "spy_aim", scale);
    s.crop(&dir, "spy_aim_crop", (20, 96, 100, 60), 8);
    s.frames(0, 30);
    s.shot(&dir, "spy_shot", scale);
    // kill one
    s.frames(0, 20);
    s.step(A);
    s.frames(0, 4);
    s.shot(&dir, "spy_hit", scale);

    // ---- a spy stepping out of a store door
    let mut s = S::new(5);
    s.at(Floor::F3, 330);
    let id = s.m.spies.add_walking(Floor::F3, layout::door_x(mall_core::types::StoreId::BlockblusterVideo), -1);
    let sp = s.m.spies.spies.iter_mut().find(|x| x.id == id).unwrap();
    sp.state = SpyState::Appear { t: 0 };
    sp.door = Some(mall_core::types::StoreId::BlockblusterVideo);
    s.frames(0, 14);
    s.shot(&dir, "spy_door", scale);
    s.frames(0, 20);
    s.shot(&dir, "spy_door2", scale);

    // ---- lamp falling and the dark corridor
    let mut s = S::new(5);
    s.m.lights = mall_core::mall::lights::Lights::new();
    s.at(Floor::F3, 150);
    let lx = s.m.lights.lamps.iter().find(|l| l.floor == Floor::F3).unwrap().x;
    s.shot(&dir, "lamp_hung", scale);
    s.at(Floor::F3, lx - 60);
    s.step(A);
    s.frames(0, 14);
    s.shot(&dir, "lamp_fall", scale);
    s.frames(0, 10);
    s.shot(&dir, "lamp_dark", scale);
    s.frames(0, 100);
    s.shot(&dir, "lamp_dark_fade", scale);

    // ---- disco ball rolling
    let mut s = S::new(5);
    s.m.lights = mall_core::mall::lights::Lights::new();
    s.at(Floor::F2, 100);
    let bx = s.m.lights.lamps.iter().find(|l| l.floor == Floor::F2).unwrap().x;
    s.at(Floor::F2, bx - 50);
    s.step(A);
    s.frames(0, 16);
    s.shot(&dir, "ball_fall", scale);
    s.frames(0, 14);
    s.shot(&dir, "ball_roll", scale);

    // ---- janitor and wet floor
    let mut s = S::new(5);
    s.at(Floor::F1, 215);
    s.frames(0, 240 + 60);
    s.shot(&dir, "janitor_mop", scale);
    s.frames(0, 40);
    s.shot(&dir, "janitor_wet", scale);
    s.step(RIGHT);
    s.frames(RIGHT, 12);
    s.shot(&dir, "janitor_slip", scale);

    // ---- walkers
    let mut s = S::new(5);
    s.m.npcs = mall_core::mall::npcs::Npcs::new();
    s.at(Floor::F2, 620);
    s.frames(0, 5);
    s.shot(&dir, "walkers", scale);

    // ---- cop
    let mut s = S::new(5);
    s.m.npcs = mall_core::mall::npcs::Npcs::new();
    s.m.npcs.disable_roamers();
    s.at(Floor::F3, 300);
    s.m.npcs.cop = Some(mall_core::mall::npcs::Cop::test_new(Floor::F3, 380, -1));
    s.step(A);
    s.frames(0, 8);
    s.shot(&dir, "cop_whistle", scale);

    // ---- booth, kiosk, fountain
    let mut s = S::new(5);
    s.at(Floor::F3, 672);
    s.step(UP);
    s.frames(0, 20);
    s.shot(&dir, "booth_in", scale);
    s.frames(0, 5);
    s.step(B);
    s.frames(0, 30);
    s.shot(&dir, "photo_strip", scale);
    s.at(Floor::F3, 600);
    s.step(UP);
    s.frames(0, 20);
    s.shot(&dir, "kiosk", scale);
    let mut s = S::new(5);
    s.at(Floor::F3, 700);
    s.step(A);
    s.frames(0, 25);
    s.shot(&dir, "fountain_spray", scale);
    s.frames(0, 40);
    s.shot(&dir, "fountain_coins", scale);

    // ---- alarm and pickups
    let mut s = S::new(5);
    s.at(Floor::F4, 300);
    s.run.frames = s.run.difficulty().alarm_frames;
    s.frames(0, 30);
    s.shot(&dir, "alarm", scale);
    for (i, p) in [PowerUp::RapidFire, PowerUp::Cinnabomb, PowerUp::ArmorVest, PowerUp::OneUp].iter().enumerate() {
        s.m.pickups.items.push(mall_core::mall::pickups::Pickup { floor: Floor::F4, x: 340 + i as i32 * 22, item: *p, age: 0 });
    }
    s.frames(0, 8);
    s.shot(&dir, "pickups", scale);
    let _ = (LEFT, DOWN, floor_y(Floor::F4));
}
