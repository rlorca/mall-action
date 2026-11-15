//! Side-scrolling mall view.
use super::{Renderer, HUD_H, SCREEN_H, SCREEN_W};
use crate::font::*;
use crate::game::elevator::Opening;
use crate::game::level::*;
use crate::game::mall::*;
use crate::game::Game;
use crate::pixel::{c, Canvas};
use crate::stores::{self, Role, StoreId};

pub fn slug(id: StoreId) -> &'static str {
    match id {
        StoreId::Forever12 => "forever12",
        StoreId::RadioShock => "radioshock",
        StoreId::Crookstone => "crookstone",
        StoreId::GameStonk => "gamestonk",
        StoreId::KgbToys => "kgbtoys",
        StoreId::BlockBlusterVideo => "bbv",
        StoreId::SpendersGifts => "spenders",
        StoreId::SamBaddy => "sambaddy",
        StoreId::SharperImagine => "sharper",
        StoreId::HotSpyOnAStick => "hotspy",
        StoreId::CircuitPity => "circuitpity",
        StoreId::FootLockpicker => "footlock",
        StoreId::BorderlineBooks => "borderline",
    }
}

/// Camera for the mall view: top-left in world pixels.
pub fn camera(m: &Mall) -> (i32, i32) {
    let fx = m.p.x as i32;
    let fy = m.feet_y() as i32;
    let cx = (fx - 128).clamp(0, WORLD_W - 256);
    let cy = (fy - 120).clamp(0, WORLD_H - 224);
    (cx, cy)
}

impl Renderer {
    /// Draw one storefront (used by the mall, the title screen and game over).
    pub fn draw_storefront(&self, cv: &mut Canvas, x: i32, fy: i32, id: StoreId, frame: i64, state: StoreLook) {
        let info = stores::info(id);
        let top = fy - 40;
        cv.rect(x, top, 80, 40, c::BLACK);
        // sign band
        let (sign_bg, sign_fg) = match info.role {
            Role::Target => (c::RED_D, c::WHITE),
            Role::PowerUp => (c::BLUE_D, c::WHITE),
            Role::Closed => (c::GRAY_D, c::GRAY),
        };
        cv.rect(x, top, 80, 10, sign_bg);
        cv.rect(x, top + 9, 80, 1, c::BLACK);
        draw_tiny_center(cv, x + 40, top + 2, info.name, sign_fg);
        let sl = slug(id);
        let l = self.sprites.anim(&format!("sf_{sl}_l"), (frame / 12) as usize);
        let r = self.sprites.anim(&format!("sf_{sl}_r"), (frame / 12 + 1) as usize);
        cv.blit(l, x, fy - 28);
        cv.blit(r, x + 48, fy - 28);
        let door = match (info.role, state) {
            (Role::Closed, _) => "sf_door_shutter".to_string(),
            (Role::Target, StoreLook::Cleared) => "sf_door_dark".to_string(),
            (Role::Target, _) => format!("sf_door_target_{}", (frame / 20) % 2),
            (Role::PowerUp, _) => "sf_door_power".to_string(),
        };
        cv.blit(self.spr(&door), x + 32, fy - 28);
        if state == StoreLook::Cleared {
            cv.shade_rect(x, top + 10, 32, 30, 0.45);
            cv.shade_rect(x + 48, top + 10, 32, 30, 0.45);
        }
        cv.frame(x, top, 80, 40, c::BLACK);
    }

