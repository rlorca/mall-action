//! People, items, HUD icons and small effects.
//!
//! Sprites are composed at start-up from rectangles/lines/ellipses on a character grid (see [`G`]),
//! then mapped to the 3-slot palette (slot 1 = main, 2 = skin/light, 3 = dark/outline).
//!
//! ## Catalogue (name: size)
//! * MALL people, 16x24 facing right: `agent_*`, `spy_*` with `stand`, `walk_0..3`, `duck`, `jump`,
//!   `kick`, `shoot`, `shoot_duck`, `die_0..2`, `hang`, `land`, `selfie`; spy also `aim_high`,
//!   `aim_low`, `wave` (agent has no aim/wave; spy has no jump/kick/hang/land/selfie/shoot*, see tests).
//!   Agent: stand, walk_0..3, duck, jump, kick, shoot, shoot_duck, die_0..2, hang, land, selfie.
//!   Spy: stand, walk_0..3, aim_high, aim_low, duck, die_0..2, wave.
//! * NPCs: `janitor_walk_0..1`, `janitor_mop_0..1`, `walker_0..3` (16x24); `cop_0..1`, `cop_whistle` (24x24).
//! * SMALL: `bullet_p` 5x3, `bullet_e` 5x3, `wet_sign` 8x10, `coin_0..3` 8x8, `coin_gold_0..3` 8x8,
//!   `puff_0..3` 16x16, `ping` 8x8, `bubble_tail` 5x4, `shoe` 8x6, `heart` 8x8, `arrow_down` 8x8,
//!   `photo_flash` 16x16.
//! * ITEMS 16x16: `item_rapid`, `item_spread`, `item_armor`, `item_sneakers`, `item_radar`, `item_1up`,
//!   `item_cinnabomb`, `item_ooze`, `item_pretzel`, `item_package`, `joke_coupon`, `joke_guide`,
//!   `joke_rock`, `joke_ring`, `joke_share`, `photo_strip`.
//! * HUD 8x8: `hud_head`, `hud_armor`, `hud_radar`, `hud_pkg`.
//! * TOP-DOWN 16x16: `tdagent_{d,u,s}_{0,1}`, `tdagent_hold`, `tdagent_stun`, `tdagent_search`,
//!   `tdspy_{d,u,s}_{0,1}`, `tdspy_aim_{d,u,s}`, `tdspy_die_0..1`, `tdbot_0..1`, `tdclerk`;
//!   `toy_0..1` 12x12, `tdbullet` 4x4, `tdshoe` 8x6.
//! * `logo_agent` 32x32 (title/news head-and-shoulders).
use crate::pixel::{c, spr, SpriteDef};

fn leak(s: String) -> &'static str {
    Box::leak(s.into_boxed_str())
}

/// Character grid used to compose sprites procedurally.
#[derive(Clone)]
struct G {
    w: i32,
    h: i32,
    c: Vec<char>,
}

impl G {
    fn new(w: i32, h: i32) -> G {
        G { w, h, c: vec!['.'; (w * h) as usize] }
    }
    fn art(w: i32, rows: &[&str]) -> G {
        let mut g = G::new(w, rows.len() as i32);
        for (y, r) in rows.iter().enumerate() {
            for (x, ch) in r.chars().enumerate() {
                g.p(x as i32, y as i32, ch);
            }
        }
        g
    }
    fn p(&mut self, x: i32, y: i32, ch: char) {
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.c[(y * self.w + x) as usize] = ch;
        }
    }
    fn get(&self, x: i32, y: i32) -> char {
        if x >= 0 && y >= 0 && x < self.w && y < self.h {
            self.c[(y * self.w + x) as usize]
        } else {
            '.'
        }
    }
    fn r(&mut self, x: i32, y: i32, w: i32, h: i32, ch: char) {
        for yy in y..y + h {
            for xx in x..x + w {
                self.p(xx, yy, ch);
            }
        }
    }
    fn ell(&mut self, x: i32, y: i32, w: i32, h: i32, ch: char) {
        let (cx, cy) = ((w - 1) as f32 / 2.0, (h - 1) as f32 / 2.0);
        let (rx, ry) = (w as f32 / 2.0, h as f32 / 2.0);
        for j in 0..h {
            for i in 0..w {
                let (dx, dy) = ((i as f32 - cx) / rx, (j as f32 - cy) / ry);
                if dx * dx + dy * dy <= 1.0 {
                    self.p(x + i, y + j, ch);
                }
            }
        }
    }
    fn line(&mut self, x0: i32, y0: i32, x1: i32, y1: i32, ch: char, t: i32) {
        let n = (x1 - x0).abs().max((y1 - y0).abs()).max(1);
        for i in 0..=n {
            let x = x0 as f32 + (x1 - x0) as f32 * i as f32 / n as f32;
            let y = y0 as f32 + (y1 - y0) as f32 * i as f32 / n as f32;
            self.r(x.round() as i32, y.round() as i32, t, t, ch);
        }
    }
    /// 2-px thick limb with a 1-px outline.
    fn limb(&mut self, x0: i32, y0: i32, x1: i32, y1: i32, fill: char, outl: char) {
        let n = (x1 - x0).abs().max((y1 - y0).abs()).max(1);
        let pts: Vec<(i32, i32)> = (0..=n)
            .map(|i| {
                (
                    (x0 as f32 + (x1 - x0) as f32 * i as f32 / n as f32).round() as i32,
                    (y0 as f32 + (y1 - y0) as f32 * i as f32 / n as f32).round() as i32,
                )
            })
            .collect();
        for &(x, y) in &pts {
            self.r(x - 1, y - 1, 4, 4, outl);
        }
        for &(x, y) in &pts {
            self.r(x, y, 2, 2, fill);
        }
    }
    /// Surround every filled cell with `ch` on empty 4-neighbours.
    fn outline(&mut self, ch: char) {
        let src = self.clone();
        for y in 0..self.h {
            for x in 0..self.w {
                if src.get(x, y) == '.'
                    && [(1, 0), (-1, 0), (0, 1), (0, -1)].iter().any(|(dx, dy)| src.get(x + dx, y + dy) != '.')
                {
                    self.p(x, y, ch);
                }
            }
        }
    }
    fn blit(&mut self, o: &G, ox: i32, oy: i32) {
        for y in 0..o.h {
            for x in 0..o.w {
                let ch = o.get(x, y);
                if ch != '.' {
                    self.p(x + ox, y + oy, ch);
                }
            }
        }
    }
    fn tiny(&mut self, x: i32, y: i32, rows: [u8; 5], ch: char) {
        for (j, r) in rows.iter().enumerate() {
            for i in 0..3 {
                if r & (4 >> i) != 0 {
                    self.p(x + i, y + j as i32, ch);
                }
            }
        }
    }
    fn fin(&self, name: String, pal: [u8; 3], map: fn(char) -> char) -> SpriteDef {
        let mut s = String::new();
        for y in 0..self.h {
            if y > 0 {
                s.push('\n');
            }
            for x in 0..self.w {
                s.push(map(self.get(x, y)));
            }
        }
        spr(leak(name), self.w as usize, self.h as usize, pal, leak(s))
    }
}

fn id(c: char) -> char {
    match c {
        '1' | '2' | '3' => c,
        _ => '.',
    }
}

