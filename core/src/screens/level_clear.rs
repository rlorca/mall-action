//! Level clear sequence: parking garage chase, tally, THE DAILY MALL front page, mission-complete SPYGRAM
//! post (screens agent 1 owns this file).
//!
//! Four stages, each skippable with START (one stage per press): 0 garage chase, 1 tally, 2 newspaper,
//! 3 SPYGRAM post. After stage 3 `step` returns true and the next loop begins. Everything (headline, post,
//! filler) is chosen from the seed, so a seed always replays the same sequence.

use super::spygram::{blit_scaled, draw_card, Photo, CARD_H, CARD_W};
use super::title::fancy_text;
use crate::art;
use crate::copy::{wrap, Post, CLEAR_POSTS, HEADLINES, HEADLINE_LINE_MAX};
use crate::events::{Out, Sfx, Track};
use crate::input::{PadState, START};
use crate::pixel::{pal, text_width, Fb, FontKind, Rect, H, W};
use crate::rng::Rng;
use crate::types::PACKAGES_TOTAL;
use crate::ui::blink;

/// Frames in each stage (60 Hz): chase 4.5 s, tally 4.5 s, newspaper 5.5 s, SPYGRAM 5 s.
pub const STAGE_FRAMES: [u32; 4] = [270, 270, 330, 300];
pub const STAGES: usize = 4;
/// Tally: first line appears this late, then one line every `TALLY_STEP` frames.
pub const TALLY_FIRST: u32 = 24;
pub const TALLY_STEP: u32 = 36;
/// Newspaper spin-in length.
pub const SPIN_FRAMES: u32 = 48;
/// SPYGRAM card slide-in length.
pub const SLIDE_FRAMES: u32 = 22;

const DATE_JOKES: [&str; 4] = [
    "FRIDAY THE 13TH OF NEVER",
    "SATURDAY, ALL SALES FINAL",
    "SUNDAY (MALL HOURS APPLY)",
    "A DATE. LATE FEES APPLY.",
];

pub struct LevelClear {
    packages: u32,
    time_bonus: u32,
    clear_bonus: u32,
    loop_no: u32,
    seed: u64,
    headline: usize,
    post: usize,
    date_joke: usize,
    stage: usize,
    t: u32,
    done: bool,
}

impl LevelClear {
    /// `packages` collected, `time_bonus` and `clear_bonus` points already awarded, `loop_no` just finished.
    pub fn new(packages: u32, time_bonus: u32, clear_bonus: u32, loop_no: u32, seed: u64) -> LevelClear {
        let mut rng = Rng::new(seed);
        let headline = rng.below(HEADLINES.len() as u32) as usize;
        let post = rng.below(CLEAR_POSTS.len() as u32) as usize;
        let date_joke = rng.below(DATE_JOKES.len() as u32) as usize;
        LevelClear { packages, time_bonus, clear_bonus, loop_no, seed, headline, post, date_joke, stage: 0, t: 0, done: false }
    }

    /// Current stage 0..=3 (garage, tally, newspaper, SPYGRAM).
    pub fn stage(&self) -> usize {
        self.stage
    }

    /// Frames spent in the current stage.
    pub fn stage_frame(&self) -> u32 {
        self.t
    }