    pub(crate) fn draw_mall(&self, g: &Game, cv: &mut Canvas) {
        let m = &g.mall;
        let (mut cx, mut cy) = camera(m);
        if m.shake > 0 {
            cx += ((m.t / 2) % 3 - 1) * (m.shake.min(4) / 2 + 1);
            cy += ((m.t / 3) % 3 - 1) * (m.shake.min(4) / 2);
        }
        cv.set_clip(0, HUD_H, SCREEN_W as i32, SCREEN_H as i32);
        let sx = |wx: i32| wx - cx;
        let sy = |wy: i32| wy - cy + HUD_H;
        // ---- sky ----
        self.draw_sky(cv, cy);
        // skyscraper + cable + anchor
        cv.blit(self.spr("skyscraper"), sx(0), sy(ROOF_Y - 112));
        cv.blit(self.spr("moon"), sx(210), sy(ROOF_Y - 100));
        // ---- floors ----
        for f in 0..=FLOOR_R {
            self.draw_floor_band(cv, f, cx, cy);
        }
        // roof extras
        let ay = ROOF_Y;
        cv.blit(self.spr("anchor_post"), sx(ANCHOR_X - 6), sy(ay - 24));
        if matches!(m.p.st, PState::Zip(_) | PState::Drop) || m.t < 400 {
            // cable
            let (x0, y0) = (SKY_TOP_X, ROOF_Y - 104);
            let (x1, y1) = (ANCHOR_X - 2, ROOF_Y - 22);
            let n = (x1 - x0).max(1);
            for i in 0..=n {
                let y = y0 + (y1 - y0) * i / n;
                cv.pset(sx(x0 + i), sy(y), c::GRAY_L);
                cv.pset(sx(x0 + i), sy(y + 1), c::GRAY_D);
            }
        }
        // ---- shafts ----
        for i in 0..3 {
            self.draw_shaft(g, cv, i, cx, cy);
        }
        // ---- storefronts ----
        for s in STORE_SLOTS.iter() {
            if s.x + 80 < cx || s.x > cx + 256 {
                continue;
            }
            let st = g.store_state(s.id);
            let look = if st.role() == Role::Target && st.package_taken { StoreLook::Cleared } else { StoreLook::Normal };
            self.draw_storefront(cv, sx(s.x), sy(floor_y(s.floor)), s.id, m.t as i64, look);
            if g.s.bf && st.open_for_entry() {
                cv.blit(self.spr("sf_sale70"), sx(s.x + 26), sy(floor_y(s.floor) - 38));
            }
            if g.has_radar() && st.role() == Role::Target && !st.package_taken && (m.t / 15) % 2 == 0 {
                draw_text_shadow(cv, sx(s.x + 37), sy(floor_y(s.floor) - 52), "!", c::YELLOW, c::BLACK);
            }
        }
        // ---- furniture ----
        for (f, x) in KIOSKS {
            let fy = floor_y(f);
            cv.blit(self.spr("kiosk"), sx(x - 12), sy(fy - 32));
            cv.blit(self.sprites.anim("kiosk_screen", (m.t / 30) as usize), sx(x - 8), sy(fy - 27));
        }
        {
            let (f, x) = PHOTO_BOOTH;
            let fy = floor_y(f);
            let k = if matches!(m.p.st, PState::Hidden(_)) { 1 } else { 0 };
            cv.blit(self.spr(&format!("photo_booth_{k}")), sx(x - 12), sy(fy - 32));
        }
        for fo in m.fountains.iter() {
            let fy = floor_y(fo.floor);
            cv.blit(self.sprites.anim("fountain", (m.t / 8) as usize), sx(fo.x as i32 - 16), sy(fy - 24));
        }
        for (f, x) in BENCHES {
            cv.blit(self.spr("bench"), sx(x - 12), sy(floor_y(f) - 12));
        }
        for (k, (f, x)) in PLANTS.iter().enumerate() {
            cv.blit(self.sprites.anim("plant", k), sx(x - 8), sy(floor_y(*f) - 24));
        }
        for x in PILLARS {
            cv.blit(self.spr("pillar"), sx(x - 8), sy(floor_y(FLOOR_P) - 48 + 8));
        }
        // getaway car
        {
            let fy = floor_y(FLOOR_P);
            cv.blit(self.spr("parking_sign"), sx(WAGON_X - 36), sy(fy - 36));
            cv.blit(self.sprites.anim("wagon", 0), sx(WAGON_X), sy(fy - 24));
        }
        // escalators
        for e in ESCALATORS.iter() {
            self.draw_escalator(cv, e, m.t, cx, cy);
        }
        // lamps
        for l in m.lamps.iter() {
            let fy = floor_y(l.floor);
            match l.st {
                LampState::Hang => {
                    let spr = if l.disco { self.sprites.anim("disco_hang", (m.t / 6) as usize) } else { self.spr("lamp") };
                    let h = spr.h as i32;
                    cv.blit(spr, sx(l.x as i32 - spr.w as i32 / 2), sy(fy - 40));
                    // longer cord down to the shade so a chest-height shot visibly hits
                    cv.vline(sx(l.x as i32), sy(fy - 40 + h - 2), 8, c::GRAY_D);
                }
                LampState::Fall { y, .. } => {
                    cv.blit(self.spr(if l.disco { "disco_ball" } else { "lamp" }), sx(l.x as i32 - 5), sy(y as i32 - 10));
                }
                LampState::Roll { .. } => {
                    cv.blit(self.spr("disco_ball"), sx(l.x as i32 - 6), sy(fy - 12));
                }
                LampState::Wreck(_) => {
                    cv.blit(self.spr("lamp_wreck"), sx(l.x as i32 - 5), sy(fy - 8));
                }
            }
        }
        // wet floor
        if let Some(w) = &m.wet {
            let fy = floor_y(WET_FLOOR);
            let x0 = (w.cx - WET_W / 2.0) as i32;
            for i in 0..WET_W as i32 {
                if (i + m.t / 8) % 6 < 5 {
                    cv.pset(sx(x0 + i), sy(fy), c::SKY);
                    cv.pset(sx(x0 + i), sy(fy + 1), c::BLUE_L);
                }
            }
            cv.blit(self.spr("wet_sign"), sx(w.cx as i32 - 4), sy(fy - 10));
        }
        // janitor
        {
            let j = &m.janitor;
            let name = if j.mop > 0 { "janitor_mop" } else { "janitor_walk" };
            let s = self.sprites.anim(name, (m.t / 12) as usize);
            cv.blit_flip(s, sx(j.x as i32 - 8), sy(floor_y(WET_FLOOR) - 24), j.dir < 0);
        }
        // walkers
        for (i, w) in m.walkers.iter().enumerate() {
            let s = self.sprites.anim("walker", (m.t / 8) as usize + i);
            let pal = if i == 1 { Some([c::PINK, c::PURPLE_L, c::WHITE]) } else { None };
            cv.blit_ex(s, sx(w.x as i32 - 8), sy(floor_y(WALKER_FLOOR) - 24), w.dir < 0, false, pal);
        }
        // coins & pickups
        for co in m.coins.iter() {
            let n = if co.gold { "coin_gold" } else { "coin" };
            cv.blit(self.sprites.anim(n, (m.t / 5) as usize), sx(co.x as i32 - 4), sy(co.y as i32 - 4));
        }
        for p in m.pickups.iter() {
            let bob = ((m.t / 8) % 2) as i32;
            cv.blit(self.spr(p.kind.sprite()), sx(p.x as i32 - 8), sy(floor_y(p.floor) - 18 - bob));
        }
        // mall cop
        {
            let co = &m.cop;
            let s = if co.whistle > 0 { self.spr("cop_whistle") } else { self.sprites.anim("cop", (m.t / 8) as usize) };
            cv.blit_flip(s, sx(co.x as i32 - 12), sy(floor_y(co.floor) - 24), co.dir < 0);
        }
        // spies
        for s in m.spies.iter() {
            self.draw_spy(cv, s, m, cx, cy);
        }
        // player
        self.draw_player(g, cv, cx, cy);
        // bullets
        for b in m.bullets.iter() {
            let s = self.spr(if b.hostile { "bullet_e" } else { "bullet_p" });
            cv.blit_flip(s, sx(b.x as i32 - 2), sy(b.y as i32 - 1), b.vx < 0.0);
        }
        for (px, py, t) in m.ping.iter() {
            if *t > 0 {
                cv.blit(self.spr("ping"), sx(*px as i32 - 4), sy(*py as i32 - 4));
            }
        }
        // dark sections (shot lamps)
        for d in m.dark.iter() {
            let fy = floor_y(d.floor);
            let k = if d.t > 100 { 0.45 } else { 0.45 + 0.55 * (100 - d.t) as f32 / 100.0 };
            let x0 = (sx(d.x0 as i32)).max(0);
            let x1 = sx(d.x1 as i32).min(SCREEN_W as i32);
            if x1 > x0 {
                cv.shade_rect(x0, sy(fy - 40), x1 - x0, 48, k.min(1.0));
            }
        }
        // popups & bubbles
        for p in m.popups.iter() {
            draw_text_shadow(cv, sx(p.x as i32) - text_width(&p.text) / 2, sy(p.y as i32), &p.text, c::WHITE, c::BLACK);
        }
        for b in m.bubbles.iter() {
            self.draw_bubble(cv, sx(b.x as i32), sy(b.y as i32), &b.text);
        }
        // alarm light
        if m.alarm {
            let k = (m.t / 10) % 2;
            if k == 0 {
                cv.frame(0, HUD_H, SCREEN_W as i32, SCREEN_H as i32 - HUD_H, c::RED_D);
                cv.frame(1, HUD_H + 1, SCREEN_W as i32 - 2, SCREEN_H as i32 - HUD_H - 2, c::RED_D);
            }
        }
        // camera flash
        if m.flash > 0 {
            cv.rect(0, HUD_H, 256, 224, c::WHITE);
        }
        cv.reset_clip();
        // kiosk panel, banner, selfie, photo strip
        if m.kiosk_panel > 0 {
            self.draw_kiosk_panel(g, cv);
        }
        if m.strip_t > 0 {
            self.draw_photo_strip(cv, m.strip_t);
        }
        if let PState::Selfie(t) = m.p.st {
            self.draw_spygram(cv, &crate::copy::ARRIVAL_POSTS[m.post], 150 - t, "agent_selfie", true);
        }
        if let Some(b) = &m.banner {
            self.draw_banner(cv, &b.lines, b.alert, b.t, b.total);
        }
    }

