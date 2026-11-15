//! Mall decor and fixtures (art agent 1): lamps, disco ball, fountain, kiosk, elevator, station wagon, skyscraper...
//! Large pieces are composed from rectangles with a tiny `Canvas`; small ones are plain ASCII art.
use super::characters::{blk, frames_of, mk};
use super::Registry;
use crate::pixel::{pal, Sprite};

/// A tiny pixel canvas of palette indices 0..=3 that renders to ASCII rows.
#[derive(Clone)]
struct Canvas {
    w: usize,
    h: usize,
    px: Vec<u8>,
}

impl Canvas {
    fn new(w: usize, h: usize) -> Canvas {
        Canvas { w, h, px: vec![0; w * h] }
    }
    fn p(&mut self, x: i32, y: i32, c: u8) {
        if x >= 0 && y >= 0 && (x as usize) < self.w && (y as usize) < self.h {
            self.px[y as usize * self.w + x as usize] = c;
        }
    }
    fn at(&self, x: i32, y: i32) -> u8 {
        if x >= 0 && y >= 0 && (x as usize) < self.w && (y as usize) < self.h {
            self.px[y as usize * self.w + x as usize]
        } else {
            0
        }
    }
    fn r(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8) {
        for yy in y..y + h {
            for xx in x..x + w {
                self.p(xx, yy, c);
            }
        }
    }
    /// Rectangle outline.
    fn o(&mut self, x: i32, y: i32, w: i32, h: i32, c: u8) {
        self.r(x, y, w, 1, c);
        self.r(x, y + h - 1, w, 1, c);
        self.r(x, y, 1, h, c);
        self.r(x + w - 1, y, 1, h, c);
    }
    /// Paint `rows` (ASCII art, `.` transparent = leave unchanged) with its top-left at (x, y).
    fn art(&mut self, x: i32, y: i32, rows: &str) {
        for (j, row) in blk(rows).iter().enumerate() {
            for (i, ch) in row.chars().enumerate() {
                if let Some(d) = ch.to_digit(10) {
                    self.p(x + i as i32, y + j as i32, d as u8);
                }
            }
        }
    }
    fn rows(&self) -> Vec<String> {
        (0..self.h)
            .map(|y| (0..self.w).map(|x| [b'.', b'1', b'2', b'3'][self.px[y * self.w + x] as usize] as char).collect())
            .collect()
    }
}

fn sprite(frames: &[Canvas], colors: [u8; 3]) -> Sprite {
    let f: Vec<Vec<String>> = frames.iter().map(|c| c.rows()).collect();
    mk(&f, frames[0].w, frames[0].h, colors)
}

pub fn register(r: &mut Registry) {
    lamp(r);
    disco(r);
    furniture(r);
    fountain(r);
    kiosk_and_booth(r);
    elevator(r);
    small_fixtures(r);
    wagon(r);
    pillar_and_post(r);
    skyscraper(r);
}

// ---- Lamp ------------------------------------------------------------------------------------------------