// ---------------------------------------------------------------- people (side view)

#[derive(Clone, Copy, PartialEq)]
enum K {
    Agent,
    Spy,
    Walker,
    Janitor,
    Cop,
}

fn m_agent(c: char) -> char {
    match c {
        'c' => '1',
        's' => '2',
        'o' | 'h' | 'x' | 'L' | 'S' | 'g' => '3',
        '1' | '2' | '3' => c,
        _ => '.',
    }
}
fn m_spy(c: char) -> char {
    match c {
        'c' | 'L' => '1',
        's' => '2',
        'o' | 'g' | 'h' | 'x' | 'S' => '3',
        '1' | '2' | '3' => c,
        _ => '.',
    }
}
fn m_walker(c: char) -> char {
    match c {
        'c' | 'L' | 'g' => '1',
        's' => '2',
        'o' | 'h' | 'x' | 'S' => '3',
        '1' | '2' | '3' => c,
        _ => '.',
    }
}
fn m_jan(c: char) -> char {
    match c {
        'c' | 'L' => '1',
        's' => '2',
        'o' | 'h' | 'x' | 'S' | 'g' => '3',
        '1' | '2' | '3' => c,
        _ => '.',
    }
}
fn m_cop(c: char) -> char {
    match c {
        'c' | 'h' | 'L' => '1',
        's' => '2',
        'o' | 'x' | 'S' | 'g' => '3',
        '1' | '2' | '3' => c,
        _ => '.',
    }
}

fn kmap(k: K) -> fn(char) -> char {
    match k {
        K::Agent => m_agent,
        K::Spy => m_spy,
        K::Walker => m_walker,
        K::Janitor => m_jan,
        K::Cop => m_cop,
    }
}
fn kpal(k: K) -> [u8; 3] {
    match k {
        K::Agent => [c::RED, c::SKIN, c::BLACK],
        K::Spy => [c::GRAY_D, c::SKIN, c::BLACK],
        K::Walker => [c::TEAL, c::SKIN, c::WHITE],
        K::Janitor => [c::BLUE_L, c::SKIN, c::BROWN],
        K::Cop => [c::BLUE, c::SKIN, c::BLACK],
    }
}
fn base_t(k: K) -> i32 {
    match k {
        K::Agent => 11,
        K::Spy | K::Walker => 8,
        K::Janitor | K::Cop => 9,
    }
}

struct Pose {
    dy: i32,
    t: i32,
    legs: Vec<[i32; 4]>,
    arm_f: Option<(i32, i32)>,
    arm_b: Option<(i32, i32)>,
    gun: Option<(i32, i32)>,
    smile: bool,
    shock: bool,
}

impl Pose {
    fn stand(k: K) -> Pose {
        let t = base_t(k);
        let yt = 8 + t;
        Pose {
            dy: 0,
            t,
            legs: vec![[5, yt, 5, 23], [9, yt, 9, 23]],
            arm_f: Some((10, 15)),
            arm_b: None,
            gun: None,
            smile: false,
            shock: false,
        }
    }
    fn walk(k: K, f: usize) -> Pose {
        let mut p = Pose::stand(k);
        let yt = 8 + p.t;
        match f {
            0 => {
                p.legs = vec![[6, yt, 3, 23], [8, yt, 11, 23]];
                p.arm_f = Some((13, 14));
                p.arm_b = Some((3, 14));
            }
            1 => {
                p.legs = vec![[6, yt, 5, 22], [8, yt, 8, 23]];
                p.arm_f = Some((11, 15));
                p.arm_b = Some((5, 15));
            }
            2 => {
                p.legs = vec![[6, yt, 4, 23], [8, yt, 10, 23]];
                p.arm_f = Some((7, 15));
                p.arm_b = Some((12, 14));
            }
            _ => {
                p.legs = vec![[6, yt, 6, 23], [8, yt, 9, 22]];
                p.arm_f = Some((9, 15));
                p.arm_b = Some((6, 15));
            }
        }
        p
    }
}

fn leg(g: &mut G, l: [i32; 4]) {
    let [xt, yt, xb, yb] = l;
    if yb < yt {
        return;
    }
    let span = (yb - yt).max(1);
    for y in yt..=yb {
        let x = xt as f32 + (xb - xt) as f32 * (y - yt) as f32 / span as f32;
        g.r(x.round() as i32, y, 3, 1, 'L');
    }
    g.r(xb, yb, 4, 1, 'S');
}

fn head(g: &mut G, k: K, dy: i32, smile: bool, shock: bool) {
    match k {
        K::Agent | K::Walker => {
            g.r(5, dy + 1, 7, 2, 'h');
            g.r(4, dy + 2, 3, 5, 'h');
            g.r(7, dy + 3, 5, 4, 's');
            if k == K::Walker {
                g.r(7, dy + 3, 5, 1, 'g');
                g.r(5, dy + 2, 7, 1, 'h');
            } else {
                g.r(7, dy + 3, 3, 1, 'h');
            }
            g.p(10, dy + 4, 'x');
            g.p(12, dy + 5, 's');
            if smile {
                g.p(9, dy + 6, 'o');
                g.p(10, dy + 6, 'o');
                g.p(11, dy + 5, 'o');
            }
            if shock {
                g.r(10, dy + 5, 1, 2, 'x');
            }
            g.r(8, dy + 7, 3, 1, 's');
        }
        K::Spy => {
            g.r(5, dy, 7, 3, 'h');
            g.r(5, dy + 2, 7, 1, 'o');
            g.r(3, dy + 3, 11, 1, 'h');
            g.r(6, dy + 4, 6, 3, 's');
            g.r(7, dy + 5, 5, 1, 'x');
            if shock {
                g.r(10, dy + 6, 1, 1, 'x');
            }
            g.r(8, dy + 7, 3, 1, 's');
        }
        K::Janitor => {
            g.r(5, dy + 1, 7, 2, 'c');
            g.r(4, dy + 3, 3, 3, 'h');
            g.r(6, dy + 3, 6, 4, 's');
            g.r(8, dy + 3, 6, 1, 'c');
            g.p(10, dy + 4, 'x');
            g.r(9, dy + 6, 3, 1, 'h');
            g.r(8, dy + 7, 3, 1, 's');
        }
        K::Cop => {
            g.r(5, dy + 1, 7, 3, 'h');
            g.r(9, dy + 3, 5, 1, 'h');
            g.p(8, dy + 2, 'o');
            g.r(7, dy + 4, 5, 3, 's');
            g.p(10, dy + 5, 'x');
            g.r(8, dy + 7, 3, 1, 's');
        }
    }
}

fn torso(g: &mut G, k: K, dy: i32, t: i32) {
    let y = dy + 8;
    g.r(4, y, 8, t, 'c');
    g.r(4, y, 1, t, 'o');
    g.r(11, y, 1, t, 'o');
    g.r(4, y + t - 1, 8, 1, 'o');
    match k {
        K::Agent => {
            g.r(4, y + 4i32.min(t - 2), 8, 1, 'o'); // belt
            g.r(7, y, 4, 1, 'o'); // collar
            g.p(8, y + 5i32.min(t - 1), 'o');
        }
        K::Spy => {
            g.r(9, y + 1, 1, (t - 3).max(1), 'o'); // tie
            g.r(8, y, 3, 1, 'o');
        }
        K::Walker => {
            g.r(7, y, 1, t, 'o'); // stripe
            g.r(8, y, 1, t, 'g');
        }
        K::Janitor => {
            g.r(6, y + 3i32.min(t - 2), 3, 2, 'o'); // pocket
            g.p(10, y + 1, 'o');
        }
        K::Cop => {
            g.p(9, y + 2, 'o'); // badge
            g.r(4, y + 5i32.min(t - 2), 8, 1, 'o'); // belt
        }
    }
}