    fn draw_sky(&self, cv: &mut Canvas, cy: i32) {
        // night sky gradient bands (world y 0..ROOF_Y), below that a dark wall behind the roof
        let bands = [c::BLACK, 0x01, 0x02, 0x02, 0x12, 0x13];
        for y in 0..(SCREEN_H as i32 - HUD_H) {
            let wy = y + cy;
            let k = (wy as f32 / ROOF_Y as f32 * bands.len() as f32) as usize;
            let col = bands[k.min(bands.len() - 1)];
            cv.hline(0, y + HUD_H, SCREEN_W as i32, col);
        }
        for i in 0..24 {
            let wx = (i * 83 + 17) % 256;
            let wy = (i * 37 + 9) % (ROOF_Y - 20);
            if self.star_phase(i) {
                cv.pset(wx, wy - cy + HUD_H, c::WHITE);
            }
        }
    }
    fn star_phase(&self, i: i32) -> bool {
        i % 3 != 0
    }

    fn draw_floor_band(&self, cv: &mut Canvas, f: u8, cx: i32, cy: i32) {
        let fy = floor_y(f);
        let sy = |wy: i32| wy - cy + HUD_H;
        let x_start = cx / 16 * 16;
        let mut x = x_start;
        while x < cx + 256 + 16 {
            let sxp = x - cx;
            let alt = ((x / 16) % 2) as usize;
            match f {
                FLOOR_R => {
                    cv.blit(self.spr("roof_rail"), sxp, sy(fy - 16));
                    cv.blit(self.spr("roof_floor"), sxp, sy(fy));
                    cv.blit(self.spr("roof_slab"), sxp, sy(fy + 8));
                }
                FLOOR_P => {
                    cv.blit(self.spr("tile_ceiling"), sxp, sy(fy - 40));
                    cv.blit(self.spr("park_wall"), sxp, sy(fy - 32));
                    cv.blit(self.spr("park_wall"), sxp, sy(fy - 16));
                    cv.blit(self.spr("park_floor"), sxp, sy(fy));
                    cv.blit(self.spr("park_slab"), sxp, sy(fy + 8));
                }
                _ => {
                    cv.blit(self.spr("tile_ceiling"), sxp, sy(fy - 40));
                    cv.blit(self.spr(&format!("tile_wall_{alt}")), sxp, sy(fy - 32));
                    cv.blit(self.spr(&format!("tile_wall_{}", 1 - alt)), sxp, sy(fy - 16));
                    cv.blit(self.spr(&format!("tile_floor_{alt}")), sxp, sy(fy));
                }
            }
            x += 16;
        }
    }