fn lamp(r: &mut Registry) {
    let mut frames = Vec::new();
    for f in 0..2i32 {
        let mut c = Canvas::new(16, 24);
        c.r(7, 0, 2, 9, 1); // cord, anchored on the very top row
        c.art(0, 8, "
.......11.......
......1221......
.....122221.....
....12222221....
...1222222221...
..122222222221..
.11111111111111.
....1.3333.1....
");
        // warm glow cone below the shade, dithered; it flickers by size and phase
        let rows = if f == 0 { 8 } else { 7 };
        for j in 0..rows {
            let half = 2 + j * 3 / 4 + if f == 0 { 1 } else { 0 };
            for i in -half..=half {
                let x = 7 + i;
                let y = 16 + j;
                if (x + y + f) % 2 == 0 && (i.abs() <= half) && c.at(x, y) == 0 {
                    c.p(x, y, 3);
                }
            }
        }
        c.r(6, 15, 4, 1, 3); // the bulb
        frames.push(c);
    }
    r.insert("lamp".into(), sprite(&frames, [pal::DBROWN, pal::ORANGE, pal::LYELLOW]));
}

// ---- Disco ball ------------------------------------------------------------------------------------------

fn disco(r: &mut Registry) {
    let mut frames = Vec::new();
    let sparkles: [&[(i32, i32)]; 4] = [&[(5, 6), (9, 10), (11, 5)], &[(7, 5), (4, 9), (10, 12)], &[(10, 7), (6, 11), (5, 5)], &[(8, 9), (11, 11), (4, 7)]];
    for f in 0..4 {
        let mut c = Canvas::new(16, 16);
        c.r(6, 0, 4, 1, 2); // ceiling mount
        c.r(7, 1, 2, 2, 1); // cord
        let (cx, cy) = (7.5f32, 9.0f32);
        for y in 0..16 {
            for x in 0..16 {
                let d = ((x as f32 - cx).powi(2) + (y as f32 + 0.5 - cy).powi(2)).sqrt();
                if d <= 5.8 && y >= 3 {
                    let facet = ((x + (f as i32)) / 2 + y / 2) % 2;
                    c.p(x, y, if facet == 0 { 1 } else { 2 });
                }
            }
        }
        for &(x, y) in sparkles[f as usize] {
            c.p(x, y, 3);
            if c.at(x + 1, y) != 0 {
                c.p(x + 1, y, 3);
            }
        }
        // light flares on the rim, rotating
        let flares: [(i32, i32); 4] = [(1, 3), (14, 4), (14, 12), (1, 13)];
        let (fx, fy) = flares[f as usize];
        c.p(fx, fy, 3);
        c.p(fx - 1, fy, 3);
        c.p(fx + 1, fy, 3);
        c.p(fx, fy - 1, 3);
        c.p(fx, fy + 1, 3);
        frames.push(c);
    }
    r.insert("disco_ball".into(), sprite(&frames, [pal::GRAY, pal::LGRAY, pal::WHITE]));
}

// ---- Bench, plant ----------------------------------------------------------------------------------------

fn furniture(r: &mut Registry) {
    let mut c = Canvas::new(24, 12);
    let slat = |c: &mut Canvas, x: i32, y: i32, w: i32, h: i32| {
        c.r(x, y, w, h, 2);
        c.r(x, y, w, 1, 3);
        c.r(x, y + h - 1, w, 1, 1);
    };
    c.r(1, 0, 2, 11, 1); // back posts
    c.r(21, 0, 2, 11, 1);
    slat(&mut c, 1, 1, 22, 3); // back rest slats
    slat(&mut c, 1, 5, 22, 3);
    slat(&mut c, 0, 8, 24, 2); // seat
    c.r(2, 10, 2, 2, 1); // legs
    c.r(20, 10, 2, 2, 1);
    r.insert("bench".into(), sprite(&[c], [pal::DBROWN, pal::ORANGE, pal::LYELLOW]));

    // Potted plant: dark/light green leaves (1/2) in a brown pot (3); frame 1 sways the upper leaves.
    let plant = |sway: bool| -> Canvas {
        let mut c = Canvas::new(16, 24);
        c.art(0, 0, "
................
.......11.......
......1221......
.....12221......
..11.12221.11...
.1221122211221..
.12222122212221.
..122221222221..
...1222122221...
....12212221....
.....122221.....
......1221......
.......11.......
");
        if sway {
            for y in 0..6 {
                for x in (1..16).rev() {
                    let v = c.px[y * 16 + x - 1];
                    c.px[y * 16 + x] = v;
                }
                c.px[y * 16] = 0;
            }
        }
        c.r(7, 13, 2, 3, 1);
        c.art(0, 15, "
..333333333333..
..311111111113..
...3333333333...
...3333333333...
...3333333333...
....33333333....
....33333333....
....33333333....
....11111111....
");
        c
    };
    r.insert("plant".into(), sprite(&[plant(false), plant(true)], [pal::DGREEN, pal::LGREEN, pal::BROWN]));
}

// ---- Fountain --------------------------------------------------------------------------------------------

fn fountain(r: &mut Registry) {
    let mut frames = Vec::new();
    for f in 0..3i32 {
        let mut c = Canvas::new(32, 24);
        // lower basin (stone): outer wall 1 (grey), rim highlight 2, water 3
        c.r(0, 17, 32, 7, 1);
        c.r(0, 17, 32, 1, 2);
        c.r(2, 18, 28, 3, 3); // water surface
        c.r(1, 21, 30, 1, 2);
        // ripples on the water surface
        for i in 0..7 {
            let x = 3 + i * 4 + (f * 2) % 4;
            c.p(x, 19, 2);
        }
        // pedestal + upper bowl
        c.r(14, 11, 4, 7, 1);
        c.r(15, 11, 1, 6, 2);
        c.r(8, 9, 16, 3, 1);
        c.r(8, 9, 16, 1, 2);
        c.r(9, 8, 14, 1, 3); // water in the bowl
        // jet
        let top = 1 + (f % 2);
        c.r(15, top, 2, 8 - top, 3);
        // droplets falling on both sides, moving between frames
        let drops: [(i32, i32); 6] = [(11, 3), (20, 3), (9, 6), (22, 6), (7, 10), (24, 10)];
        for (k, &(x, y)) in drops.iter().enumerate() {
            let dy = ((f + k as i32) % 3) * 2;
            let y = y + dy - 1;
            if y + 1 < 17 {
                c.p(x, y, 3);
                c.p(x, y + 1, 3);
            }
        }
        // spray at the top
        c.p(14, top + 1, 3);
        c.p(17, top + 1, 3);
        c.p(13 + f % 2, top + 2, 3);
        c.p(18 - f % 2, top + 2, 3);
        frames.push(c);
    }
    r.insert("fountain".into(), sprite(&frames, [pal::GRAY, pal::LGRAY, pal::LCYAN]));
}

// ---- Kiosk, photobooth -----------------------------------------------------------------------------------

fn kiosk_and_booth(r: &mut Registry) {
    let mut frames = Vec::new();
    for f in 0..2i32 {
        let mut c = Canvas::new(24, 32);
        // pedestal
        c.r(7, 26, 10, 6, 1);
        c.r(5, 30, 14, 2, 1);
        c.r(7, 26, 1, 5, 3);
        // body
        c.r(2, 2, 20, 25, 1);
        c.r(2, 2, 20, 1, 3);
        c.r(2, 2, 1, 25, 3);
        // header sign
        c.r(5, 4, 14, 4, 3);
        c.r(6, 5, 12, 2, 1);
        c.r(11, 5, 2, 2, 3);
        // screen
        c.r(4, 10, 16, 14, 3);
        c.r(5, 11, 14, 12, 2);
        if f == 1 {
            // brighter glow: dither the screen towards white
            for y in 11..23 {
                for x in 5..19 {
                    if (x + y) % 2 == 0 {
                        c.p(x, y, 3);
                    }
                }
            }
        }
        // the "?"
        c.art(8, 12, "
..3333..
.33..33.
.....33.
....33..
...33...
...33...
........
...33...
...33...
");
        // dark pixel outline so the ? reads on the glow
        frames.push(c);
    }
    r.insert("kiosk".into(), sprite(&frames, [pal::DBLUE, pal::CYAN, pal::WHITE]));

    // Photo booth with a striped curtain.
    let base = |lit: bool| -> Canvas {
        let mut c = Canvas::new(24, 32);
        c.r(0, 0, 24, 32, 1);
        c.r(0, 0, 24, 1, 3);
        c.r(0, 0, 1, 32, 3);
        // sign with chasing lights
        c.r(3, 2, 18, 5, 2);
        c.r(4, 3, 16, 3, 3);
        for i in 0..8 {
            if (i % 2 == 0) == lit {
                c.p(4 + i * 2, 1, 3);
            }
        }
        // "PHOTO"-ish bars on the sign
        for i in 0..4 {
            c.r(5 + i * 4, 4, 2, 1, 2);
        }
        c
    };
    let mut frames = Vec::new();
    for f in 0..2i32 {
        let mut c = base(f == 0);
        // striped curtain, alternating red/white, sways a pixel
        for y in 9..27 {
            for x in 3..21 {
                let sway = if f == 1 && y > 20 { 1 } else { 0 };
                c.p(x, y, if ((x + sway) / 2) % 2 == 0 { 2 } else { 3 });
            }
        }
        c.r(3, 9, 18, 1, 1); // curtain rod
        // feet visible under the curtain
        c.r(8, 27, 3, 5, 1);
        c.r(13, 27, 3, 5, 1);
        c.r(8, 29, 3, 3, 3);
        c.r(13, 29, 3, 3, 3);
        c.r(8, 31, 3, 1, 1);
        c.r(13, 31, 3, 1, 1);
        frames.push(c);
    }
    let mut open = base(true);
    open.r(3, 9, 18, 18, 1);
    // curtains bunched at the sides
    for y in 9..27 {
        for x in 3..6 {
            open.p(x, y, if x % 2 == 1 { 2 } else { 3 });
        }
        for x in 18..21 {
            open.p(x, y, if x % 2 == 0 { 2 } else { 3 });
        }
    }
    // a stool inside and the back wall
    open.r(6, 10, 12, 16, 1);
    open.r(8, 19, 8, 2, 2);
    open.r(11, 21, 2, 6, 3);
    open.r(9, 26, 6, 1, 3);
    open.r(10, 12, 4, 3, 3);
    open.r(11, 13, 2, 1, 1);
    open.r(3, 27, 18, 5, 1);
    open.r(3, 31, 18, 1, 3);
    r.insert("photobooth".into(), sprite(&frames, [pal::DPURPLE, pal::RED, pal::WHITE]));
    r.insert("photobooth_open".into(), sprite(&[open], [pal::DPURPLE, pal::RED, pal::WHITE]));
}

// ---- Elevator --------------------------------------------------------------------------------------------

fn elevator(r: &mut Registry) {
    let cols = [pal::DGRAY, pal::GRAY, pal::LGRAY];
    let shell = |c: &mut Canvas| {
        // door frame: grey jambs with a lighter edge, header with a lamp
        c.r(0, 0, 24, 38, 2);
        c.r(0, 0, 24, 1, 3);
        c.r(0, 0, 1, 38, 3);
        c.r(23, 0, 1, 38, 1);
        c.r(0, 0, 24, 4, 2);
        c.r(0, 3, 24, 1, 1);
        c.r(10, 1, 4, 2, 1);
        c.r(11, 1, 2, 1, 3); // indicator lamp
    };
    let mut frames = Vec::new();
    for gap in [0, 3, 10] {
        let mut c = Canvas::new(24, 38);
        shell(&mut c);
        // opening 2..22 wide, rows 4..38
        c.r(2, 4, 20, 34, 1);
        if gap >= 10 {
            // fully open: empty cabin interior. Dark side walls, lit back wall, handrail, floor.
            c.r(4, 6, 16, 28, 2);
            c.r(4, 6, 16, 1, 3);
            c.r(4, 6, 1, 28, 3);
            c.r(2, 4, 2, 34, 1);
            c.r(20, 4, 2, 34, 1);
            c.r(4, 22, 16, 1, 3); // handrail
            c.r(4, 23, 16, 1, 1);
            c.r(9, 8, 6, 2, 1);
            c.r(10, 8, 4, 1, 3); // floor indicator
            c.r(2, 34, 20, 4, 1);
            for x in (2..22).step_by(2) {
                c.p(x, 35, 2);
            }
            c.r(2, 34, 20, 1, 3);
        } else {
            // two sliding doors that part by `gap` px in the middle (0 = closed)
            let half = (20 - gap) / 2;
            for (x0, shine) in [(2, 3), (22 - half, 3)] {
                c.r(x0, 4, half, 34, 2);
                c.r(x0 + if x0 == 2 { 1 } else { 1 }, 4, 1, 34, shine);
                for y in (6..36).step_by(6) {
                    c.r(x0, y, half, 1, 1);
                }
            }
            if gap == 0 {
                c.r(11, 4, 2, 34, 1);
            } else {
                // a sliver of cabin light in the gap
                c.r(2 + half, 4, gap, 34, 1);
                c.r(2 + half + 1, 6, gap - 2, 28, 3);
            }
        }
        frames.push(c);
    }
    r.insert("elev_car".into(), sprite(&frames, cols));

    // Empty shaft opening: dark well, a cable down the middle, guide rails.
    let mut c = Canvas::new(24, 38);
    shell(&mut c);
    c.r(2, 4, 20, 34, 1);
    c.r(4, 4, 1, 34, 2);
    c.r(19, 4, 1, 34, 2);
    c.r(11, 4, 2, 34, 3);
    c.r(11, 4, 1, 34, 2);
    for y in (6..38).step_by(4) {
        c.p(12, y, 2);
    }
    c.r(2, 36, 20, 2, 1);
    r.insert("elev_door_frame".into(), sprite(&[c], cols));

    // Grate floor.
    let mut c = Canvas::new(24, 4);
    c.r(0, 0, 24, 1, 3);
    c.r(0, 3, 24, 1, 1);
    for x in 0..24 {
        c.p(x, 1, if x % 3 == 0 { 1 } else { 2 });
        c.p(x, 2, if x % 3 == 1 { 1 } else { 2 });
    }
    r.insert("elev_grate".into(), sprite(&[c], cols));

    // Escalator step: ridged tread (the ridges shift between frames).
    let step = |ph: i32| -> Canvas {
        let mut c = Canvas::new(8, 4);
        c.r(0, 0, 8, 1, 3);
        for x in 0..8 {
            c.p(x, 1, if (x + ph) % 2 == 0 { 1 } else { 2 });
        }
        c.r(0, 2, 8, 2, 1);
        c.r(0, 2, 8, 1, 2);
        c
    };
    r.insert("esc_step".into(), sprite(&[step(0), step(1)], cols));
}

// ---- Small fixtures --------------------------------------------------------------------------------------

fn small_fixtures(r: &mut Registry) {
    r.insert(
        "wet_sign".into(),
        frames_of(
            &["
..1111..
.122221.
.121121.
12211221
12211221
12211221
12222221
12211221
12222221
12222221
11111111
1......1
"],
            8,
            12,
            [pal::BLACK, pal::YELLOW, pal::ORANGE],
        ),
    );

    r.insert(
        "shutter_slat".into(),
        frames_of(
            &["
3333333333333333
2222222222222222
2121212121212121
1111111111111111
"],
            16,
            4,
            [pal::DGRAY, pal::GRAY, pal::LGRAY],
        ),
    );

    // EXIT sign.
    let mut c = Canvas::new(16, 8);
    c.r(0, 0, 16, 8, 2);
    c.r(0, 0, 16, 1, 1);
    c.r(0, 7, 16, 1, 1);
    for y in 1..6 {
        for x in 0..16 {
            c.p(x, y, 2);
        }
    }
    let e = ["333", "3..", "33.", "3..", "333"];
    let x_ = ["3.3", "3.3", ".3.", "3.3", "3.3"];
    let i = ["333", ".3.", ".3.", ".3.", "333"];
    let t = ["333", ".3.", ".3.", ".3.", ".3."];
    for (gi, g) in [e, x_, i, t].iter().enumerate() {
        for (y, row) in g.iter().enumerate() {
            for (x, ch) in row.chars().enumerate() {
                if ch == '3' {
                    c.p(1 + gi as i32 * 4 + x as i32, 1 + y as i32, 3);
                }
            }
        }
    }
    r.insert("exit_sign".into(), sprite(&[c], [pal::DGREEN, pal::GREEN, pal::WHITE]));

    // Vending machine.
    let mut c = Canvas::new(16, 24);
    c.r(0, 0, 16, 24, 2);
    c.o(0, 0, 16, 24, 1);
    c.r(1, 1, 1, 22, 3);
    c.r(2, 2, 9, 15, 1);
    c.r(3, 3, 7, 13, 3);
    // products: rows of coloured cans (2 = red, 1 = dark) on white shelves
    for (row, y) in [4, 8, 12].iter().enumerate() {
        for k in 0..3 {
            c.r(4 + k * 2, *y, 1, 3, if (row + k as usize) % 2 == 0 { 2 } else { 1 });
        }
    }
    // control panel and coin slot
    c.r(12, 3, 3, 4, 1);
    c.p(13, 4, 3);
    c.p(13, 6, 3);
    c.r(12, 9, 3, 2, 1);
    c.p(13, 9, 3);
    c.r(12, 13, 3, 3, 3);
    c.p(13, 14, 1);
    // dispenser tray
    c.r(3, 18, 10, 4, 1);
    c.r(4, 19, 8, 2, 3);
    c.r(0, 23, 16, 1, 1);
    r.insert("vending".into(), sprite(&[c], [pal::BLACK, pal::RED, pal::WHITE]));

    // Trash can.
    r.insert(
        "trash_can".into(),
        frames_of(
            &["
..1111..
.133331.
11111111
.122221.
.121221.
.122221.
.121221.
.122221.
.121221.
.122221.
.122221.
..1111..
"],
            8,
            12,
            [pal::DGRAY, pal::GRAY, pal::LGRAY],
        ),
    );
}

// ---- Station wagon ---------------------------------------------------------------------------------------

fn wagon(r: &mut Registry) {
    let mut frames = Vec::new();
    for f in 0..2 {
        let mut c = Canvas::new(56, 24);
        // body (1 = black: windows, wheel wells, tyres; 2 = sky-blue paint; 3 = wood panelling / lights)
        c.r(1, 8, 54, 12, 2);
        c.r(0, 10, 56, 8, 2);
        c.r(6, 3, 42, 6, 2); // cabin
        c.r(4, 5, 2, 4, 2);
        // roof rack
        c.r(8, 1, 38, 1, 1);
        c.r(10, 2, 1, 1, 1);
        c.r(43, 2, 1, 1, 1);
        for x in (14..42).step_by(4) {
            c.p(x, 2, 1);
        }
        // windows with a glint
        for (x, w) in [(8, 11), (21, 11), (34, 12)] {
            c.r(x, 4, w, 4, 1);
            c.r(x + 1, 5, 3, 1, 2);
        }
        // wood panelling stripe along the side, with grain
        c.r(1, 11, 54, 5, 3);
        c.r(1, 11, 54, 1, 1);
        c.r(1, 15, 54, 1, 1);
        for x in (3..53).step_by(5) {
            c.p(x, 13, 1);
            c.p(x + 2, 12, 1);
            c.p(x + 1, 14, 1);
        }
        // door seams
        for x in [20, 33, 46] {
            c.r(x, 5, 1, 3, 1);
            c.r(x, 16, 1, 3, 1);
        }
        // rocker panel and bumpers
        c.r(2, 19, 52, 1, 1);
        c.r(0, 17, 2, 3, 1);
        c.r(54, 17, 2, 3, 1);
        // head light (front is right) and tail light (left)
        c.r(54, 9, 2, 2, 3);
        c.r(0, 8, 2, 3, if f == 1 { 3 } else { 1 });
        if f == 1 {
            // brake-light glow
            c.p(2, 9, 3);
            c.p(2, 7, 3);
            c.p(0, 6, 3);
            c.p(1, 6, 3);
        }
        // wheel wells, tyres and hubcaps
        for cx in [12, 43] {
            c.r(cx - 6, 16, 13, 8, 1);
            c.r(cx - 2, 19, 5, 5, 2);
            c.r(cx - 1, 20, 3, 3, 1);
            c.p(cx, 21, 2);
        }
        frames.push(c);
    }
    r.insert("station_wagon".into(), sprite(&frames, [pal::BLACK, pal::LBLUE, pal::ORANGE]));
}

// ---- Pillar, anchor post ---------------------------------------------------------------------------------

fn pillar_and_post(r: &mut Registry) {
    let mut c = Canvas::new(16, 48);
    c.r(0, 0, 16, 48, 2);
    c.r(0, 0, 2, 48, 3); // lit left edge
    c.r(13, 0, 3, 48, 1); // shaded right side
    c.r(0, 0, 16, 2, 3);
    c.r(0, 2, 16, 1, 1);
    // concrete texture
    for (x, y) in [(5, 8), (9, 14), (4, 20), (10, 27), (6, 33), (8, 5)] {
        c.p(x, y, 1);
    }
    // hazard stripes at the base
    for y in 36..46 {
        for x in 0..16 {
            let v = (x + y) / 3 % 2;
            c.p(x, y, if v == 0 { 3 } else { 1 });
        }
    }
    c.r(0, 36, 16, 1, 1);
    c.r(0, 45, 16, 1, 1);
    c.r(0, 46, 16, 2, 1);
    c.r(0, 46, 16, 1, 3);
    r.insert("pillar".into(), sprite(&[c], [pal::DGRAY, pal::LGRAY, pal::YELLOW]));

    // Roof anchor post: steel post with an eye ring and a red band.
    let mut c = Canvas::new(8, 24);
    c.art(0, 0, "
..3333..
.3....3.
.3....3.
.3....3.
..3333..
...22...
...22...
...22...
...22...
...22...
..1221..
..1221..
..1221..
..1221..
..1221..
..1221..
..1221..
..1221..
..1221..
..1221..
.111111.
11111111
22222222
11111111
");
    c.r(2, 12, 4, 2, 3);
    r.insert("anchor_post".into(), sprite(&[c], [pal::DGRAY, pal::LGRAY, pal::RED]));
}

// ---- Skyscraper ------------------------------------------------------------------------------------------

fn skyscraper(r: &mut Registry) {
    let mut frames = Vec::new();
    // tiers: (x, y, w) down to the bottom of the sprite
    let tiers: [(i32, i32, i32); 3] = [(24, 6, 16), (14, 18, 36), (4, 34, 56)];
    for f in 0..2u32 {
        let mut c = Canvas::new(64, 112);
        // antenna and spire
        c.r(31, 0, 2, 6, 3);
        c.p(31, 0, 2);
        for (x, y, w) in tiers {
            c.r(x, y, w, 112 - y, 1);
            // lit left edge and a roof cornice
            c.r(x, y, 1, 112 - y, 3);
            c.r(x - 1, y, w + 2, 1, 3);
            c.r(x + w - 1, y, 1, 112 - y, 1);
        }
        // windows: 3x3 panes on a 5x6 pitch, each tier only in its own band (above the next, wider tier)
        let mut seed: u32 = 12345;
        for (ti, &(x, y, w)) in tiers.iter().enumerate() {
            let y_end = tiers.get(ti + 1).map(|t| t.1).unwrap_or(110);
            let mut wy = y + 4;
            while wy + 3 < y_end.min(110) {
                let mut wx = x + 3;
                while wx + 3 < x + w - 1 {
                    seed = seed.wrapping_mul(1103515245).wrapping_add(12345);
                    let rnd = (seed >> 16) & 0xff;
                    // most windows are steady; two groups swap places between frames (the flicker)
                    let lit = if (150..190).contains(&rnd) {
                        f == 1
                    } else if (190..225).contains(&rnd) {
                        f == 0
                    } else {
                        rnd < 150
                    };
                    if lit {
                        c.r(wx, wy, 3, 3, 2);
                    } else {
                        c.p(wx, wy, 3);
                    }
                    wx += 5;
                }
                wy += 6;
            }
        }
        // base entrance
        c.r(26, 104, 12, 8, 3);
        c.r(27, 105, 10, 7, 2);
        c.r(31, 105, 2, 7, 1);
        frames.push(c);
    }
    r.insert("skyscraper".into(), sprite(&frames, [pal::NAVY, pal::LYELLOW, pal::MBLUE]));
}

#[cfg(test)]
mod tests {
    use crate::art;

    fn px(name: &str, f: usize, x: usize, y: usize) -> u8 {
        let s = art::get(name);
        s.frames[f][y * s.w + x]
    }

    #[test]
    fn lamp_cord_starts_on_the_top_row_and_glow_flickers() {
        assert!(px("lamp", 0, 7, 0) != 0 || px("lamp", 0, 8, 0) != 0);
        assert!(px("lamp", 1, 7, 0) != 0 || px("lamp", 1, 8, 0) != 0);
        assert_ne!(art::get("lamp").frames[0], art::get("lamp").frames[1]);
    }

    #[test]
    fn disco_ball_has_four_distinct_sparkle_frames() {
        let s = art::get("disco_ball");
        assert_eq!(s.frame_count(), 4);
        for a in 0..4 {
            for b in a + 1..4 {
                assert_ne!(s.frames[a], s.frames[b]);
            }
        }
    }

    #[test]
    fn elevator_car_opens_progressively() {
        let s = art::get("elev_car");
        assert_eq!(s.frame_count(), 3);
        // count of dark "opening" pixels (colour 1) inside the door area grows as the doors open
        let dark = |f: usize| s.frames[f].iter().filter(|p| **p == 1).count();
        assert!(dark(0) < dark(1) && dark(1) < dark(2), "doors should open wider each frame");
        assert_ne!(s.frames[0], s.frames[1]);
        assert_ne!(s.frames[1], s.frames[2]);
        // the sides of the frame stay put in every frame
        for f in 1..3 {
            for y in 0..s.h {
                assert_eq!(s.frames[f][y * s.w], s.frames[0][y * s.w], "left frame edge differs at row {y}");
            }
        }
    }

    #[test]
    fn station_wagon_brake_lights_only_in_frame_one() {
        let s = art::get("station_wagon");
        assert_eq!(s.frame_count(), 2);
        let lit = |f: usize| s.frames[f].iter().filter(|p| **p == 3).count();
        assert!(lit(1) > lit(0), "frame 1 lights the brake lights");
    }

    #[test]
    fn skyscraper_windows_flicker_but_the_tower_does_not() {
        let s = art::get("skyscraper");
        let diff = s.frames[0].iter().zip(&s.frames[1]).filter(|(a, b)| a != b).count();
        assert!(diff > 50, "some windows must change");
        assert!(diff < s.w * s.h / 4, "most of the tower must stay the same");
        let lit = s.frames[0].iter().filter(|p| **p == 2).count();
        assert!(lit > 300, "a grid of lit windows");
    }

    #[test]
    fn fountain_water_moves() {
        let s = art::get("fountain");
        assert_eq!(s.frame_count(), 3);
        assert_ne!(s.frames[0], s.frames[1]);
        assert_ne!(s.frames[1], s.frames[2]);
    }

    #[test]
    fn fixtures_rest_on_the_bottom_row() {
        for n in ["bench", "plant", "fountain", "kiosk", "photobooth", "photobooth_open", "station_wagon", "pillar", "anchor_post", "vending", "trash_can", "wet_sign"] {
            let s = art::get(n);
            let last = s.h - 1;
            assert!((0..s.w).any(|x| s.frames[0][last * s.w + x] != 0), "{n} does not reach its bottom row");
        }
    }
}