fn arm(g: &mut G, sx: i32, sy: i32, e: (i32, i32)) {
    g.limb(sx, sy, e.0, e.1, 'c', 'o');
    g.r(e.0, e.1, 2, 2, 's');
}

fn person(k: K, p: &Pose) -> G {
    let mut g = G::new(16, 24);
    if let Some(e) = p.arm_b {
        arm(&mut g, 5, p.dy + 9, e);
    }
    for l in &p.legs {
        leg(&mut g, *l);
    }
    torso(&mut g, k, p.dy, p.t);
    head(&mut g, k, p.dy, p.smile, p.shock);
    if let Some(e) = p.arm_f {
        arm(&mut g, 10, p.dy + 9, e);
    }
    if let Some((gx, gy)) = p.gun {
        g.r(gx, gy, 3, 2, 'o');
        g.p(gx, gy + 2, 'o');
    }
    g
}

fn lying(k: K, shot: bool) -> G {
    let mut g = G::new(16, 24);
    // legs & feet (right), body (middle), head (left), facing up
    g.r(12, 20, 4, 2, 'L');
    g.r(14, 19, 2, 1, 'S');
    g.r(13, 22, 3, 1, 'S');
    g.r(5, 18, 8, 5, 'c');
    g.r(5, 18, 8, 1, 'o');
    g.r(5, 22, 8, 1, 'o');
    g.r(11, 18, 1, 5, 'o');
    if k == K::Spy {
        g.r(0, 15, 6, 1, 'h');
        g.r(1, 14, 4, 1, 'h');
        g.r(0, 17, 5, 5, 's');
        g.p(1, 19, 'x');
        g.p(2, 19, 'x');
        g.p(3, 19, 'x');
    } else {
        g.r(0, 17, 5, 6, 's');
        g.r(0, 17, 3, 3, 'h');
        g.p(3, 19, 'x');
        g.p(3, 21, 'o');
    }
    if shot {
        g.r(7, 16, 2, 2, 's');
    }
    g
}

fn falling(k: K) -> G {
    let mut g = G::new(16, 24);
    g.limb(9, 17, 13, 22, 'c', 'o'); // leg-ish
    g.r(12, 22, 4, 1, 'S');
    g.limb(6, 14, 10, 19, 'c', 'o');
    g.r(5, 12, 7, 7, 'c');
    g.r(5, 12, 1, 7, 'o');
    g.r(5, 18, 7, 1, 'o');
    let mut h = G::new(16, 24);
    head(&mut h, k, 0, false, true);
    // head from the standing pose, squeezed to the falling position
    let mut hh = G::new(16, 12);
    for y in 0..12 {
        for x in 0..16 {
            hh.p(x, y, h.get(x, y));
        }
    }
    g.blit(&hh, -2, 7);
    g.limb(5, 13, 2, 8, 'c', 'o');
    g.limb(11, 13, 14, 10, 'c', 'o');
    g
}

fn people() -> Vec<SpriteDef> {
    let mut v = Vec::new();
    for (k, nm) in [(K::Agent, "agent"), (K::Spy, "spy")] {
        let (pal, map) = (kpal(k), kmap(k));
        let mut add = |n: &str, g: G| v.push(g.fin(format!("{nm}_{n}"), pal, map));
        let yt = 8 + base_t(k);
        add("stand", person(k, &Pose::stand(k)));
        for f in 0..4 {
            add(&format!("walk_{f}"), person(k, &Pose::walk(k, f)));
        }
        // duck
        let mut d = Pose::stand(k);
        d.dy = 9;
        d.t = 5;
        d.legs = vec![[4, 22, 3, 23], [9, 22, 10, 23]];
        d.arm_f = Some((11, 19));
        add("duck", person(k, &d));
        // die frames
        let mut d0 = Pose::stand(k);
        d0.dy = 1;
        d0.shock = true;
        d0.arm_f = Some((13, 4));
        d0.arm_b = Some((2, 5));
        d0.legs = vec![[5, yt + 1, 3, 23], [9, yt + 1, 12, 23]];
        add("die_0", person(k, &d0));
        add("die_1", falling(k));
        add("die_2", lying(k, false));
        if k == K::Agent {
            // jump
            let mut j = Pose::stand(k);
            j.legs = vec![[5, yt - 1, 3, 21], [9, yt - 1, 13, 20]];
            j.arm_f = Some((13, 5));
            j.arm_b = Some((2, 6));
            add("jump", person(k, &j));
            // kick
            let mut kk = Pose::stand(k);
            kk.dy = 1;
            kk.legs = vec![[5, yt, 3, 21]];
            kk.arm_f = Some((12, 16));
            kk.arm_b = Some((2, 8));
            let mut g = person(k, &kk);
            g.line(9, yt - 2, 14, yt - 3, 'L', 3);
            g.r(14, yt - 4, 2, 4, 'S');
            add("kick", g);
            // shoot
            let mut s = Pose::stand(k);
            s.arm_f = Some((13, 9));
            s.gun = Some((13, 8));
            add("shoot", person(k, &s));
            let mut sd = d.clone_pose();
            sd.arm_f = Some((13, 17));
            sd.gun = Some((13, 16));
            add("shoot_duck", person(k, &sd));
            // hang
            let mut hg = Pose::stand(k);
            hg.dy = 4;
            hg.t = 8;
            hg.legs = vec![[5, 20, 5, 23], [8, 20, 9, 23]];
            hg.arm_f = Some((9, 0));
            hg.arm_b = Some((5, 0));
            hg.shock = false;
            add("hang", person(k, &hg));
            // land
            let mut ld = d.clone_pose();
            ld.dy = 7;
            ld.t = 7;
            ld.legs = vec![[4, 22, 2, 23], [9, 22, 11, 23]];
            ld.arm_f = Some((12, 20));
            ld.arm_b = Some((2, 20));
            add("land", person(k, &ld));
            // selfie
            let mut sf = Pose::stand(k);
            sf.smile = true;
            sf.arm_f = Some((12, 6));
            let mut g = person(k, &sf);
            g.r(12, 1, 4, 7, 'o');
            g.r(13, 2, 2, 5, 's');
            add("selfie", g);
        } else {
            let mut hi = Pose::stand(k);
            hi.arm_f = Some((13, 4));
            hi.gun = Some((13, 1));
            add("aim_high", person(k, &hi));
            let mut lo = Pose::stand(k);
            lo.arm_f = Some((13, 14));
            lo.gun = Some((13, 14));
            add("aim_low", person(k, &lo));
            let mut w = Pose::stand(k);
            w.arm_f = Some((12, 2));
            let mut g = person(k, &w);
            g.r(12, 0, 3, 3, 's');
            g.r(13, 0, 3, 4, '2'); // white receipt (skin slot is light) with ink lines
            g.p(14, 1, 'o');
            g.p(14, 3, 'o');
            add("wave", g);
        }
    }
    v
}

