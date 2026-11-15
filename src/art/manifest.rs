//! REQUIRED sprites. Renderers rely on these exact names/sizes. An art module may
//! add extra sprites with other names, but must provide every entry below with
//! exactly the listed w x h, at least `frames` frames, and <= 3 colours.
//! Facing: characters are drawn FACING RIGHT; renderers flip for left.
//! Characters are bottom-aligned in their cell and horizontally centred.

use crate::content::stores::STORES;
use crate::content::themes::THEMES;
use std::sync::OnceLock;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Owner {
    Characters,
    Items,
    Mallprops,
    Storefronts,
    Storeart,
}

impl Owner {
    pub const ALL: [Owner; 5] = [Owner::Characters, Owner::Items, Owner::Mallprops, Owner::Storefronts, Owner::Storeart];
    pub const fn as_str(self) -> &'static str {
        match self {
            Owner::Characters => "characters",
            Owner::Items => "items",
            Owner::Mallprops => "mallprops",
            Owner::Storefronts => "storefronts",
            Owner::Storeart => "storeart",
        }
    }
}

#[derive(Clone, Debug)]
pub struct Req {
    pub name: String,
    pub w: i32,
    pub h: i32,
    pub frames: i32,
    pub owner: Owner,
    pub note: Option<String>,
}