    fn draw_shaft(&self, g: &Game, cv: &mut Canvas, i: usize, cx: i32, cy: i32) {
        let m = &g.mall;
        let s = SHAFTS[i];
        if s.x + 32 < cx || s.x > cx + 256 {
            return;
        }
        let sx = s.x - cx;
        let sy = |wy: i32| wy - cy + HUD_H;
        let top = floor_y(s.top) - 40;
        let bot = floor_y(s.bottom) + 8;
        let mut y = top;
        while y < bot {
            cv.blit(self.spr("shaft_back"), sx, sy(y));
            y += 16;
        }
        // cable
        let car = &m.cars[i];
        let mut y = top;
        while y < car.y - 40 {
            cv.blit(self.spr("shaft_cable"), sx + 14, sy(y));
            y += 16;
        }
        cv.blit(self.spr("shaft_top"), sx, sy(top - 8));
        for f in s.bottom..=s.top {
            let fy = floor_y(f);
            match car.opening(f) {
                Opening::CarHere => {
                    cv.blit(self.spr("shaft_frame_door"), sx, sy(fy - 40));
                }
                Opening::Grate => {
                    cv.blit(self.spr("shaft_opening"), sx, sy(fy - 40));
                    cv.blit(self.spr("grate"), sx, sy(fy));
                }
                Opening::Pit => {
                    cv.blit(self.spr("shaft_opening"), sx, sy(fy - 40));
                    cv.blit(self.spr("pit"), sx, sy(fy));
                }
                Opening::None => {}
            }
            let lamp = if car.floor_at() == Some(f) { 1 } else { 0 };
            cv.blit(self.spr(&format!("floor_lamp_{lamp}")), sx + 12, sy(fy - 48 + 3));
        }
        // the car (rider is drawn by draw_player: roof riders on top, inside riders behind the doors)
        let name = match car.doors {
            0 => "car_closed",
            1..=7 => "car_half",
            _ => "car_open",
        };
        let inside = matches!(m.p.st, PState::Inside(j) if j == i);
        if inside && car.doors < 4 {
            self.draw_player_sprite(g, cv, cx, cy);
        }
        cv.blit(self.spr(name), sx, sy(car.y - 40));
    }