impl Pose {
    fn clone_pose(&self) -> Pose {
        Pose {
            dy: self.dy,
            t: self.t,
            legs: self.legs.clone(),
            arm_f: self.arm_f,
            arm_b: self.arm_b,
            gun: self.gun,
            smile: self.smile,
            shock: self.shock,
        }
    }
}

// ---------------------------------------------------------------- NPCs

fn npcs() -> Vec<SpriteDef> {
    let mut v = Vec::new();
    // janitor
    let k = K::Janitor;
    let (pal, map) = (kpal(k), kmap(k));
    for f in 0..2 {
        let mut p = Pose::walk(k, if f == 0 { 0 } else { 2 });
        p.arm_f = Some((12, 14));
        p.arm_b = None;
        let mut g = person(k, &p);
        g.line(13, 14, 15, 21, 'o', 1);
        g.r(12 + f, 21, 4, 3, 'o');
        v.push(g.fin(format!("janitor_walk_{f}"), pal, map));
    }
    for f in 0..2 {
        let mut p = Pose::stand(k);
        p.arm_f = Some((11, 13));
        p.arm_b = Some((8, 13));
        let mut g = person(k, &p);
        let hx = if f == 0 { 11 } else { 3 };
        let tx = if f == 0 { 14 } else { 6 };
        g.line(12, 13, tx, 21, 'o', 1);
        g.r(hx, 21, 5, 3, 'o');
        g.r(hx + 1, 22, 3, 1, 's');
        v.push(g.fin(format!("janitor_mop_{f}"), pal, map));
    }
    // mall walkers
    let k = K::Walker;
    let (pal, map) = (kpal(k), kmap(k));
    for f in 0..4 {
        let mut p = Pose::walk(k, f);
        match f {
            0 => {
                p.arm_f = Some((13, 9));
                p.arm_b = Some((2, 13));
            }
            1 => {
                p.arm_f = Some((12, 12));
                p.arm_b = Some((4, 12));
            }
            2 => {
                p.arm_f = Some((8, 13));
                p.arm_b = Some((12, 9));
            }
            _ => {
                p.arm_f = Some((11, 12));
                p.arm_b = Some((5, 12));
            }
        }
        v.push(person(k, &p).fin(format!("walker_{f}"), pal, map));
    }
    // mall cop on a segway (24x24)
    let k = K::Cop;
    let (pal, map) = (kpal(k), kmap(k));
    let cop = |f: i32, whistle: bool| -> G {
        let mut g = G::new(24, 24);
        g.ell(6, 13, 11, 11, 'o');
        g.ell(8, 15, 7, 7, 'c');
        if f == 0 {
            g.line(11, 15, 11, 21, 'o', 1);
        } else {
            g.line(9, 16, 13, 20, 'o', 1);
        }
        g.r(2, 20, 18, 2, 'o');
        g.line(20, 8, 17, 20, 'o', 1);
        g.r(18, 7, 4, 1, 'o');
        let mut p = Pose::stand(k);
        p.legs = vec![[6, 17, 6, 20], [10, 17, 10, 20]];
        p.arm_f = Some((12, 8));
        let mut b = person(k, &p);
        if whistle {
            // arm to the mouth
            for y in 8..17 {
                for x in 9..16 {
                    b.p(x, y, if y < 14 { '.' } else { b.get(x, y) });
                }
            }
            b.limb(10, 10, 11, 6, 'c', 'o');
            b.r(11, 6, 2, 2, 's');
            b.r(13, 6, 2, 1, 'o');
        }
        // body shifted right so it stands in the middle of the platform
        let mut bb = G::new(16, 21);
        for y in 0..21 {
            for x in 0..16 {
                bb.p(x, y, b.get(x, y));
            }
        }
        g.blit(&bb, 3, 0);
        if whistle {
            g.p(19, 5, 'o');
            g.p(21, 4, 'o');
            g.p(21, 7, 'o');
            g.p(22, 5, 'o');
        }
        g
    };
    v.push(cop(0, false).fin("cop_0".into(), pal, map));
    v.push(cop(1, false).fin("cop_1".into(), pal, map));
    v.push(cop(0, true).fin("cop_whistle".into(), pal, map));
    v
}

// ---------------------------------------------------------------- small things

fn small() -> Vec<SpriteDef> {
    let mut v = Vec::new();
    v.push(spr("bullet_p", 5, 3, [c::YELLOW, c::WHITE, c::ORANGE], ".111.\n32221\n.111."));
    v.push(spr("bullet_e", 5, 3, [c::RED_L, c::WHITE, c::RED_D], ".111.\n32221\n.111."));
    v.push(spr(
        "wet_sign",
        8,
        10,
        [c::YELLOW, c::BLACK, c::ORANGE],
        "...33...\n..3113..\n..3223..\n.312213.\n.312213.\n.311113.\n.312213.\n31111113\n31111113\n33333333",
    ));
    for f in 0..4 {
        let (w, x) = [(6, 1), (4, 2), (2, 3), (4, 2)][f];
        let mut g = G::new(8, 8);
        g.ell(x, 0, w, 8, '3');
        if w > 2 {
            g.ell(x + 1, 1, w - 2, 6, '1');
        }
        if f == 0 {
            g.p(3, 2, '2');
            g.p(3, 3, '2');
        }
        if f == 1 || f == 3 {
            g.p(x + 1, 2, '2');
        }
        v.push(g.fin(format!("coin_{f}"), [c::GRAY_L, c::WHITE, c::GRAY_D], id));
        let mut gg = g.clone();
        // gold: swap shine for a star glint
        if f == 0 {
            gg.p(4, 4, '2');
            gg.p(3, 5, '2');
        }
        v.push(gg.fin(format!("coin_gold_{f}"), [c::YELLOW, c::WHITE, c::BROWN], id));
    }
    for f in 0..4 {
        let mut g = G::new(16, 16);
        let blobs: &[(i32, i32, i32)] = match f {
            0 => &[(8, 9, 5)],
            1 => &[(6, 9, 6), (10, 9, 6), (8, 6, 6)],
            2 => &[(4, 10, 7), (11, 10, 7), (8, 5, 8), (8, 11, 8)],
            _ => &[(2, 11, 4), (13, 11, 4), (5, 4, 4), (11, 3, 4), (8, 8, 5)],
        };
        for &(cx, cy, d) in blobs {
            g.ell(cx - d / 2, cy - d / 2, d, d, '1');
        }
        // shade bottom-right, highlight top-left
        let src = g.clone();
        for y in 0..16 {
            for x in 0..16 {
                if src.get(x, y) == '1' {
                    if src.get(x + 1, y + 1) == '.' || src.get(x, y + 1) == '.' {
                        g.p(x, y, '2');
                    } else if src.get(x - 1, y - 1) == '.' {
                        g.p(x, y, '3');
                    }
                }
            }
        }
        if f == 3 {
            for (x, y) in [(1, 6), (14, 6), (7, 0), (3, 14)] {
                g.p(x, y, '2');
            }
        }
        v.push(g.fin(format!("puff_{f}"), [c::GRAY_L, c::GRAY, c::WHITE], id));
    }
    v.push(spr(
        "ping",
        8,
        8,
        [c::YELLOW_L, c::WHITE, c::ORANGE],
        "...3....\n3..1..3.\n.3.1.3..\n..323...\n1112111.\n..323...\n.3.1.3..\n3..1..3.",
    ));
    v.push(spr("bubble_tail", 5, 4, [c::WHITE, c::BLACK, c::BLACK], "11111\n21112\n.212.\n..2.."));
    v.push(spr(
        "shoe",
        8,
        6,
        [c::RED, c::WHITE, c::BLACK],
        "..3333..\n.311113.\n.312213.\n31111113\n32222223\n33333333",
    ));
    let mut hm = G::new(8, 8);
    let mut core = G::art(6, &[".11.11", "111111", "111111", ".1111.", "..11.."]);
    core.p(1, 1, '2');
    hm.blit(&core, 1, 1);
    hm.outline('3');
    v.push(hm.fin("heart".into(), [c::RED_L, c::WHITE, c::RED_D], id));
    let mut ar = G::new(8, 8);
    ar.r(3, 1, 2, 3, '1');
    ar.r(1, 4, 6, 1, '1');
    ar.r(2, 5, 4, 1, '1');
    ar.r(3, 6, 2, 1, '1');
    ar.p(3, 1, '2');
    ar.outline('3');
    v.push(ar.fin("arrow_down".into(), [c::YELLOW, c::WHITE, c::BLACK], id));
    let mut pf = G::new(16, 16);
    pf.line(8, 0, 8, 15, '1', 1);
    pf.line(0, 8, 15, 8, '1', 1);
    pf.line(2, 2, 13, 13, '3', 1);
    pf.line(13, 2, 2, 13, '3', 1);
    pf.ell(4, 4, 8, 8, '1');
    pf.ell(6, 6, 4, 4, '2');
    v.push(pf.fin("photo_flash".into(), [c::YELLOW_L, c::WHITE, c::ORANGE], id));
    v
}