fn build() -> Vec<Req> {
    let mut r: Vec<Req> = Vec::new();
    let mut add = |owner: Owner, name: &str, w: i32, h: i32, frames: i32, note: Option<&str>| {
        r.push(Req { owner, name: name.to_string(), w, h, frames, note: note.map(|s| s.to_string()) });
    };
    // ---------------------------------------------------------------- characters (mall, 16x24)
    let c_ = Owner::Characters;
    add(c_, "agent.stand", 16, 24, 1, Some("red trench coat, dark hair, facing right"));
    add(c_, "agent.walk", 16, 24, 4, Some("4-frame walk cycle"));
    add(c_, "agent.jump", 16, 24, 1, None);
    add(c_, "agent.kick", 16, 24, 1, Some("jump-kick pose, leg extended forward"));
    add(c_, "agent.duck", 16, 24, 1, Some("crouched, bottom-aligned (only the bottom ~14 px are drawn)"));
    add(c_, "agent.shoot", 16, 24, 1, Some("standing, arm extended with pistol at chest height"));
    add(c_, "agent.shootlow", 16, 24, 1, Some("crouched, pistol extended low"));
    add(c_, "agent.die", 16, 24, 3, Some("hit, spin/fall, lying down"));
    add(c_, "agent.hang", 16, 24, 1, Some("hanging by both hands from a cable (hands at the top)"));
    add(c_, "agent.crouch", 16, 24, 1, Some("landing crouch after the zip line drop"));
    add(c_, "agent.selfie", 16, 24, 2, Some("holding up a phone; frame 1 = flash"));
    add(c_, "agent.ride", 16, 24, 1, Some("facing the viewer, standing in an elevator"));
    add(c_, "agent.hold", 16, 24, 1, Some("arms raised holding an item overhead (the item is drawn separately above)"));
    add(c_, "spy.stand", 16, 24, 1, Some("black suit, fedora, sunglasses, facing right"));
    add(c_, "spy.walk", 16, 24, 4, None);
    add(c_, "spy.aimhigh", 16, 24, 1, Some("clear aiming pose, pistol raised to head height"));
    add(c_, "spy.aimlow", 16, 24, 1, Some("clear aiming pose, pistol low (knee height)"));
    add(c_, "spy.duck", 16, 24, 1, None);
    add(c_, "spy.die", 16, 24, 3, None);
    add(c_, "cop.segway", 24, 24, 2, Some("mall cop in a helmet on a Segway, rolling"));
    add(c_, "cop.whistle", 24, 24, 1, Some("blowing a whistle"));
    add(c_, "janitor.walk", 16, 24, 2, None);
    add(c_, "janitor.mop", 16, 24, 2, Some("mopping"));
    add(c_, "walker.walk", 16, 24, 4, Some("retiree in a tracksuit, power-walking with swinging arms"));
    add(c_, "sign.wet", 8, 12, 1, Some("yellow wet-floor sign"));
    // ---------------------------------------------------------------- items / fx / hud
    let i_ = Owner::Items;
    for id in ["rapid", "spread", "armor", "sneakers", "radar", "oneup", "cinnabomb", "ooze", "pretzel"] {
        add(i_, &format!("item.{}", id), 12, 12, 1, Some("power-up icon"));
    }
    add(i_, "item.package", 12, 12, 1, Some("taped brown package"));
    add(i_, "item.joke", 12, 12, 1, Some("generic joke item (coupon, rock...)"));
    add(i_, "item.photostrip", 8, 12, 1, Some("photo strip"));
    add(i_, "item.coin", 8, 8, 4, Some("spinning coin"));
    add(i_, "item.goldcoin", 8, 8, 4, Some("spinning gold coin (extra life)"));
    add(i_, "bullet.player", 5, 3, 1, None);
    add(i_, "bullet.enemy", 5, 3, 1, None);
    add(i_, "fx.spark", 8, 8, 3, Some("bullet impact / helmet ping"));
    add(i_, "fx.puff", 16, 16, 4, Some("smoke puff"));
    add(i_, "fx.glass", 8, 8, 3, Some("glass shard burst"));
    add(i_, "hud.head", 8, 8, 1, Some("agent head icon for lives"));
    add(i_, "hud.armor", 8, 8, 1, None);
    add(i_, "hud.radar", 8, 8, 1, None);
    // ---------------------------------------------------------------- mall props
    let m_ = Owner::Mallprops;
    add(m_, "car.closed", 24, 32, 1, Some("elevator car, doors closed"));
    add(m_, "car.open", 24, 32, 1, Some("elevator car, doors open (empty interior, back wall)"));
    add(m_, "shaft.wall", 24, 16, 1, Some("shaft background tile, repeated vertically"));
    add(m_, "grate", 24, 4, 1, Some("floor grate covering an opening (car above)"));
    add(m_, "mall.slab", 16, 8, 1, Some("floor slab tile (repeats horizontally); the top row is the walking surface"));
    add(m_, "mall.wall", 16, 16, 2, Some("corridor back wall tile (repeats); frame 1 = variant"));
    add(m_, "esc.step", 8, 4, 4, Some("escalator step, 4 animation phases"));
    add(m_, "esc.rail", 4, 4, 1, Some("escalator handrail dot"));
    add(m_, "lamp.shade", 12, 10, 2, Some("hanging lamp shade; frame 0 lit, frame 1 dark"));
    add(m_, "lamp.broken", 12, 10, 1, Some("shattered lamp"));
    add(m_, "disco.ball", 12, 12, 4, Some("rotating glittering disco ball"));
    add(m_, "kiosk", 24, 32, 2, Some("directory kiosk; frame 1 = screen on"));
    add(m_, "booth", 24, 32, 2, Some("photo booth; frame 0 curtain open, frame 1 curtain closed (feet visible)"));
    add(m_, "fountain", 40, 24, 4, Some("mall fountain, animated water"));
    add(m_, "bench", 24, 12, 1, None);
    add(m_, "plant", 16, 24, 1, None);
    add(m_, "pillar", 16, 48, 1, Some("parking-garage concrete pillar"));
    add(m_, "wagon", 72, 28, 2, Some("wood-panelled station wagon facing right; frame 1 = lights on"));
    add(m_, "post", 8, 16, 1, Some("zip-line anchor post on the roof"));
    add(m_, "ac", 24, 16, 1, Some("rooftop air-conditioning unit"));
    add(m_, "pigeon", 8, 8, 2, None);
    // ---------------------------------------------------------------- storefront pieces (28x28 windows, 20x28 doors)
    let s_ = Owner::Storefronts;
    for s in STORES.iter() {
        let id = s.id.as_str();
        add(s_, &format!("win.{}.L", id), 28, 28, 2, Some(&format!("{}: left window display, 1-3 idle frames", s.name)));
        add(s_, &format!("win.{}.R", id), 28, 28, 2, Some(&format!("{}: right window display", s.name)));
    }
    add(s_, "door.target", 20, 28, 2, Some("red door; frame 1 = bright (blinks)"));
    add(s_, "door.powerup", 20, 28, 1, Some("blue door"));
    add(s_, "door.closed", 20, 28, 1, Some("rolled-down shutter"));
    add(s_, "door.dark", 20, 28, 1, Some("darkened door (target store already cleared)"));
    // ---------------------------------------------------------------- store (top-down) art, 16x16 tiles
    let t_ = Owner::Storeart;
    for t in THEMES.iter() {
        for k in ["floor", "wall", "counter", "decor", "shelf", "shelf.open", "rack", "rack.open"] {
            add(t_, &format!("st.{}.{}", t.as_str(), k), 16, 16, 1, Some(&format!("{} theme tile", t.as_str())));
        }
    }
    add(t_, "st.door", 32, 16, 1, Some("doorway (2 tiles wide) at the bottom centre; walkable"));
    add(t_, "st.fitting", 16, 16, 1, Some("Forever 12 fitting room (curtain closed)"));
    add(t_, "st.fitting.open", 16, 16, 1, None);
    add(t_, "st.toyshelf", 16, 16, 1, Some("KGB Toys shelf of wind-up toys"));
    add(t_, "st.toyshelf.open", 16, 16, 1, Some("toy shelf after the toys were released"));
    add(t_, "st.booth", 16, 16, 2, Some("Sam Baddy listening booth; frame 1 = active"));
    add(t_, "st.tv", 16, 16, 3, Some("flickering demo TV (solid decor)"));
    add(t_, "st.pedestal", 16, 16, 1, Some("item pedestal"));
    add(t_, "td.agent.down", 16, 16, 2, Some("top-down agent walking toward the viewer"));
    add(t_, "td.agent.up", 16, 16, 2, None);
    add(t_, "td.agent.side", 16, 16, 2, Some("facing right; flip for left"));
    add(t_, "td.agent.hold", 16, 16, 1, Some("item held overhead"));
    add(t_, "td.agent.stun", 16, 16, 2, Some("stunned (stars)"));
    add(t_, "td.spy.down", 16, 16, 2, None);
    add(t_, "td.spy.up", 16, 16, 2, None);
    add(t_, "td.spy.side", 16, 16, 2, None);
    add(t_, "td.spy.change", 16, 16, 1, Some("shrieking spy caught mid-change in the fitting room"));
    add(t_, "td.bot", 16, 16, 2, Some("security bot"));
    add(t_, "td.toy", 16, 16, 2, Some("marching wind-up toy (facing right)"));
    add(t_, "td.clerk", 16, 16, 2, Some("old clerk of the GameStonk easter egg"));
    add(t_, "td.shoe", 8, 8, 2, Some("thrown shoe"));
    add(t_, "td.bullet", 4, 4, 1, None);
    r
}

