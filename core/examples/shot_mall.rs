//! Dev tool (mall agent): runs a Mall through scripted input and saves PNGs.
//!   cargo run -p mall-core --example shot_mall -- <out_dir> [scale]
use mall_core::events::Out;
use mall_core::input::{PadState, A, B, DOWN, LEFT, RIGHT, UP};
use mall_core::layout::{self, floor_y, SHAFTS};
use mall_core::mall::Mall;
use mall_core::pixel::{pal, Fb};
use mall_core::png;
use mall_core::run::RunState;
use mall_core::types::{Floor, StoreId};

struct S {
    m: Mall,
    run: RunState,
    out: Out,
    held: u8,
    tick: u32,
}

impl S {
    fn new() -> S {
        let mut run = RunState::new(3, false);
        let mut out = Out::new();
        let m = Mall::new(&mut run, &mut out);
        S { m, run, out, held: 0, tick: 0 }
    }
    fn step(&mut self, h: u8) {
        let pad = PadState::from_held(self.held, h);
        self.held = h;
        self.m.step(pad, &mut self.run, &mut self.out);
        self.tick += 1;
    }
    fn frames(&mut self, h: u8, n: u32) {
        for _ in 0..n {
            self.step(h);
        }
    }
    fn shot(&self, dir: &str, name: &str, scale: usize) {
        let mut fb = Fb::new();
        fb.clear(pal::BLACK);
        self.m.draw(&mut fb, &self.run, self.tick);
        png::save_fb(&format!("{dir}/{name}.png"), &fb, scale);
    }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let dir = a[1].clone();
    let scale: usize = a.get(2).map(|s| s.parse().unwrap()).unwrap_or(3);
    std::fs::create_dir_all(&dir).unwrap();

    // ---- arrival
    let mut s = S::new();
    s.shot(&dir, "arr0_start", scale);
    s.frames(0, 40);
    s.shot(&dir, "arr1_slide", scale);
    s.frames(0, 50);
    s.shot(&dir, "arr2_drop", scale);
    s.frames(0, 25);
    s.shot(&dir, "arr3_crouch", scale);
    s.frames(0, 20);
    s.shot(&dir, "arr4_flash", scale);
    s.frames(0, 50);
    s.shot(&dir, "arr5_card", scale);
    s.frames(0, 120);
    s.shot(&dir, "arr6_control", scale);

    // ---- each floor
    let mut s = S::new();
    s.frames(0, 5);
    for (f, x) in [(Floor::Roof, 300), (Floor::F4, 100), (Floor::F3, 330), (Floor::F2, 260), (Floor::F1, 420), (Floor::Parking, 140)] {
        s.m.debug_teleport(f, x);
        s.frames(0, 3);
        s.frames(RIGHT, 20);
        s.shot(&dir, &format!("floor_{}", f.label()), scale);
    }
    for (f, x) in [(Floor::F4, 560), (Floor::F3, 650), (Floor::F2, 60), (Floor::F1, 620), (Floor::Parking, 560)] {
        s.m.debug_teleport(f, x);
        s.frames(0, 3);
        s.shot(&dir, &format!("floorb_{}", f.label()), scale);
    }

    // ---- walking pose, ducking, shooting, jump
    s.m.debug_teleport(Floor::F3, 120);
    s.frames(0, 3);
    s.frames(RIGHT, 10);
    s.shot(&dir, "walk", scale);
    s.step(A);
    s.frames(0, 2);
    s.shot(&dir, "shoot", scale);
    s.step(B | RIGHT);
    s.frames(RIGHT, 8);
    s.shot(&dir, "kick", scale);

    // ---- elevator ride in shaft B
    let mut s = S::new();
    s.frames(0, 5);
    s.m.core.cars[2].extra_occupants = 1;
    s.m.core.cars[1].y = floor_y(Floor::F4);
    s.m.debug_teleport(Floor::F4, SHAFTS[1].center_x() - 40);
    s.frames(0, 3);
    s.shot(&dir, "elev0_beside", scale);
    s.m.core.player.place(SHAFTS[1].center_x(), floor_y(Floor::F4));
    s.frames(0, 3);
    s.step(UP);
    s.step(0);
    s.shot(&dir, "elev1_boarded", scale);
    s.frames(DOWN, 40);
    s.shot(&dir, "elev2_moving", scale);
    s.frames(DOWN, 70);
    s.frames(0, 60);
    s.shot(&dir, "elev3_stopped", scale);
    s.step(LEFT);
    s.frames(LEFT, 20);
    s.shot(&dir, "elev4_out", scale);

    // ---- pits and grates
    let mut s = S::new();
    s.frames(0, 5);
    s.m.core.cars[2].extra_occupants = 1;
    s.m.core.cars[1].y = floor_y(Floor::F2);
    s.m.debug_teleport(Floor::F3, SHAFTS[1].x - 30);
    s.frames(0, 3);
    s.shot(&dir, "pit", scale);

    // ---- escalator
    let mut s = S::new();
    s.frames(0, 5);
    s.m.core.cars[2].extra_occupants = 1;
    let e = &layout::ESCALATORS[0];
    s.m.debug_teleport(Floor::F3, 100);
    s.m.core.player.place(e.x, floor_y(Floor::F3));
    s.frames(0, 4);
    s.step(UP);
    s.frames(0, 20);
    s.shot(&dir, "esc_mid", scale);
    s.frames(0, 20);
    s.shot(&dir, "esc_late", scale);

    // ---- store doors
    let mut s = S::new();
    s.frames(0, 5);
    s.m.debug_teleport(Floor::F4, layout::door_x(StoreId::Forever12));
    s.frames(0, 3);
    s.shot(&dir, "door", scale);
}