// ---------------------------------------------------------------- items

fn badge(base_pal: u8, glyph_pal: u8, draw: impl Fn(&mut G)) -> (G, [u8; 3]) {
    let mut g = G::new(16, 16);
    g.ell(0, 0, 16, 16, '3');
    g.ell(1, 1, 14, 14, '1');
    draw(&mut g);
    (g, [base_pal, glyph_pal, c::BLACK])
}

fn items() -> Vec<SpriteDef> {
    let mut v = Vec::new();
    let mut put = |n: &str, (g, pal): (G, [u8; 3])| v.push(g.fin(n.into(), pal, id));
    put(
        "item_rapid",
        badge(c::RED, c::YELLOW_L, |g| {
            for y in [3, 7, 11] {
                g.r(3, y, 8, 2, '2');
                g.p(11, y, '2');
                g.p(11, y + 1, '2');
                g.p(12, y, '2');
            }
            g.r(1, 3, 1, 1, '2');
        }),
    );
    put(
        "item_spread",
        badge(c::BLUE_L, c::WHITE, |g| {
            for ty in [3, 8, 13] {
                g.line(3, 8, 12, ty, '2', 1);
                g.r(12, ty - 1, 2, 2, '2');
            }
            g.r(2, 7, 3, 3, '2');
        }),
    );
    put(
        "item_armor",
        badge(c::BLUE, c::WHITE, |g| {
            g.r(4, 3, 8, 10, '2');
            g.r(7, 3, 2, 3, '1');
            g.r(3, 3, 2, 3, '2');
            g.r(11, 3, 2, 3, '2');
            g.r(8, 6, 1, 7, '1');
            g.r(5, 12, 6, 1, '1');
        }),
    );
    put(
        "item_sneakers",
        badge(c::GREEN, c::WHITE, |g| {
            g.r(2, 11, 12, 2, '2');
            g.r(2, 5, 5, 6, '2');
            g.r(7, 8, 6, 3, '2');
            g.r(3, 7, 3, 1, '1');
            g.r(3, 9, 3, 1, '1');
            g.r(7, 9, 5, 1, '1');
        }),
    );
    put(
        "item_radar",
        badge(c::GREEN_D, c::GREEN_L, |g| {
            g.ell(2, 2, 12, 12, '2');
            g.ell(3, 3, 10, 10, '1');
            g.ell(5, 5, 6, 6, '2');
            g.ell(6, 6, 4, 4, '1');
            g.line(8, 8, 12, 4, '2', 1);
            g.r(10, 9, 2, 2, '2');
        }),
    );
    put(
        "item_1up",
        badge(c::GREEN, c::WHITE, |g| {
            g.tiny(2, 5, [2, 6, 2, 2, 7], '2');
            g.tiny(6, 5, [5, 5, 5, 5, 7], '2');
            g.tiny(10, 5, [6, 5, 6, 4, 4], '2');
        }),
    );
    {
        let mut g = G::new(16, 16);
        g.ell(0, 0, 16, 16, '3');
        g.ell(1, 1, 14, 14, '1');
        g.ell(3, 3, 10, 10, '3');
        g.ell(4, 4, 8, 8, '1');
        g.ell(6, 6, 4, 4, '3');
        g.ell(7, 7, 2, 2, '1');
        for (x, y) in [(2, 5), (4, 3), (10, 2), (13, 6), (14, 9), (12, 13), (6, 14), (3, 11), (8, 4), (9, 12), (5, 8)] {
            g.p(x, y, '2');
            g.p(x + 1, y, '2');
        }
        g.line(11, 1, 14, 0, '3', 1);
        g.p(14, 0, '2');
        g.p(15, 0, '2');
        v.push(g.fin("item_cinnabomb".into(), [c::ORANGE, c::WHITE, c::BROWN_D], id));
    }
    {
        let mut g = G::new(16, 16);
        // cup (trapezoid), juice, straw
        for y in 5..15 {
            let inset = (y - 5) / 3;
            g.r(3 + inset, y, 10 - inset * 2, 1, '2');
        }
        for y in 7..14 {
            let inset = (y - 5) / 3;
            g.r(4 + inset, y, 8 - inset * 2, 1, '1');
        }
        g.r(2, 4, 12, 1, '2');
        g.line(10, 5, 12, 0, '1', 1);
        g.r(11, 0, 3, 1, '1');
        g.outline('3');
        v.push(g.fin("item_ooze".into(), [c::ORANGE, c::WHITE, c::BLACK], id));
    }
    {
        let mut g = G::new(16, 16);
        g.ell(1, 3, 7, 7, '1');
        g.ell(8, 3, 7, 7, '1');
        g.ell(3, 5, 3, 3, '.');
        g.ell(10, 5, 3, 3, '.');
        g.line(4, 8, 11, 14, '1', 2);
        g.line(11, 8, 4, 14, '1', 2);
        g.r(6, 9, 4, 3, '1');
        for (x, y) in [(2, 4), (5, 3), (11, 3), (13, 5), (7, 10), (4, 11), (10, 11)] {
            g.p(x, y, '2');
        }
        g.outline('3');
        v.push(g.fin("item_pretzel".into(), [c::BROWN, c::WHITE, c::BLACK], id));
    }
    {
        let mut g = G::new(16, 16);
        g.r(2, 4, 12, 10, '1');
        g.r(7, 4, 2, 10, '2');
        g.r(2, 8, 12, 1, '3');
        g.r(2, 13, 12, 1, '3');
        g.r(5, 2, 3, 2, '2');
        g.r(8, 2, 3, 2, '2');
        g.frame_out(2, 4, 12, 10, '3');
        v.push(g.fin("item_package".into(), [c::TAN, c::BROWN, c::BLACK], id));
    }
    {
        let mut g = G::new(16, 16);
        g.r(1, 3, 14, 10, '1');
        for x in (1..15).step_by(2) {
            g.p(x, 3, '2');
            g.p(x, 12, '2');
        }
        for y in (3..13).step_by(2) {
            g.p(1, y, '2');
            g.p(14, y, '2');
        }
        g.r(3, 5, 6, 1, '3');
        g.r(3, 7, 9, 1, '3');
        g.r(3, 9, 5, 1, '3');
        g.r(10, 9, 3, 2, '2');
        g.frame_out(0, 2, 16, 12, '3');
        v.push(g.fin("joke_coupon".into(), [c::YELLOW_L, c::RED, c::BLACK], id));
    }
    {
        let mut g = G::new(16, 16);
        g.r(3, 1, 10, 14, '1');
        g.r(3, 1, 2, 14, '3');
        g.r(13, 2, 1, 12, '2');
        g.r(6, 3, 6, 4, '2');
        g.r(7, 4, 4, 1, '1');
        g.r(7, 6, 3, 1, '1');
        g.r(6, 9, 6, 1, '2');
        g.r(6, 11, 4, 1, '2');
        g.frame_out(2, 0, 12, 16, '3');
        v.push(g.fin("joke_guide".into(), [c::BLUE, c::WHITE, c::BLACK], id));
    }
    {
        let mut g = G::new(16, 16);
        g.ell(1, 4, 14, 11, '1');
        g.ell(2, 8, 5, 5, '2');
        g.ell(9, 8, 5, 5, '2');
        g.ell(4, 10, 2, 2, '3');
        g.ell(11, 10, 2, 2, '3');
        g.r(6, 13, 4, 1, '3');
        g.p(5, 12, '3');
        g.p(10, 12, '3');
        g.outline('3');
        v.push(g.fin("joke_rock".into(), [c::GRAY, c::WHITE, c::BLACK], id));
    }
    {
        let mut g = G::new(16, 16);
        g.ell(2, 5, 12, 10, '1');
        g.ell(4, 7, 8, 6, '.');
        g.ell(5, 1, 6, 5, '2');
        g.p(6, 2, '3');
        g.r(7, 5, 2, 1, '3');
        g.outline('3');
        v.push(g.fin("joke_ring".into(), [c::YELLOW, c::PURPLE_L, c::BLACK], id));
    }
    {
        let mut g = G::new(16, 16);
        g.r(1, 2, 14, 12, '1');
        g.r(3, 4, 10, 1, '3');
        g.r(3, 6, 6, 1, '3');
        g.ell(10, 5, 4, 4, '2');
        g.line(5, 8, 8, 12, '2', 2);
        g.r(4, 8, 5, 2, '2');
        g.r(6, 9, 1, 1, '2');
        g.line(10, 9, 12, 12, '3', 1);
        g.frame_out(0, 1, 16, 14, '3');
        v.push(g.fin("joke_share".into(), [c::YELLOW_L, c::RED, c::BLACK], id));
    }
    {
        let mut g = G::new(16, 16);
        g.r(4, 0, 8, 16, '3');
        for i in 0..4 {
            g.r(5, 1 + i * 4, 6, 3, '1');
            g.r(7 + (i % 2), 2 + i * 4, 2, 1, '2');
        }
        v.push(g.fin("photo_strip".into(), [c::SKY, c::SKIN, c::BLACK], id));
    }
    v
}