static REQUIRED: OnceLock<Vec<Req>> = OnceLock::new();

/// TS `REQUIRED_SPRITES`.
pub fn required_sprites() -> &'static [Req] {
    REQUIRED.get_or_init(build)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::art::registry::{all_sprites, get_sprite, has_sprite};
    use crate::engine::palette::TRANSPARENT;
    use crate::engine::sprite::MAX_SPRITE_COLORS;

    #[test]
    fn has_a_unique_required_name_list() {
        let names: Vec<&str> = required_sprites().iter().map(|r| r.name.as_str()).collect();
        let mut u = names.clone();
        u.sort();
        u.dedup();
        assert_eq!(u.len(), names.len());
    }

    fn check_owner(owner: Owner) {
        let mut problems: Vec<String> = Vec::new();
        for r in required_sprites().iter().filter(|x| x.owner == owner) {
            if !has_sprite(&r.name) {
                problems.push(format!("missing {}", r.name));
                continue;
            }
            let s = get_sprite(&r.name);
            if s.w != r.w || s.h != r.h {
                problems.push(format!("{}: size {}x{}, expected {}x{}", r.name, s.w, s.h, r.w, r.h));
            }
            if s.frame_count() < r.frames {
                problems.push(format!("{}: {} frames, expected >= {}", r.name, s.frame_count(), r.frames));
            }
        }
        assert_eq!(problems, Vec::<String>::new());
    }

    #[test]
    fn every_required_characters_sprite_exists_with_the_right_size_frames_and_le_3_colours() {
        check_owner(Owner::Characters);
    }
    #[test]
    fn every_required_items_sprite_exists_with_the_right_size_frames_and_le_3_colours() {
        check_owner(Owner::Items);
    }
    #[test]
    fn every_required_mallprops_sprite_exists_with_the_right_size_frames_and_le_3_colours() {
        check_owner(Owner::Mallprops);
    }
    #[test]
    fn every_required_storefronts_sprite_exists_with_the_right_size_frames_and_le_3_colours() {
        check_owner(Owner::Storefronts);
    }
    #[test]
    fn every_required_storeart_sprite_exists_with_the_right_size_frames_and_le_3_colours() {
        check_owner(Owner::Storeart);
    }

    #[test]
    fn every_registered_sprite_uses_at_most_3_colours_plus_transparent_and_has_no_empty_frame() {
        for s in all_sprites() {
            assert!(s.colors.len() <= MAX_SPRITE_COLORS, "{}", s.name);
            for f in 0..s.frame_count() as usize {
                let opaque = s.frames[f].iter().filter(|&&v| v != TRANSPARENT).count();
                assert!(opaque > 0, "{} frame {} is empty", s.name, f);
            }
        }
    }
}
