//! The sprite manifest: every named sprite the game draws, with its exact size and minimum frame count.
//! Consumers (mall, store, screens) draw sprites with `art::get("name")`. The art modules must provide
//! every entry; `art::tests::manifest_is_complete` enforces it (right size, >= frames, <= 3 colours).
//!
//! A consumer that needs a sprite not listed here may append a line to the matching section and tell the
//! art owner (or draw it procedurally with `Fb` primitives). Never rename an entry.

/// (name, width, height, min_frames)
pub type Entry = (&'static str, usize, usize, usize);

/// Mall side-view characters (16x24 canvas, feet on the bottom row, facing RIGHT; draw with flip for left).
pub const CHARACTERS: &[Entry] = &[
    // Agent: red trench coat, dark hair.
    ("agent_stand", 16, 24, 1),
    ("agent_walk", 16, 24, 4),
    ("agent_duck", 16, 24, 1),
    ("agent_jump", 16, 24, 1),
    ("agent_kick", 16, 24, 1),      // jump-kick pose
    ("agent_aim", 16, 24, 1),       // standing shot pose (arm out, gun forward)
    ("agent_aim_duck", 16, 24, 1),  // ducking shot pose
    ("agent_die", 16, 24, 3),       // 3-frame death
    ("agent_hang", 16, 24, 1),      // hanging from the zip line by both hands (arms straight up)
    ("agent_crouch", 16, 24, 1),    // landing crouch
    ("agent_selfie", 16, 24, 2),    // holding up a phone, 2 frames
    ("agent_slip", 16, 24, 1),      // sliding on the wet floor
    // Spy: black suit, fedora, sunglasses.
    ("spy_stand", 16, 24, 1),
    ("spy_walk", 16, 24, 4),
    ("spy_aim", 16, 24, 1),         // aiming HIGH (telegraph + shot)
    ("spy_aim_low", 16, 24, 1),     // aiming LOW
    ("spy_duck", 16, 24, 1),
    ("spy_die", 16, 24, 3),
    ("spy_wave", 16, 24, 2),        // waving a receipt (level clear)
    // Neutrals
    ("janitor_walk", 16, 24, 2),
    ("janitor_mop", 16, 24, 2),
    ("walker_a", 16, 24, 4),        // mall walker in a tracksuit (pink/purple)
    ("walker_b", 16, 24, 4),        // mall walker in a tracksuit (teal/white)
    ("cop_segway", 24, 24, 2),      // mall cop on a Segway
    // 8x8 head for the lives counter
    ("head_icon", 8, 8, 1),
];

/// Small effects, bullets, icons.
pub const EFFECTS: &[Entry] = &[
    ("bullet_player", 4, 2, 1),
    ("bullet_enemy", 4, 2, 1),
    ("bullet_td", 4, 4, 1),         // top-down bullets
    ("bullet_td_enemy", 4, 4, 1),
    ("spark", 8, 8, 3),             // hit spark / puff, 3 frames
    ("puff_smoke", 16, 16, 4),      // smoke puff, 4 frames
    ("coin", 8, 8, 4),              // spinning coin
    ("gold_coin", 8, 8, 4),         // gold coin (extra life)
    ("lamp_shards", 16, 8, 3),      // shattered lamp on the floor
    ("exclaim", 8, 8, 1),           // radar "!" marker
    ("armor_icon", 8, 8, 1),
    ("radar_icon", 8, 8, 1),
    ("package", 16, 16, 1),         // the package held overhead / on the map
    ("package_small", 8, 8, 1),
    ("receipt", 8, 16, 2),          // long receipt (level-clear spy)
    ("shoe", 8, 8, 2),              // thrown shoe (Forever 12 fitting room)
    ("phone_flash", 16, 16, 2),     // camera flash burst for the selfie
    ("heart", 8, 8, 1),
];

/// Power-up icons, 12x12 (also shown held overhead and in the HUD).
pub const POWERUPS: &[Entry] = &[
    ("pu_rapid", 12, 12, 1),
    ("pu_spread", 12, 12, 1),
    ("pu_armor", 12, 12, 1),
    ("pu_sneakers", 12, 12, 1),
    ("pu_radar", 12, 12, 1),
    ("pu_oneup", 12, 12, 1),
    ("pu_cinnabomb", 12, 12, 1),
    ("pu_juice", 12, 12, 1),
    ("pu_pretzel", 12, 12, 1),
];

/// Mall decor and fixtures (side view). Sizes are the sprite canvas; feet / base on the bottom row.
pub const DECOR: &[Entry] = &[
    ("lamp", 16, 24, 2),            // hanging lamp: cord + shade, glow flicker (anchored at the TOP)
    ("disco_ball", 16, 16, 4),      // hanging disco ball (2F), sparkle frames
    ("bench", 24, 12, 1),
    ("plant", 16, 24, 2),           // potted plant, gentle sway
    ("fountain", 32, 24, 3),        // water animation
    ("kiosk", 24, 32, 2),           // directory kiosk, screen glow
    ("photobooth", 24, 32, 2),      // photo booth with curtain
    ("photobooth_open", 24, 32, 1), // curtain open
    ("elev_car", 24, 38, 3),        // elevator car: frame 0 closed doors, 1 half, 2 open
    ("elev_door_frame", 24, 38, 1), // empty shaft opening frame (when car is elsewhere)
    ("elev_grate", 24, 4, 1),       // grate floor where the car is above
    ("esc_step", 8, 4, 2),          // escalator step (2 frames to animate)
    ("wet_sign", 8, 12, 1),         // yellow wet-floor A-frame sign
    ("station_wagon", 56, 24, 2),   // wood-panelled station wagon; frame 1 = brake lights on
    ("pillar", 16, 48, 1),          // parking pillar
    ("anchor_post", 8, 24, 1),      // roof anchor post for the zip line
    ("skyscraper", 64, 112, 2),     // dark skyscraper with lit windows (2 frames flicker)
    ("shutter_slat", 16, 4, 1),     // metal shutter slat (game over + closed stores)
    ("exit_sign", 16, 8, 1),
    ("vending", 16, 24, 1),
    ("trash_can", 8, 12, 1),
];

/// Top-down (Zelda-style) store sprites, 16x16 unless noted. Walk frames: 0 = stand, 1 and 2 = steps.
pub const TOPDOWN: &[Entry] = &[
    ("agent_td_down", 16, 16, 3),
    ("agent_td_up", 16, 16, 3),
    ("agent_td_side", 16, 16, 3),   // faces RIGHT
    ("agent_td_hold", 16, 16, 1),   // both arms overhead (holding a found item; the item is drawn above)
    ("agent_td_stun", 16, 16, 2),
    ("spy_td_down", 16, 16, 3),
    ("spy_td_up", 16, 16, 3),
    ("spy_td_side", 16, 16, 3),
    ("bot_td", 16, 16, 2),          // security bot
    ("windup_toy", 16, 16, 2),      // KGB Toys wind-up toy (marching)
    ("clerk", 16, 16, 2),           // GameStonk old clerk (cave)
    ("demo_tv", 16, 16, 2),         // flickering demo TV
    ("pedestal", 16, 16, 1),        // item pedestal
    ("t_door", 16, 16, 2),          // store door (bottom centre of room), 2 frames
    ("t_fitting", 16, 16, 1),       // Forever 12 fitting room (closed curtain)
    ("t_fitting_open", 16, 16, 1),
    ("t_toyshelf", 16, 16, 1),      // KGB toy shelf
    ("t_toyshelf_open", 16, 16, 1),
    ("t_booth", 16, 16, 2),         // Sam Baddy listening booth
    ("t_vending", 16, 16, 1),
    ("t_exclaim_fixture", 16, 16, 2), // radar marker over a package fixture (flashing "!")
];

/// Top-down themed tiles. For each theme `T` in
/// [fashion, electronics, toys, food, sports, music, gadgets, novelty, games]
/// there are the 10 kinds below, named `t_{T}_{kind}`.
pub const THEMES: [&str; 9] = ["fashion", "electronics", "toys", "food", "sports", "music", "gadgets", "novelty", "games"];
pub const TILE_KINDS: [&str; 10] = [
    "floor",   // walkable floor
    "floor2",  // alternate floor tile (checker / variation)
    "wall",    // solid wall
    "fixa",    // searchable fixture A (closed)
    "fixa_o",  // fixture A, opened / rummaged
    "fixb",    // searchable fixture B (closed)
    "fixb_o",  // fixture B, opened
    "counter", // solid counter (not searchable)
    "decora",  // solid decor A (not searchable)
    "decorb",  // solid decor B (not searchable)
];

pub fn tile_name(theme: &str, kind: &str) -> String {
    format!("t_{theme}_{kind}")
}

/// Everything the manifest requires, as owned entries (tiles expanded).
pub fn all_entries() -> Vec<(String, usize, usize, usize)> {
    let mut v: Vec<(String, usize, usize, usize)> = Vec::new();
    for list in [CHARACTERS, EFFECTS, POWERUPS, DECOR, TOPDOWN] {
        for (n, w, h, f) in list {
            v.push((n.to_string(), *w, *h, *f));
        }
    }
    for t in THEMES {
        for k in TILE_KINDS {
            v.push((tile_name(t, k), 16, 16, 1));
        }
    }
    v
}