impl G {
    fn frame_out(&mut self, x: i32, y: i32, w: i32, h: i32, ch: char) {
        for i in 0..w {
            self.p(x + i, y, ch);
            self.p(x + i, y + h - 1, ch);
        }
        for j in 0..h {
            self.p(x, y + j, ch);
            self.p(x + w - 1, y + j, ch);
        }
    }
}

// ---------------------------------------------------------------- HUD

fn hud() -> Vec<SpriteDef> {
    let mut v = Vec::new();
    let mut g = G::new(8, 8);
    g.r(2, 0, 4, 2, '3');
    g.r(1, 1, 1, 3, '3');
    g.r(2, 2, 4, 3, '2');
    g.p(5, 3, '3');
    g.r(1, 5, 6, 3, '1');
    g.r(3, 5, 2, 1, '2');
    v.push(g.fin("hud_head".into(), [c::RED, c::SKIN, c::BLACK], id));
    v.push(spr("hud_armor", 8, 8, [c::BLUE_L, c::WHITE, c::BLACK], "33333333\n32111123\n32111123\n32111123\n.321123.\n..3223..\n...33...\n........"));
    let mut g = G::new(8, 8);
    g.ell(0, 0, 8, 8, '3');
    g.ell(1, 1, 6, 6, '1');
    g.ell(3, 3, 2, 2, '2');
    g.line(4, 4, 7, 1, '2', 1);
    v.push(g.fin("hud_radar".into(), [c::GREEN_D, c::GREEN_L, c::BLACK], id));
    let mut g = G::new(8, 8);
    g.r(0, 1, 8, 6, '1');
    g.r(3, 1, 2, 6, '2');
    g.frame_out(0, 1, 8, 6, '3');
    v.push(g.fin("hud_pkg".into(), [c::TAN, c::BROWN, c::BLACK], id));
    v
}

// ---------------------------------------------------------------- top-down