    fn draw_escalator(&self, cv: &mut Canvas, e: &EscDef, t: i32, cx: i32, cy: i32) {
        let sy = |wy: i32| wy - cy + HUD_H;
        let fy = floor_y(e.low);
        for k in 0..3 {
            let x = e.x_low + 16 * k - cx;
            let y = fy - 16 * (k + 1);
            cv.blit(self.sprites.anim("esc", ((t / 6) as usize + k as usize) % 4), x, sy(y));
            cv.blit(self.spr("esc_rail"), x, sy(y - 10));
        }
        cv.blit(self.spr("esc_landing"), e.x_low - 16 - cx, sy(fy));
        cv.blit(self.spr("esc_landing"), e.x_high() - cx, sy(floor_y(e.high())));
    }

    fn draw_spy(&self, cv: &mut Canvas, s: &Spy, m: &Mall, cx: i32, cy: i32) {
        let fy = floor_y(s.floor);
        let (x, y) = (s.x as i32 - 8 - cx, fy - 24 - cy + HUD_H);
        let name: String = match s.st {
            SpyState::Aim(_, true) => "spy_aim_high".into(),
            SpyState::Aim(_, false) => "spy_aim_low".into(),
            SpyState::Duck(_) => "spy_duck".into(),
            SpyState::Dying(t) => format!("spy_die_{}", (((SPY_DEATH - t.max(0)) * 3) / (SPY_DEATH + 1)).clamp(0, 2)),
            SpyState::Wait(_) => "spy_stand".into(),
            SpyState::Walk => format!("spy_walk_{}", (s.anim / 8) % 4),
        };
        let _ = m;
        cv.blit_flip(self.spr(&name), x, y, s.dir < 0);
    }