    pub fn headline(&self) -> &'static str {
        HEADLINES[self.headline]
    }

    pub fn post(&self) -> &'static Post {
        &CLEAR_POSTS[self.post]
    }

    /// The tally lines in order (full text as shown).
    pub fn tally_lines(&self) -> Vec<String> {
        vec![
            format!("PACKAGES {}/{}", self.packages, PACKAGES_TOTAL),
            format!("TIME BONUS {}", self.time_bonus),
            format!("CLEAR BONUS {}", self.clear_bonus),
            format!("LOOP {}", self.loop_no),
        ]
    }

    pub fn next_loop_text(&self) -> String {
        format!("NEXT: LOOP {}", self.loop_no + 1)
    }

    fn enter_stage(&mut self, out: &mut Out) {
        self.t = 0;
        match self.stage {
            2 => out.sfx(Sfx::Zip),
            3 => out.sfx(Sfx::Ding),
            _ => {}
        }
    }

    /// Advance to the next stage; true when that was the last one.
    fn advance(&mut self, out: &mut Out) -> bool {
        self.stage += 1;
        if self.stage >= STAGES {
            self.done = true;
            return true;
        }
        self.enter_stage(out);
        false
    }

    /// Returns true when the sequence is over (Start skips ahead stage by stage) and the next loop should begin.
    pub fn step(&mut self, pad: PadState, out: &mut Out) -> bool {
        if self.done {
            return true;
        }
        if self.stage == 0 && self.t == 0 {
            out.music(Track::LevelClear);
        }
        if pad.just_pressed(START) {
            return self.advance(out);
        }
        self.t += 1;
        if self.stage == 1 {
            self.tally_sfx(out);
        }
        if self.t >= STAGE_FRAMES[self.stage] {
            return self.advance(out);
        }
        false
    }

    /// Sound for the line that is being revealed / counted at the current frame of the tally stage.
    fn tally_sfx(&self, out: &mut Out) {
        if self.t < TALLY_FIRST {
            return;
        }
        let since = self.t - TALLY_FIRST;
        let line = (since / TALLY_STEP) as usize;
        let into = since % TALLY_STEP;
        if line >= 5 {
            return;
        }
        if into == 0 {
            out.sfx(if line == 4 { Sfx::Coins } else { Sfx::Tick });
        } else if (line == 1 || line == 2) && into < 24 && into % 4 == 0 {
            out.sfx(Sfx::Tick); // the bonus digits roll up
        }
    }

    pub fn draw(&self, fb: &mut Fb) {
        match self.stage {
            0 => self.draw_chase(fb),
            1 => self.draw_tally(fb),
            2 => self.draw_paper_stage(fb),
            _ => self.draw_spygram_stage(fb),
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Stage 0: parking garage
    // ---------------------------------------------------------------------------------------------

    fn draw_chase(&self, fb: &mut Fb) {
        let t = self.t;
        draw_garage(fb, t);
        let base = 204;
        // wagon: brake lights on (frame 1) for the first 20 frames, then it floors it to the right
        let go = t.saturating_sub(20) as f32;
        let wx = 96 + (go * go * 0.045) as i32;
        let wagon = art::get("station_wagon");
        // exhaust puffs behind it
        if t >= 20 {
            for k in 0..14u32 {
                let born = 20 + k * 3;
                if t < born || t - born > 30 {
                    continue;
                }
                let age = (t - born) as i32;
                let bg = (born - 20) as f32;
                let bx = 96 + (bg * bg * 0.045) as i32 + 6;
                let r = 2 + age / 6;
                let py = base - 10 - age / 2;
                let c = if age < 14 { pal::LGRAY } else { pal::GRAY };
                fb.rect(bx - r - age / 3, py - r, r * 2, r * 2, c);
                fb.dither_rect(bx - r - age / 3 - 1, py - r - 1, r * 2 + 2, r * 2 + 2, pal::DGRAY, age);
            }
        }
        // shadow + car
        fb.rect(wx + 4, base - 2, 104, 4, pal::DGRAY);
        let wf = if t < 20 { 1 } else { 0 };
        blit_scaled(fb, wagon, wf, wx, base - 48 + 2, 2, false);
        if t < 20 {
            // brake light glow
            let g = if (t / 4) % 2 == 0 { pal::LRED } else { pal::RED };
            fb.rect(wx - 2, base - 30, 3, 6, g);
        }
        // the spy: chases it, waving a receipt
        let sx = if t < 20 { 18 } else { 18 + ((t - 20) * 2) as i32 };
        let bob = if t >= 20 && (t / 4) % 2 == 0 { 1 } else { 0 };
        let spy = art::get("spy_wave");
        blit_scaled(fb, spy, (t / 8) as usize, sx, base - 48 - bob, 2, false);
        let rc = art::get("receipt");
        let wave = (t / 6) % 2;
        blit_scaled(fb, rc, wave as usize, sx + 26, base - 48 - 28 - bob, 2, false);
        // banner
        if (8..170).contains(&t) {
            let txt = "MISSION COMPLETE!";
            let w = Fb::text_scaled_width(txt, 2);
            let y = 26 + if t < 16 { (16 - t as i32) * 3 } else { 0 };
            fancy_text(fb, (W as i32 - w) / 2, y, txt, 2, pal::LYELLOW, pal::ORANGE, pal::BLACK, pal::DPURPLE);
        }
        // spy shout
        if t > 40 && t < 130 {
            let (x, y) = (sx.min(150) + 24, base - 48 - 36);
            crate::ui::speech_bubble(fb, "MY RECEIPT!", x, y + 12);
        }
        hint(fb, t);
    }

    // ---------------------------------------------------------------------------------------------
    // Stage 1: tally
    // ---------------------------------------------------------------------------------------------

    fn draw_tally(&self, fb: &mut Fb) {
        let t = self.t;
        let cx = W as i32 / 2;
        fb.clear(pal::DBLUE);
        fb.dither_rect(0, 0, W as i32, H as i32, pal::NAVY, 0);
        // a receipt printing out
        let (px, pw) = (40, 176);
        let top = 14;
        let bottom = H as i32 - 24;
        fb.rect(px + 3, top + 3, pw, bottom - top, pal::BLACK);
        fb.rect(px, top, pw, bottom - top, pal::WHITE);
        for x in (px..px + pw).step_by(8) {
            // zigzag torn edges
            fb.rect(x, top - 3, 4, 3, pal::WHITE);
            fb.rect(x + 4, bottom, 4, 3, pal::WHITE);
        }
        fb.text_center(cx, top + 8, "*** MALL ACTION ***", pal::DGRAY);
        fb.text_center_tiny(cx, top + 20, "MISSION REPORT - KEEP FOR YOUR RECORDS", pal::GRAY);
        dashes(fb, px + 6, top + 29, pw - 12);

        let lines = self.tally_lines();
        let values = [
            format!("{}/{}", self.packages, PACKAGES_TOTAL),
            self.time_bonus.to_string(),
            self.clear_bonus.to_string(),
            String::new(),
        ];
        let labels = ["PACKAGES", "TIME BONUS", "CLEAR BONUS", ""];
        for i in 0..3 {
            let at = TALLY_FIRST + i as u32 * TALLY_STEP;
            if t < at {
                break;
            }
            let y = top + 40 + i as i32 * 24;
            let rowc = if i == 0 { pal::BLACK } else { pal::DGRAY };
            fb.text(px + 10, y, labels[i], rowc);
            // bonus numbers roll up for 24 frames
            let shown = match i {
                0 => values[0].clone(),
                _ => {
                    let target: u32 = if i == 1 { self.time_bonus } else { self.clear_bonus };
                    let p = (t - at).min(24);
                    (target as u64 * p as u64 / 24).to_string()
                }
            };
            let col = if i == 0 { pal::GREEN } else { pal::BLUE };
            fb.text_right(px + pw - 10, y, &shown, col);
            dashes(fb, px + 10, y + 11, pw - 20);
        }
        // total
        let at_total = TALLY_FIRST + 3 * TALLY_STEP;
        if t >= at_total {
            let total = self.time_bonus + self.clear_bonus;
            let y = top + 40 + 3 * 24 - 4;
            fb.text(px + 10, y, "TOTAL", pal::BLACK);
            fb.text_right(px + pw - 10, y, &format!("+{total}"), pal::RED);
            fb.rect(px + 10, y + 10, pw - 20, 2, pal::BLACK);
        }
        // LOOP n and the next-loop warning
        let at_loop = TALLY_FIRST + 4 * TALLY_STEP;
        if t >= at_loop {
            let s = &lines[3];
            let w = Fb::text_scaled_width(s, 3);
            fancy_text(fb, cx - w / 2, top + 126, s, 3, pal::LYELLOW, pal::ORANGE, pal::BLACK, pal::DGRAY);
        }
        if t >= at_loop + 16 {
            let s = self.next_loop_text();
            fb.text_center(cx, top + 166, &s, pal::BLACK);
            if blink(t, 16, 10) {
                fb.text_center(cx, top + 180, "IT GETS HARDER!", pal::RED);
            }
        }
        // barcode
        let mut rng = Rng::new(self.seed ^ 0xBA2C0DE);
        let mut x = px + 20;
        while x < px + pw - 20 {
            let w = 1 + rng.below(3) as i32;
            fb.rect(x, bottom - 22, w, 12, pal::BLACK);
            x += w + 1 + rng.below(2) as i32;
        }
        hint(fb, t);
    }

    // ---------------------------------------------------------------------------------------------
    // Stage 2: THE DAILY MALL
    // ---------------------------------------------------------------------------------------------

    fn draw_paper_stage(&self, fb: &mut Fb) {
        let t = self.t;
        fb.clear(pal::DBROWN);
        fb.dither_rect(0, 0, W as i32, H as i32, pal::BLACK, 0);
        let mut page = Fb::new();
        self.draw_front_page(&mut page);
        if t >= SPIN_FRAMES {
            fb.px.copy_from_slice(&page.px);
        } else {
            // the paper spins in: it zooms up while turning about its vertical axis (twice)
            let p = t as f32 / SPIN_FRAMES as f32;
            let scale = p * (2.0 - p); // ease out
            let turns = (1.0 - p) * 2.0;
            let frac = turns - turns.floor();
            let wf = (1.0 - 2.0 * frac).abs().max(0.08); // cos-like 1..0..1
            let tw = (W as f32 * scale * wf) as i32;
            let th = (H as f32 * scale) as i32;
            let tilt = ((1.0 - p) * 14.0) as i32 * if (turns as i32) % 2 == 0 { 1 } else { -1 };
            blit_zoom(fb, &page, W as i32 / 2, H as i32 / 2 + tilt, tw, th);
        }
        if t >= SPIN_FRAMES + 40 {
            hint(fb, t);
        }
    }

    fn draw_front_page(&self, pg: &mut Fb) {
        let paper = pal::TAN;
        let ink = pal::BLACK;
        let faint = pal::DBROWN;
        pg.clear(paper);
        // top strip
        pg.text_tiny(6, 5, "VOL. XIX  NO. 7", faint);
        pg.text_right(250, 5, "WEATHER: FLUORESCENT", faint);
        pg.rect(4, 12, 248, 2, ink);
        // masthead
        let title = "THE DAILY MALL";
        let tw = Fb::text_scaled_width(title, 2);
        pg.text_scaled((W as i32 - tw) / 2 + 1, 18 + 1, title, pal::GRAY, 2);
        pg.text_scaled((W as i32 - tw) / 2, 18, title, ink, 2);
        for (x, a, b) in [(5, "EST.", "1983"), (213, "50", "CENTS")] {
            pg.frame(x, 16, 38, 17, ink);
            pg.text_center_tiny(x + 19, 19, a, ink);
            pg.text_center_tiny(x + 19, 26, b, ink);
        }
        pg.rect(4, 36, 248, 1, ink);
        pg.rect(4, 38, 248, 2, ink);
        pg.text_center_tiny(128, 43, DATE_JOKES[self.date_joke], ink);
        pg.rect(4, 50, 248, 1, ink);

        // headline, bold, wrapped to 26 characters
        let lines = wrap(HEADLINES[self.headline], HEADLINE_LINE_MAX);
        for (i, l) in lines.iter().enumerate() {
            let y = 57 + i as i32 * 10;
            pg.text(7, y, l, ink);
            pg.text(8, y, l, ink);
        }
        let ey = 57 + lines.len() as i32 * 10 + 1;
        pg.rect(7, ey, 158, 1, ink);
        pg.text_tiny(7, ey + 4, "BY OUR STAFF REPORTER", faint);
        pg.text_tiny(7, ey + 10, "(WHO WAS NOT PRESENT)", faint);

        // the photo
        draw_news_photo(pg, 172, 55, 78, 66);
        pg.text_center_tiny(211, 124, "SPY CHASES WAGON", faint);

        // a short blurb under the byline
        let mut by = ey + 18;
        let mut brng = Rng::new(self.seed ^ 0xB1AB);
        while by < 124 {
            let w = 150 - brng.below(40) as i32 * (by > 112) as i32;
            pg.rect(7, by, w, 3, faint);
            pg.dither_rect(7, by, w, 3, paper, 0);
            by += 5;
        }
        // filler columns: grey bars of text
        let mut rng = Rng::new(self.seed ^ 0xDA11_1);
        let cols = [(6, 78), (91, 78), (176, 74)];
        let top = (ey + 20).max(133);
        pg.rect(4, top - 5, 248, 1, ink);
        for (ci, &(cx, cw)) in cols.iter().enumerate() {
            let mut y = top;
            if ci == 1 {
                pg.text_tiny(cx, y, "MALL WALKERS ANGRY", ink);
                pg.text_tiny(cx, y + 6, "ABOUT BEING ANGRY", ink);
                y += 14;
            }
            if ci == 0 {
                // drop cap
                pg.rect(cx, y, 11, 11, ink);
                pg.text(cx + 3, y + 2, "T", paper);
            }
            while y < 226 {
                let in_cap = ci == 0 && y < top + 12;
                let x0 = if in_cap { cx + 13 } else { cx };
                let w = if rng.chance(0.12) { 18 + rng.below(30) as i32 } else { cw };
                let w = (w - (x0 - cx)).max(8);
                pg.rect(x0, y, w, 3, faint);
                pg.dither_rect(x0, y, w, 3, paper, 0);
                y += 5;
                if w < cw / 2 && !in_cap {
                    y += 3; // paragraph gap
                }
            }
            if ci < 2 {
                pg.rect(cx + cw + 2, top - 3, 1, 226 - top + 6, faint);
            }
        }
        // coupon box
        pg.rect(176, 193, 74, 33, paper);
        pg.frame(176, 193, 74, 33, ink);
        pg.frame(178, 195, 70, 29, ink);
        pg.text_center(213, 199, "COUPON", ink);
        pg.text_center(213, 209, "70% OFF", pal::RED);
        pg.text_center_tiny(213, 218, "VOID IN MALLS", faint);
    }

    // ---------------------------------------------------------------------------------------------
    // Stage 3: SPYGRAM
    // ---------------------------------------------------------------------------------------------

    fn draw_spygram_stage(&self, fb: &mut Fb) {
        let t = self.t;
        // phone-screen backdrop: soft diagonal magenta stripes
        fb.clear(pal::DPURPLE);
        for y in (0..H as i32).step_by(8) {
            fb.rect(0, y, W as i32, 4, pal::PLUM);
        }
        fb.dither_rect(0, 0, W as i32, H as i32, pal::DPURPLE, 0);
        let cx = (W as i32 - CARD_W) / 2;
        let cy_final = 38;
        let y = if t < SLIDE_FRAMES {
            let p = t as i32;
            let q = SLIDE_FRAMES as i32 - p;
            cy_final + q * q * 230 / (SLIDE_FRAMES as i32 * SLIDE_FRAMES as i32)
        } else {
            cy_final
        };
        // soft drop shadow
        fb.rect(cx + 4, y + 4, CARD_W, CARD_H, pal::BLACK);
        draw_card(fb, cx, y, self.post(), Photo::Getaway, t);
        // notification bar
        let w = text_width(FontKind::Normal, "NEW POST FROM AGENT.7") + 14;
        let ny = if t < 12 { -14 + t as i32 * 2 } else { 10 };
        fb.rect((W as i32 - w) / 2, ny, w, 14, pal::BLACK);
        fb.frame((W as i32 - w) / 2, ny, w, 14, pal::MAGENTA);
        fb.text_center(W as i32 / 2, ny + 4, "NEW POST FROM AGENT.7", pal::WHITE);
        if t > 60 {
            hint(fb, t);
        }
        let _ = Rect::new(0, 0, 0, 0);
    }
}

/// Blinking "PRESS START" at the bottom: every stage can be skipped.
fn hint(fb: &mut Fb, t: u32) {
    if t > 30 && blink(t, 36, 24) {
        fb.text_center(W as i32 / 2 + 1, H as i32 - 12, "PRESS START", pal::BLACK);
        fb.text_center(W as i32 / 2, H as i32 - 13, "PRESS START", pal::WHITE);
    }
}

fn dashes(fb: &mut Fb, x: i32, y: i32, w: i32) {
    for dx in (0..w).step_by(4) {
        fb.rect(x + dx, y, 2, 1, pal::GRAY);
    }
}

/// Nearest-neighbour stretch of `src` (a full-screen page) into a `tw` x `th` box centred on (cx, cy).
fn blit_zoom(fb: &mut Fb, src: &Fb, cx: i32, cy: i32, tw: i32, th: i32) {
    if tw <= 0 || th <= 0 {
        return;
    }
    let (x0, y0) = (cx - tw / 2, cy - th / 2);
    for dy in 0..th {
        let sy = (dy * H as i32 / th).min(H as i32 - 1);
        for dx in 0..tw {
            let sx = (dx * W as i32 / tw).min(W as i32 - 1);
            fb.put(x0 + dx, y0 + dy, src.px[sy as usize * W + sx as usize]);
        }
    }
    fb.frame(x0, y0, tw, th, pal::BLACK);
}

/// Newsprint photo: halftoned garage with the station wagon and a running figure.
fn draw_news_photo(pg: &mut Fb, x: i32, y: i32, w: i32, h: i32) {
    pg.rect(x, y, w, h, pal::LGRAY);
    pg.rect(x, y, w, 22, pal::GRAY);
    pg.dither_rect(x, y + 22, w, h - 22, pal::WHITE, 0);
    pg.rect(x, y + h - 20, w, 20, pal::DGRAY);
    pg.dither_rect(x, y + h - 20, w, 20, pal::GRAY, 1);
    for px in (4..w).step_by(26) {
        pg.rect(x + px, y + 22, 5, h - 40, pal::DGRAY);
    }
    let gray = [pal::BLACK, pal::DGRAY, pal::LGRAY];
    let wg = art::get("station_wagon");
    pg.blit_col(wg, 0, x + 18, y + h - 38, false, gray);
    let spy = art::get("spy_wave");
    pg.blit_col(spy, 0, x + 4, y + h - 34, false, [pal::BLACK, pal::GRAY, pal::WHITE]);
    pg.frame(x, y, w, h, pal::BLACK);
    pg.frame(x - 1, y - 1, w + 2, h + 2, pal::BLACK);
}

/// Garage backdrop: concrete ceiling, pillars, back wall, floor with painted stall lines, dim lamps.
fn draw_garage(fb: &mut Fb, t: u32) {
    let w = W as i32;
    fb.clear(pal::CHARCOAL);
    // back wall
    fb.rect(0, 56, w, 96, pal::DGRAY);
    fb.dither_rect(0, 56, w, 96, pal::CHARCOAL, 0);
    // ceiling slab with beams
    fb.rect(0, 0, w, 56, pal::BLACK);
    fb.rect(0, 40, w, 16, pal::CHARCOAL);
    fb.rect(0, 54, w, 2, pal::GRAY);
    for bx in (0..w).step_by(64) {
        fb.rect(bx, 0, 4, 40, pal::CHARCOAL);
    }
    // dim lamps, one flickers now and then
    for (i, lx) in [28, 110, 192].iter().enumerate() {
        let on = !(i == 1 && t % 97 < 4);
        fb.rect(*lx, 44, 36, 4, if on { pal::LYELLOW } else { pal::OLIVE });
        fb.rect(*lx + 2, 48, 32, 1, pal::OLIVE);
        if on {
            fb.dither_rect(*lx - 6, 49, 48, 30, pal::DOLIVE, 0);
        }
    }
    // floor
    fb.rect(0, 152, w, H as i32 - 152, pal::GRAY);
    fb.rect(0, 152, w, 2, pal::LGRAY);
    fb.dither_rect(0, 154, w, 86, pal::DGRAY, 1);
    // stall lines (slanted for a touch of perspective) and a painted arrow
    for k in 0..7 {
        let x = -10 + k * 44;
        for y in 156..240 {
            fb.put(x + (y - 156) / 3 - 20, y, pal::YELLOW);
            fb.put(x + (y - 156) / 3 - 19, y, pal::YELLOW);
        }
    }
    // pillars in front of the back wall (2x)
    let pil = art::get("pillar");
    for px in [8, 124, 232] {
        blit_scaled(fb, pil, 0, px, 152 - 96 + 4, 2, false);
    }
    // curb stripe
    fb.rect(0, 150, w, 2, pal::YELLOW);
    for x in (0..w).step_by(16) {
        fb.rect(x, 150, 8, 2, pal::BLACK);
    }
    // P sign
    fb.rect(150, 62, 22, 22, pal::BLUE);
    fb.frame(150, 62, 22, 22, pal::WHITE);
    fb.text_scaled(157, 66, "P", pal::WHITE, 2);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn idle() -> PadState {
        PadState::default()
    }
    fn start() -> PadState {
        PadState::from_held(0, START)
    }

    #[test]
    fn plays_the_jingle_at_the_start() {
        let mut lc = LevelClear::new(6, 1000, 1000, 1, 1);
        let mut out = Out::new();
        lc.step(idle(), &mut out);
        assert!(out.events.contains(&crate::events::Event::Music(Track::LevelClear)));
        for _ in 0..50 {
            lc.step(idle(), &mut out);
        }
        let n = out.events.iter().filter(|e| matches!(e, crate::events::Event::Music(Track::LevelClear))).count();
        assert_eq!(n, 1);
    }

    #[test]
    fn stages_progress_in_order_with_their_durations() {
        let mut lc = LevelClear::new(6, 1000, 1000, 1, 1);
        let mut out = Out::new();
        let mut seen = vec![0usize];
        let mut frames = 0;
        while !lc.step(idle(), &mut out) {
            frames += 1;
            if *seen.last().unwrap() != lc.stage() {
                seen.push(lc.stage());
            }
            assert!(frames < 5000);
        }
        assert_eq!(seen, vec![0, 1, 2, 3]);
        // the call that returns true is the last frame: total = sum - 1 false steps
        assert_eq!(frames + 1, STAGE_FRAMES.iter().sum::<u32>());
    }

    #[test]
    fn start_skips_one_stage_at_a_time_and_ends_after_the_last() {
        let mut lc = LevelClear::new(6, 1000, 1000, 1, 1);
        let mut out = Out::new();
        assert_eq!(lc.stage(), 0);
        assert!(!lc.step(start(), &mut out));
        assert_eq!(lc.stage(), 1);
        assert_eq!(lc.stage_frame(), 0);
        assert!(!lc.step(start(), &mut out));
        assert_eq!(lc.stage(), 2);
        assert!(!lc.step(start(), &mut out));
        assert_eq!(lc.stage(), 3);
        assert!(lc.step(start(), &mut out));
        assert!(lc.step(idle(), &mut out), "stays finished");
    }

    #[test]
    fn returns_true_exactly_once_at_the_end_of_the_last_stage() {
        let mut lc = LevelClear::new(6, 1000, 1000, 1, 3);
        let mut out = Out::new();
        for _ in 0..3 {
            lc.step(start(), &mut out);
        }
        for f in 1..STAGE_FRAMES[3] {
            assert!(!lc.step(idle(), &mut out), "frame {f}");
        }
        assert!(lc.step(idle(), &mut out));
    }

    #[test]
    fn headline_and_post_come_from_the_copy_lists_and_cover_them() {
        let mut heads = std::collections::BTreeSet::new();
        let mut posts = std::collections::BTreeSet::new();
        for seed in 0..200u64 {
            let lc = LevelClear::new(6, 0, 0, 1, seed);
            assert!(HEADLINES.contains(&lc.headline()));
            assert!(CLEAR_POSTS.iter().any(|p| p.caption == lc.post().caption && p.who == lc.post().who));
            heads.insert(lc.headline());
            posts.insert(lc.post().caption[0]);
        }
        assert_eq!(heads.len(), HEADLINES.len(), "every headline can appear");
        assert!(posts.len() >= 8);
    }

    #[test]
    fn deterministic_for_a_seed() {
        let render = |seed| {
            let mut lc = LevelClear::new(6, 1500, 1000, 2, seed);
            let mut out = Out::new();
            let mut hashes = Vec::new();
            for st in 0..4 {
                for _ in 0..70 {
                    lc.step(idle(), &mut out);
                }
                let mut fb = Fb::new();
                lc.draw(&mut fb);
                hashes.push(fb.px.iter().fold(0u64, |h, p| h.wrapping_mul(131).wrapping_add(*p as u64)));
                lc.step(start(), &mut out);
                let _ = st;
            }
            (hashes, lc.headline())
        };
        assert_eq!(render(9), render(9));
    }

    #[test]
    fn tally_text_matches_the_brief() {
        let lc = LevelClear::new(6, 2350, 1000, 3, 1);
        assert_eq!(lc.tally_lines(), vec!["PACKAGES 6/6", "TIME BONUS 2350", "CLEAR BONUS 1000", "LOOP 3"]);
        assert_eq!(lc.next_loop_text(), "NEXT: LOOP 4");
    }

    #[test]
    fn tally_ticks_once_per_line_and_counts() {
        let mut lc = LevelClear::new(6, 1000, 1000, 1, 1);
        let mut out = Out::new();
        lc.step(start(), &mut out); // into the tally
        let mut o2 = Out::new();
        for _ in 0..200 {
            lc.step(idle(), &mut o2);
        }
        assert!(o2.count_sfx(Sfx::Tick) >= 4, "line ticks plus counting ticks");
        assert_eq!(o2.count_sfx(Sfx::Coins), 1);
    }

    #[test]
    fn every_stage_draws_something_and_stays_in_the_screen() {
        for seed in 0..5 {
            let mut lc = LevelClear::new(6, 2000, 1000, 1, seed);
            let mut out = Out::new();
            for _ in 0..4 {
                for _ in 0..120 {
                    lc.step(idle(), &mut out);
                }
                let mut fb = Fb::new();
                lc.draw(&mut fb);
                let colors: std::collections::BTreeSet<u8> = fb.px.iter().copied().collect();
                assert!(colors.len() > 5, "stage {} looks empty", lc.stage());
                lc.step(start(), &mut out);
            }
        }
    }

    #[test]
    fn newspaper_headline_is_drawn_and_changes_with_the_seed() {
        let page = |seed| {
            let mut lc = LevelClear::new(6, 0, 0, 1, seed);
            let mut out = Out::new();
            lc.step(start(), &mut out);
            lc.step(start(), &mut out);
            for _ in 0..SPIN_FRAMES + 2 {
                lc.step(idle(), &mut out);
            }
            let mut fb = Fb::new();
            lc.draw(&mut fb);
            (fb.px, lc.headline())
        };
        let (a, ha) = page(0);
        let mut other = None;
        for s in 1..50 {
            let (b, hb) = page(s);
            if hb != ha {
                other = Some(b);
                break;
            }
        }
        assert_ne!(a, other.expect("another headline within 50 seeds"));
    }
}