fn td_person(k: K, dir: u8, f: usize, aim: bool) -> G {
    // dir: 0 down, 1 up, 2 side(right)
    let mut g = G::new(16, 16);
    let spy = k == K::Spy;
    let a = f % 2;
    // legs
    match dir {
        2 => {
            if a == 0 {
                g.r(4, 13, 3, 3, 'L');
                g.r(9, 13, 3, 2, 'L');
                g.r(9, 15, 4, 1, 'S');
            } else {
                g.r(6, 13, 4, 3, 'L');
                g.r(6, 15, 5, 1, 'S');
            }
        }
        _ => {
            let (ly, ry) = if a == 0 { (13, 12) } else { (12, 13) };
            g.r(5, ly, 3, 16 - ly, 'L');
            g.r(8, ry, 3, 16 - ry, 'L');
            g.r(5, 15, 3, 1, 'S');
            g.r(8, 15, 3, 1, 'S');
        }
    }
    // body
    if dir == 2 {
        g.r(5, 7, 6, 6, 'c');
        g.r(5, 7, 1, 6, 'o');
        g.r(5, 12, 6, 1, 'o');
        if !aim {
            let sw = if a == 0 { 1 } else { -1 };
            g.r(7 + sw, 8, 2, 4, 'c');
            g.frame_out(7 + sw, 8, 2, 4, 'o');
            g.r(7 + sw, 8, 2, 4, 'c');
            g.p(7 + sw, 12, 's');
        }
    } else {
        g.r(4, 7, 8, 6, 'c');
        g.r(4, 7, 1, 6, 'o');
        g.r(11, 7, 1, 6, 'o');
        g.r(4, 12, 8, 1, 'o');
        if spy && dir == 0 {
            g.r(7, 8, 2, 4, 'o');
        }
        if k == K::Agent {
            g.r(4, 10, 8, 1, 'o');
        }
        if !aim {
            g.r(3, 8, 1, 4, 'c');
            g.r(12, 8, 1, 4, 'c');
            g.p(3, 12, 's');
            g.p(12, 12, 's');
        }
    }
    // head
    match (spy, dir) {
        (false, 0) => {
            g.ell(4, 0, 8, 7, 'h');
            g.r(5, 3, 6, 4, 's');
            g.p(6, 4, 'x');
            g.p(9, 4, 'x');
            g.r(5, 3, 6, 1, 'h');
        }
        (false, 1) => g.ell(4, 0, 8, 8, 'h'),
        (false, _) => {
            g.ell(4, 0, 8, 7, 'h');
            g.r(8, 3, 3, 3, 's');
            g.p(9, 4, 'x');
            g.p(11, 4, 's');
        }
        (true, 0) => {
            g.r(2, 2, 12, 2, 'h');
            g.r(4, 0, 8, 3, 'h');
            g.r(4, 2, 8, 1, 'o');
            g.r(5, 4, 6, 3, 's');
            g.r(5, 5, 6, 1, 'x');
        }
        (true, 1) => {
            g.r(5, 3, 6, 4, 'h');
            g.r(2, 2, 12, 2, 'h');
            g.r(4, 0, 8, 3, 'h');
            g.r(4, 2, 8, 1, 'o');
        }
        (true, _) => {
            g.r(3, 2, 12, 2, 'h');
            g.r(4, 0, 8, 3, 'h');
            g.r(4, 2, 8, 1, 'o');
            g.r(7, 4, 4, 3, 's');
            g.r(8, 5, 3, 1, 'x');
        }
    }
    if aim {
        match dir {
            0 => {
                g.r(11, 9, 2, 6, 'c');
                g.r(11, 14, 2, 2, 'o');
            }
            1 => {
                g.r(11, 2, 2, 7, 'c');
                g.r(11, 0, 2, 3, 'o');
            }
            _ => {
                g.r(10, 8, 5, 2, 'c');
                g.r(13, 7, 3, 3, 'o');
            }
        }
    }
    g
}

fn topdown() -> Vec<SpriteDef> {
    let mut v = Vec::new();
    for (k, nm) in [(K::Agent, "tdagent"), (K::Spy, "tdspy")] {
        let (pal, map) = (kpal(k), kmap(k));
        for (d, dn) in [(0u8, "d"), (1, "u"), (2, "s")] {
            for f in 0..2 {
                v.push(td_person(k, d, f, false).fin(format!("{nm}_{dn}_{f}"), pal, map));
            }
        }
        if k == K::Spy {
            for (d, dn) in [(0u8, "d"), (1, "u"), (2, "s")] {
                v.push(td_person(k, d, 0, true).fin(format!("tdspy_aim_{dn}"), pal, map));
            }
            // death: hit, then lying
            let mut g = G::new(16, 16);
            g.r(5, 0, 6, 2, 'h');
            g.r(5, 3, 6, 4, 's');
            g.p(6, 4, 'x');
            g.p(9, 4, 'x');
            g.r(7, 6, 2, 1, 'x');
            g.r(4, 7, 8, 6, 'c');
            g.r(2, 3, 2, 5, 'c');
            g.r(12, 3, 2, 5, 'c');
            g.p(2, 2, 's');
            g.p(13, 2, 's');
            g.r(5, 13, 3, 3, 'L');
            g.r(8, 13, 3, 3, 'L');
            v.push(g.fin("tdspy_die_0".into(), pal, map));
            let mut g = G::new(16, 16);
            g.r(1, 6, 5, 5, 's');
            g.r(1, 6, 5, 2, 'h');
            g.p(4, 8, 'x');
            g.r(6, 5, 7, 7, 'c');
            g.r(6, 11, 7, 1, 'o');
            g.r(13, 6, 3, 2, 'L');
            g.r(13, 9, 3, 2, 'L');
            g.r(11, 2, 5, 2, 'h');
            v.push(g.fin("tdspy_die_1".into(), pal, map));
        } else {
            // hold overhead
            let mut g = td_person(k, 0, 0, false);
            for y in 7..13 {
                g.p(3, y, '.');
                g.p(12, y, '.');
            }
            g.p(3, 12, '.');
            g.p(12, 12, '.');
            let mut h2 = G::new(16, 16);
            h2.blit(&g, 0, 3);
            h2.r(3, 4, 2, 6, 'c');
            h2.r(11, 4, 2, 6, 'c');
            h2.r(3, 2, 2, 2, 's');
            h2.r(11, 2, 2, 2, 's');
            v.push(h2.fin("tdagent_hold".into(), pal, map));
            // stunned: stars
            let mut g = td_person(k, 0, 0, false);
            g.p(6, 4, 's');
            g.p(9, 4, 's');
            g.p(6, 5, 'x');
            g.p(9, 5, 'x');
            for x in [2, 7, 12] {
                g.p(x, 0, 's');
                g.p(x - 1, 1, 's');
                g.p(x + 1, 1, 's');
            }
            v.push(g.fin("tdagent_stun".into(), pal, map));
            // searching: arms reaching forward/down
            let mut g = td_person(k, 0, 0, false);
            g.r(3, 8, 1, 3, '.');
            g.r(12, 8, 1, 3, '.');
            g.r(3, 8, 2, 6, 'c');
            g.r(11, 8, 2, 6, 'c');
            g.r(3, 13, 2, 2, 's');
            g.r(11, 13, 2, 2, 's');
            v.push(g.fin("tdagent_search".into(), pal, map));
        }
    }
    // security bot
    for f in 0..2 {
        let mut g = G::new(16, 16);
        g.r(7, 0, 2, 3, '3');
        g.r(7, 0, 2, 1, '2');
        g.r(3, 3, 10, 9, '1');
        g.r(4, 5, 8, 4, '3');
        g.r(5 + f, 6, 2, 2, '2');
        g.r(9 - f, 6, 2, 2, '2');
        g.r(5, 10, 6, 1, '3');
        g.r(1, 5, 2, 6, '1');
        g.r(13, 5, 2, 6, '1');
        g.r(2, 12, 4, 4, '3');
        g.r(10, 12, 4, 4, '3');
        g.p(3 + f * 2, 13, '1');
        g.p(11 - f * 2 + 1, 13, '1');
        g.frame_out(3, 3, 10, 9, '3');
        v.push(g.fin(format!("tdbot_{f}"), [c::GRAY, c::RED_L, c::BLACK], id));
    }
    // clerk
    let mut g = G::new(16, 16);
    g.ell(4, 0, 8, 6, 'h');
    g.r(5, 2, 6, 4, 's');
    g.p(6, 3, 'x');
    g.p(9, 3, 'x');
    g.r(4, 5, 8, 4, 'h');
    g.r(6, 5, 4, 1, 's');
    g.r(7, 5, 2, 1, 'o');
    g.r(3, 8, 10, 8, 'c');
    g.r(3, 8, 1, 8, 'o');
    g.r(12, 8, 1, 8, 'o');
    g.r(7, 9, 2, 6, 'h');
    g.p(2, 12, 's');
    g.p(13, 12, 's');
    g.r(2, 9, 1, 3, 'c');
    g.r(13, 9, 1, 3, 'c');
    v.push(g.fin("tdclerk".into(), [c::RED, c::SKIN, c::WHITE], |ch| match ch {
        'c' => '1',
        's' => '2',
        'h' => '3',
        'x' | 'o' => '1',
        '1' | '2' | '3' => ch,
        _ => '.',
    }));
    // wind-up toys 12x12 (tin soldier with a key)
    for f in 0..2 {
        let mut g = G::new(12, 12);
        g.r(4, 0, 4, 1, '3');
        g.r(3, 1, 6, 3, '2');
        g.p(4, 2, '3');
        g.p(7, 2, '3');
        g.r(3, 4, 6, 4, '1');
        g.r(5, 4, 2, 4, '2');
        g.r(1 + f, 4, 2, 3, '2');
        g.r(9 - f, 4, 2, 3, '2');
        if f == 0 {
            g.r(3, 8, 2, 3, '3');
            g.r(7, 8, 2, 2, '3');
        } else {
            g.r(3, 8, 2, 2, '3');
            g.r(7, 8, 2, 3, '3');
        }
        g.line(9, 6, 11, 4, '3', 1);
        g.p(11, 3, '3');
        g.p(10, 3, '3');
        v.push(g.fin(format!("toy_{f}"), [c::RED, c::YELLOW, c::BLACK], id));
    }
    v.push(spr("tdbullet", 4, 4, [c::YELLOW, c::WHITE, c::ORANGE], ".33.\n3123\n3223\n.33."));
    v.push(spr(
        "tdshoe",
        8,
        6,
        [c::RED, c::WHITE, c::BLACK],
        "..3333..\n.311113.\n.312213.\n31111113\n32222223\n33333333",
    ));
    v
}