    fn draw_player(&self, g: &Game, cv: &mut Canvas, cx: i32, cy: i32) {
        let m = &g.mall;
        // inside riders with open doors are drawn after the car; closed doors hide them
        if let PState::Inside(i) = m.p.st {
            if m.cars[i].doors < 4 {
                return;
            }
        }
        self.draw_player_sprite(g, cv, cx, cy);
    }

    fn draw_player_sprite(&self, g: &Game, cv: &mut Canvas, cx: i32, cy: i32) {
        let m = &g.mall;
        let p = &m.p;
        if matches!(p.st, PState::Hidden(_)) {
            return;
        }
        // blinking invulnerability
        if p.inv > 0 && (m.t / 3) % 2 == 0 && !matches!(p.st, PState::Dying(_)) {
            return;
        }
        let feet = m.feet_y();
        let name: String = match p.st {
            PState::Zip(_) => "agent_hang".into(),
            PState::Drop => "agent_jump".into(),
            PState::Land(_) => "agent_land".into(),
            PState::Selfie(_) => "agent_selfie".into(),
            PState::Dying(t) => format!("agent_die_{}", (((70 - t.max(0)) / 8).clamp(0, 2))),
            PState::Fall { .. } => "agent_jump".into(),
            PState::Inside(_) | PState::Roof(_) => if p.shoot_pose > 0 { "agent_shoot".into() } else { "agent_stand".into() },
            PState::Esc { .. } => if p.shoot_pose > 0 { "agent_shoot".into() } else { "agent_stand".into() },
            _ => {
                if p.z > 0.0 {
                    if p.kick { "agent_kick".into() } else { "agent_jump".into() }
                } else if p.duck {
                    if p.shoot_pose > 0 { "agent_shoot_duck".into() } else { "agent_duck".into() }
                } else if p.shoot_pose > 0 {
                    "agent_shoot".into()
                } else if p.moving && p.slide == 0 {
                    format!("agent_walk_{}", (p.anim / 6) % 4)
                } else {
                    "agent_stand".into()
                }
            }
        };
        let x = p.x as i32 - 8 - cx;
        let y = feet as i32 - 24 - cy + HUD_H;
        let flip = p.face < 0;
        let s = self.spr(&name);
        if g.powers.invincible() && (m.t / 2) % 2 == 0 {
            cv.blit_ex(s, x, y, flip, false, Some([c::YELLOW, c::WHITE, c::ORANGE]));
        } else {
            cv.blit_flip(s, x, y, flip);
        }
        if g.powers.armor {
            cv.pset(x + if flip { 12 } else { 3 }, y + 9, c::CYAN_L);
        }
    }

    pub(crate) fn draw_bubble(&self, cv: &mut Canvas, x: i32, y: i32, text: &str) {
        let w = text_width(text) + 6;
        let bx = (x - w / 2).clamp(2, SCREEN_W as i32 - w - 2);
        let by = y.clamp(HUD_H + 2, SCREEN_H as i32 - 20);
        draw_box(cv, bx, by - 9, w, 11, c::WHITE, c::BLACK);
        draw_text(cv, bx + 3, by - 7, text, c::BLACK);
        let tx = x.clamp(bx + 4, bx + w - 8);
        cv.blit(self.spr("bubble_tail"), tx - 2, by + 2);
    }

    pub(crate) fn draw_banner(&self, cv: &mut Canvas, lines: &[String], alert: bool, t: i32, total: i32) {
        let h = lines.len() as i32 * 9 + 6;
        let w = lines.iter().map(|l| text_width(l)).max().unwrap_or(0) + 12;
        // slide in/out
        let slide = ((total - t).min(8).min(t.max(0))).clamp(0, 8);
        let y = 22 - (8 - slide);
        let x = (SCREEN_W as i32 - w) / 2;
        let (bg, fg) = if alert { (c::RED_D, c::WHITE) } else { (c::BLUE_D, c::WHITE) };
        draw_box(cv, x, y, w, h, bg, c::WHITE);
        for (i, l) in lines.iter().enumerate() {
            draw_text_center(cv, 128, y + 4 + i as i32 * 9, l, fg);
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoreLook {
    Normal,
    Cleared,
}