fn logo() -> Vec<SpriteDef> {
    let mut g = G::new(32, 32);
    // shoulders / trench coat
    g.ell(0, 22, 32, 20, 'c');
    g.r(0, 28, 32, 4, 'c');
    g.line(10, 22, 16, 31, 'o', 1);
    g.line(22, 22, 16, 31, 'o', 1);
    g.r(5, 22, 7, 4, 'c');
    g.r(20, 22, 7, 4, 'c');
    g.line(5, 22, 11, 27, 'o', 1);
    g.line(26, 22, 20, 27, 'o', 1);
    g.r(12, 22, 8, 3, 's'); // neck
    // head
    g.ell(8, 3, 16, 14, 'h');
    g.ell(9, 7, 14, 16, 's');
    g.r(8, 3, 16, 5, 'h');
    g.r(8, 8, 3, 6, 'h');
    g.r(21, 8, 3, 6, 'h');
    g.r(12, 9, 8, 1, 'h');
    // sunglasses-less eyes, confident smirk
    g.r(11, 12, 3, 2, 'x');
    g.r(18, 12, 3, 2, 'x');
    g.r(11, 10, 3, 1, 'h');
    g.r(18, 10, 3, 1, 'h');
    g.r(15, 15, 2, 2, 's');
    g.r(13, 19, 6, 1, 'x');
    g.p(19, 18, 'x');
    g.outline('o');
    vec![g.fin("logo_agent".into(), kpal(K::Agent), m_agent)]
}

pub fn defs() -> Vec<SpriteDef> {
    let mut v = Vec::new();
    v.extend(people());
    v.extend(npcs());
    v.extend(small());
    v.extend(items());
    v.extend(hud());
    v.extend(topdown());
    v.extend(logo());
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    fn find(n: &str) -> SpriteDef {
        defs().into_iter().find(|d| d.name == n).unwrap_or_else(|| panic!("missing sprite {n}"))
    }

    #[test]
    fn required_sprites_exist_with_sizes() {
        let mut req: Vec<(String, usize, usize)> = Vec::new();
        let mut add = |n: &str, w, h| req.push((n.to_string(), w, h));
        for who in ["agent", "spy"] {
            add(&format!("{who}_stand"), 16, 24);
            for f in 0..4 {
                add(&format!("{who}_walk_{f}"), 16, 24);
            }
            add(&format!("{who}_duck"), 16, 24);
            for f in 0..3 {
                add(&format!("{who}_die_{f}"), 16, 24);
            }
        }
        for n in ["jump", "kick", "shoot", "shoot_duck", "hang", "land", "selfie"] {
            add(&format!("agent_{n}"), 16, 24);
        }
        for n in ["aim_high", "aim_low", "wave"] {
            add(&format!("spy_{n}"), 16, 24);
        }
        for f in 0..2 {
            add(&format!("janitor_walk_{f}"), 16, 24);
            add(&format!("janitor_mop_{f}"), 16, 24);
            add(&format!("cop_{f}"), 24, 24);
            add(&format!("toy_{f}"), 12, 12);
            add(&format!("tdbot_{f}"), 16, 16);
            add(&format!("tdspy_die_{f}"), 16, 16);
        }
        for f in 0..4 {
            add(&format!("walker_{f}"), 16, 24);
            add(&format!("coin_{f}"), 8, 8);
            add(&format!("coin_gold_{f}"), 8, 8);
            add(&format!("puff_{f}"), 16, 16);
        }
        add("cop_whistle", 24, 24);
        for (n, w, h) in [
            ("bullet_p", 5, 3),
            ("bullet_e", 5, 3),
            ("wet_sign", 8, 10),
            ("ping", 8, 8),
            ("bubble_tail", 5, 4),
            ("shoe", 8, 6),
            ("heart", 8, 8),
            ("arrow_down", 8, 8),
            ("photo_flash", 16, 16),
            ("hud_head", 8, 8),
            ("hud_armor", 8, 8),
            ("hud_radar", 8, 8),
            ("hud_pkg", 8, 8),
            ("tdagent_hold", 16, 16),
            ("tdagent_stun", 16, 16),
            ("tdagent_search", 16, 16),
            ("tdclerk", 16, 16),
            ("tdbullet", 4, 4),
            ("tdshoe", 8, 6),
            ("logo_agent", 32, 32),
        ] {
            add(n, w, h);
        }
        for n in [
            "item_rapid", "item_spread", "item_armor", "item_sneakers", "item_radar", "item_1up", "item_cinnabomb",
            "item_ooze", "item_pretzel", "item_package", "joke_coupon", "joke_guide", "joke_rock", "joke_ring",
            "joke_share", "photo_strip",
        ] {
            add(n, 16, 16);
        }
        for who in ["tdagent", "tdspy"] {
            for d in ["d", "u", "s"] {
                for f in 0..2 {
                    add(&format!("{who}_{d}_{f}"), 16, 16);
                }
            }
        }
        for d in ["d", "u", "s"] {
            add(&format!("tdspy_aim_{d}"), 16, 16);
        }
        for (n, w, h) in req {
            let d = find(&n);
            assert_eq!((d.w, d.h), (w, h), "{n}");
        }
    }
}
