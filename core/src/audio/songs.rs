//! All compositions (original). One function per track; each is a handful of readable pattern strings, played
//! with `Chan::add(pattern, transpose)`. Channel order: pulse 1 (melody), pulse 2 (harmony/comping), triangle
//! (bass), noise (drums). See `score.rs` for the notation. Every song must have equal-length channels.

use super::score::{Chan, Song};
use crate::events::Track;
use crate::types::StoreId;

pub fn song(t: Track) -> Option<Song> {
    Some(match t {
        Track::Silence => return None,
        Track::Splash => splash(),
        Track::Title => title(),
        Track::MallAmbient => mall_ambient(),
        Track::Alarm => alarm(),
        Track::Elevator => elevator(),
        Track::Store(s) => store(s),
        Track::Booth => booth(),
        Track::LevelClear => level_clear(),
        Track::GameOver => game_over(),
        Track::ItemGet => item_get(),
        Track::Continue => continue_song(),
    })
}

pub fn all_tracks() -> Vec<Track> {
    let mut v = vec![
        Track::Silence,
        Track::Splash,
        Track::Title,
        Track::MallAmbient,
        Track::Alarm,
        Track::Elevator,
        Track::Booth,
        Track::LevelClear,
        Track::GameOver,
        Track::ItemGet,
        Track::Continue,
    ];
    v.extend(StoreId::ALL.iter().map(|s| Track::Store(*s)));
    v
}

/// The ten open stores (the other three get the quiet mall bed).
pub const OPEN_STORES: [StoreId; 10] = [
    StoreId::Forever12,
    StoreId::RadioShock,
    StoreId::KgbToys,
    StoreId::HotSpyOnAStick,
    StoreId::FootLockpicker,
    StoreId::SamBaddy,
    StoreId::Crookstone,
    StoreId::SharperImagine,
    StoreId::SpendersGifts,
    StoreId::GameStonk,
];

pub fn store(s: StoreId) -> Song {
    match s {
        StoreId::Forever12 => forever12(),
        StoreId::RadioShock => radioshock(),
        StoreId::KgbToys => kgb_toys(),
        StoreId::HotSpyOnAStick => hot_spy(),
        StoreId::FootLockpicker => foot_lockpicker(),
        StoreId::SamBaddy => sam_baddy(),
        StoreId::Crookstone => crookstone(),
        StoreId::SharperImagine => sharper_imagine(),
        StoreId::SpendersGifts => spenders(),
        StoreId::GameStonk => gamestonk(),
        _ => mall_ambient(), // closed stores: the quiet bed
    }
}

/// Play `pat` once per transposition in `trs`.
fn each(c: &mut Chan, pat: &str, trs: &[i32]) {
    for &t in trs {
        c.add(pat, t);
    }
}

/// Add every pattern in order (transposition 0).
fn seq(c: &mut Chan, pats: &[&str]) {
    for p in pats {
        c.add(p, 0);
    }
}

// ---------------------------------------------------------------------------------------------------------------
// Title: heroic theme in C, 16 bars, 132 bpm (a 4-bar hook, a rising answer, a minor-side bridge, a climb).
fn title() -> Song {
    let mut s = Song::new(132.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@leadv", 0);
    seq(
        p1,
        &[
            // A: the hook
            "o4 g:2 >c:2 e:2 g:6 f:2 e:2",
            "o5 d:6 <b:2 >d:4 g:4",
            "o5 e:2 a:6 g:2 e:2 c:2 e:2",
            "o5 f:4 a:4 g:4 d:4",
            // A': answer, climbs
            "o4 g:2 >c:2 e:2 g:6 a:2 g:2",
            "o5 d:2 g:2 b:6 a:2 g:2 f#:2",
            "o5 c:4 e:4 a:4 >c:4",
            "o5 b:6 g:2 d:8",
            // B: minor side
            "o5 e:6 e:2 a:4 g:2 e:2",
            "o5 c:6 c:2 f:4 e:2 c:2",
            "o5 g:6 g:2 >c:4 <b:2 g:2",
            "o5 d:6 d:2 g:4 f#:2 d:2",
            // B': the climb
            "o5 a:2 >c:2 e:4 d:2 c:2 <b:2 a:2",
            "o5 a:2 >c:2 f:4 e:2 d:2 c:2 <a:2",
            "o5 g:4 >c:4 e:4 g:4",
            "o6 d:4 <b:4 g:4 d:4",
        ],
    );
    let maj = "o4 l2 c e g >c <g e g e";
    let min = "o4 l2 c e- g >c <g e- g e-";
    let maj8 = "o4 l2 c e g e";
    let min8 = "o4 l2 c e- g e-";
    p2.add("@harm25", 0);
    p2.add(maj, 0).add(maj, 7).add(min, 9);
    p2.add(maj8, 5).add(maj8, 7);
    p2.add(maj, 0).add(maj, 7);
    p2.add(min8, 9).add(maj8, 5);
    p2.add(maj, 7);
    p2.add(min, 9).add(maj, 5).add(maj, 0).add(maj, 7);
    p2.add(min, 9).add(maj, 5).add(maj, 0).add(maj, 7);
    t.add("@tri", 0);
    let b16 = "o2 l2 c >c c <c c >c c <c";
    let b8 = "o2 l2 c >c c <c";
    t.add(b16, 0).add(b16, 7).add(b16, 9);
    t.add(b8, 5).add(b8, 7);
    t.add(b16, 0).add(b16, 7);
    t.add(b8, 9).add(b8, 5);
    t.add(b16, 7);
    for r in [9, 5, 0, 7, 9, 5, 0, 7] {
        t.add(b16, r);
    }
    let d = "l2 k h s h k k s h";
    n.add("l2 c h s h k k s h", 0);
    n.rep(d, 0, 7);
    n.add("l2 c h s h k k s h", 0);
    n.rep(d, 0, 6);
    n.add("l2 k h s h t t T T", 0);
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Mall ambient: 14 bars of 4 s = 56 s before it repeats; soft pad chords, slow bass, rare bell plucks. Quiet.
fn mall_ambient() -> Song {
    let mut s = Song::new(60.0, 4, 4, true);
    s.gain = 0.7; // about half the perceived loudness of the other tracks
    let [p1, p2, t, n] = &mut s.ch;
    // (p1 note, p2 note, bass note)
    let bars: [(&str, &str, &str); 14] = [
        ("e", "g", "c"),
        ("e", "a", "a"),
        ("f", "a", "f"),
        ("d", "b", "g"),
        ("e", "c", "c"),
        ("g", "b", "e"),
        ("a", "c", "f"),
        ("a", "d", "d"),
        ("g", "d", "g"),
        ("e", "c", "a"),
        ("f", "c", "f"),
        ("e", "c", "c"),
        ("f", "d", "d"),
        ("d", "b", "g"),
    ];
    // bell bars (the pad voice gives way for a rare pluck on beat 3)
    let bells: [Option<&str>; 14] = [None, None, None, Some("g"), None, None, Some("e"), None, None, None, None, Some("c"), None, Some("a")];
    for (i, (a, b, r)) in bars.iter().enumerate() {
        let a_oct = "o5";
        match bells[i] {
            Some(bell) => {
                p1.add(&format!("@pad {a_oct} {a}:8 @bell o6 {bell}:3 r:5"), 0);
            }
            None if i % 4 == 1 => {
                // enter late for a little movement
                p1.add(&format!("@pad25 {a_oct} r:4 {a}:12"), 0);
            }
            None => {
                p1.add(&format!("@pad {a_oct} {a}:16"), 0);
            }
        }
        p2.add(&format!("@pad25 o4 {b}:16"), 0);
        t.add(&format!("@triamb o2 {r}:16"), 0);
        n.add("r:16", 0);
    }
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Alarm: tense spy groove, 150 bpm, A minor, siren figure alternating e/a, 8 bars.
fn alarm() -> Song {
    let mut s = Song::new(150.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@stac", 0);
    let siren = "o5 l2 e a e a e a e a";
    let siren_fast = "o5 l1 e a e a e a e a e a e a e a e a";
    for (pat, tr) in [(siren, 0), (siren, 0), (siren, -4), (siren, -5), (siren_fast, 0), (siren_fast, 0), (siren, 5), (siren_fast, -5)] {
        p1.add(pat, tr);
    }
    p2.add("@stac125", 0);
    let m = "o4 l2 r:2 a:2^m r:2 a:2^m r:4 a:2^m r:2";
    let maj = "o4 l2 r:2 a:2^M r:2 a:2^M r:4 a:2^M r:2";
    p2.add(m, 0).add(m, 0).add(maj, -4).add(maj, -5);
    p2.add(m, 0).add(m, 0).add(m, 5).add(maj, -5);
    t.add("@tri", 0);
    let b = "o2 l2 a a >a a <a a >e <a";
    for tr in [0, 0, -4, -5, 0, 0, 5, -5] {
        t.add(b, tr);
    }
    n.rep("l2 k m s m k m s m", 0, 7);
    n.add("l2 k m s m t t T s", 0);
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Elevator muzak: F major ii-V-I jazz-lite, 96 bpm, vibes-ish lead, offbeat comping, walking bass, brushes. 12 bars.
fn elevator() -> Song {
    let mut s = Song::new(96.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@leadv", 0);
    seq(
        p1,
        &[
            "o5 a:4 g:2 f:2 e:4 c:4",
            "o5 d:6 f:2 a:4 >c:4",
            "o5 b-:4 a:2 g:2 f:4 d:4",
            "o5 e:6 g:2 b-:4 g:4",
            "o5 a:3 g:1 f:4 g:4 a:4",
            "o5 f:4 d:4 f:4 a:4",
            "o5 g:6 f:2 d:4 f:4",
            "o5 e:4 g:4 b-:4 >c:4",
            "o5 c:6 e:2 g:4 e:4",
            "o5 f#:4 a:4 >c:4 <a:4",
            "o5 b-:6 g:2 d:4 g:4",
            "o5 e:4 f:4 e:4 g:4",
        ],
    );
    p2.add("@stac125", 0);
    for x in ["f^M", "d^m", "g^m", "c^7", "f^M", "d^m", "g^m", "c^7", "a^m", "d^7", "g^m", "c^7"] {
        let x = x.replace('^', ":2^");
        p2.add(&format!("o4 r:6 {x} r:6 {x}"), 0);
    }
    t.add("@tri", 0);
    let maj = "o2 l4 c e g e";
    let min = "o2 l4 c e- g e-";
    for (p, tr) in [(maj, 5), (min, 2), (min, 7), (maj, 0), (maj, 5), (min, 2), (min, 7), (maj, 0), (min, 9), (maj, 2), (min, 7), (maj, 0)] {
        t.add(p, tr);
    }
    n.rep("h:4 q:2 h:2 h:4 q:2 h:2", 0, 12);
    s.gain = 0.85;
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Forever 12: disco strut in A minor (Am7 D7 Gmaj7 Cmaj7 E7), 118 bpm, octave bass, offbeat stabs, open hats.
fn forever12() -> Song {
    let mut s = Song::new(118.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@lead25v", 0);
    seq(
        p1,
        &[
            "o5 e:3 e:1 c:2 e:2 a:4 g:2 e:2",
            "o5 e:3 e:1 c:2 e:2 g:6 r:2",
            "o5 d:3 d:1 a:2 f#:2 d:4 e:2 f#:2",
            "o5 a:3 a:1 f#:2 a:2 >c:6 r:2",
            "o5 b:3 b:1 g:2 b:2 >d:4 c:2 <b:2",
            "o5 b:3 b:1 g:2 b:2 a:6 r:2",
            "o5 e:2 g:2 b:2 >c:2 e:4 d:2 c:2",
            "o5 b:2 >e:2 <g#:2 b:2 >e:6 r:2",
        ],
    );
    p2.add("@stac125", 0);
    for x in ["a^n", "a^n", "d^7", "d^7", "g^M", "g^M", "c^M", "e^7"] {
        let x = x.replace('^', ":2^");
        p2.add(&format!("o4 r:2 {x} r:2 {x} r:2 {x} r:2 {x}"), 0);
    }
    t.add("@tri", 0);
    let oct = "o2 l2 c >c <c >c <c >c <c >c";
    for tr in [9, 9, 2, 2, 7, 7, 0, 4] {
        t.add(oct, tr);
    }
    n.rep("k:2 o:2 x:2 o:2 k:2 o:2 x:2 o:2", 0, 7);
    n.add("k:2 o:2 x:2 o:2 s:2 s:2 t:2 T:2", 0);
    s
}

// ---------------------------------------------------------------------------------------------------------------
// RadioShock: bleepy hardware arpeggios over Am F C G Am F Dm E, 130 bpm.
fn radioshock() -> Song {
    let mut s = Song::new(130.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@arp", 0);
    let maj = "o4 l1 c e g >c";
    let min = "o4 l1 c e- g >c";
    for (m, tr) in [(min, 9), (maj, 5), (maj, 0), (maj, 7), (min, 9), (maj, 5), (min, 2), (maj, 4)] {
        p1.rep(m, tr, 4);
    }
    p2.add("@lead25", 0);
    seq(
        p2,
        &[
            "o5 e:2 a:2 e:2 c:2 e:2 a:2 >c:4",
            "o5 f:2 a:2 f:2 c:2 f:2 a:2 >c:4",
            "o5 g:2 e:2 g:2 >c:2 <g:2 e:2 g:4",
            "o5 g:2 b:2 >d:2 <b:2 g:2 b:2 >d:4",
            "o5 e:2 a:2 e:2 c:2 e:2 a:2 >c:4",
            "o5 f:2 a:2 f:2 c:2 f:2 a:2 >c:4",
            "o5 f:2 a:2 f:2 d:2 f:2 a:2 >d:4",
            "o5 g#:2 b:2 g#:2 e:2 g#:2 b:2 >e:4",
        ],
    );
    t.add("@tristac", 0);
    let b = "o2 l2 c r c r >c r <c r";
    for tr in [9, 5, 0, 7, 9, 5, 2, 4] {
        t.add(b, tr);
    }
    n.rep("k:2 m:2 s:2 m:2 k:2 m:2 s:2 m:2", 0, 7);
    n.add("k:2 m:2 s:2 m:2 k:2 s:2 s:2 s:2", 0);
    s
}

// ---------------------------------------------------------------------------------------------------------------
// KGB Toys: music-box waltz in 3/4 (12 ticks a bar), 132 bpm, A minor; 16 bars.
fn kgb_toys() -> Song {
    let mut s = Song::new(132.0, 4, 3, true);
    s.gain = 1.5;
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@mbox", 0);
    seq(
        p1,
        &[
            "o5 e:4 a:4 >c:4",
            "o5 b:6 a:2 g#:2 a:2",
            "o5 g#:4 b:4 >d:4",
            "o6 c:8 <a:4",
            "o5 f:4 a:4 >d:4",
            "o6 c:6 <b:2 a:4",
            "o5 b:4 g#:4 e:4",
            "o5 a:8 r:4",
            "o5 a:4 >c:4 f:4",
            "o6 e:6 d:2 c:4",
            "o5 b:4 >d:4 f:4",
            "o6 e:8 c:4",
            "o5 f:4 a:4 >d:4",
            "o6 c:4 e:4 a:4",
            "o6 d:6 c:2 <b:2 a:2",
            "o5 g#:4 b:4 >d:4",
        ],
    );
    p2.add("@mbox125", 0);
    for x in ["a^m", "a^m", "e^7", "a^m", "d^m", "a^m", "e^7", "a^m", "f^M", "c^M", "g^7", "c^M", "d^m", "a^m", "d^m", "e^7"] {
        let x = x.replace('^', ":3^");
        p2.add(&format!("o4 r:4 {x} r:1 {x} r:1"), 0);
    }
    t.add("@tristac", 0);
    for tr in [9, 9, 4, 9, 2, 9, 4, 9, 5, 0, 7, 0, 2, 9, 2, 4] {
        t.add("o2 c:4 r:8", tr);
    }
    n.rep("q:2 r:10", 0, 16);
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Hot Spy on a Stick: boardwalk polka (oom-pah), C major, 168 bpm, 16 bars.
fn hot_spy() -> Song {
    let mut s = Song::new(168.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@bright", 0);
    let a = [
        "o5 e:3 e:1 e:2 g:2 >c:4 <g:2 e:2",
        "o5 d:2 e:2 f:2 e:2 d:2 c:2 e:4",
        "o5 g:3 g:1 g:2 b:2 >d:4 <b:2 g:2",
        "o5 f:2 g:2 a:2 g:2 f:2 e:2 d:4",
    ];
    seq(p1, &a);
    seq(p1, &[a[0], a[1], a[2], "o5 e:2 d:2 c:2 d:2 e:2 g:2 c:4"]);
    seq(
        p1,
        &[
            "o5 a:3 a:1 a:2 >c:2 f:4 c:2 <a:2",
            "o5 g:2 a:2 b-:2 a:2 g:2 f:2 a:4",
            "o5 g:3 g:1 g:2 >c:2 e:4 c:2 <g:2",
            "o5 e:2 f:2 g:2 f:2 e:2 d:2 c:4",
            "o5 a:3 a:1 a:2 >d:2 f#:4 d:2 <a:2",
            "o5 b:2 >d:2 g:2 f:2 d:2 <b:2 g:4",
            "o5 e:2 g:2 >c:2 e:2 g:4 e:2 c:2",
            "o5 d:2 f:2 g:2 b:2 >d:4 <b:2 g:2",
        ],
    );
    p2.add("@stac25", 0);
    for x in ["c^M", "c^M", "g^7", "g^7", "c^M", "c^M", "g^7", "c^M", "f^M", "f^M", "c^M", "c^M", "d^7", "g^7", "c^M", "g^7"] {
        let x = x.replace('^', ":4^");
        p2.add(&format!("o4 r:4 {x} r:4 {x}"), 0);
    }
    t.add("@tristac", 0);
    for tr in [0, 0, 7, 7, 0, 0, 7, 0, 5, 5, 0, 0, 2, 7, 0, 7] {
        t.add("o2 l4 c g c g", tr);
    }
    n.rep("k:4 s:4 k:4 s:4", 0, 15);
    n.add("k:4 s:2 s:2 k:2 s:2 s:2 t:2", 0);
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Foot Lockpicker: stadium march, C major, 120 bpm, bugle-call hook, snare cadences, 16 bars.
fn foot_lockpicker() -> Song {
    let mut s = Song::new(120.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@lead", 0);
    seq(
        p1,
        &[
            "o5 g:3 g:1 g:2 e:2 g:6 r:2",
            "o5 e:3 e:1 e:2 c:2 e:6 r:2",
            "o5 a:3 a:1 a:2 f:2 a:6 r:2",
            "o5 g:2 a:2 b:2 >d:4 <b:4 g:2",
            "o5 g:3 g:1 g:2 e:2 >c:6 r:2",
            "o6 c:3 <b:1 a:2 e:2 a:6 r:2",
            "o5 a:3 a:1 a:2 f:2 >c:6 r:2",
            "o5 d:4 g:4 b:4 >d:4",
            "o5 e:2 g:2 >c:4 e:4 d:2 c:2",
            "o5 f:2 a:2 >c:4 f:4 e:2 c:2",
            "o5 g:2 >c:2 e:4 g:4 f:2 e:2",
            "o5 d:2 g:2 b:4 >d:4 <b:2 g:2",
            "o5 a:3 a:1 a:2 >c:2 f:6 r:2",
            "o5 g:3 g:1 g:2 b:2 >d:6 r:2",
            "o5 e:2 g:2 >c:4 e:4 g:4",
            "o6 g:4 e:4 c:4 <g:4",
        ],
    );
    p2.add("@stac", 0);
    for x in ["c^M", "c^M", "f^M", "g^M", "c^M", "a^m", "f^M", "g^M", "c^M", "f^M", "c^M", "g^M", "f^M", "g^M", "c^M", "c^M"] {
        let x = x.replace('^', ":3^");
        p2.add(&format!("o4 {x} r:1 {x} r:1 {x} r:1 {x} r:1"), 0);
    }
    t.add("@tri", 0);
    for tr in [0, 0, 5, 7, 0, 9, 5, 7, 0, 5, 0, 7, 5, 7, 0, 0] {
        t.add("o2 l2 c r g r c r g r", tr);
    }
    let m = "k:2 r:2 s:2 s:2 k:2 r:2 s:2 s:2";
    let fill = "s:2 s:2 s:2 s:2 t:2 t:2 T:2 T:2";
    for bar in 0..16 {
        n.add(if bar == 3 || bar == 7 || bar == 11 || bar == 15 { fill } else { m }, 0);
    }
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Sam Baddy: rock riff in E minor, 150 bpm, chugging power chords, lead riff, 16 bars (the riff twice).
fn sam_baddy() -> Song {
    let mut s = Song::new(150.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    let chug = "o3 e:2^5 e:2^5 r:2 e:2^5 e:2^5 r:2 e:2^5 e:2^5";
    let trs = [0, 0, 3, 5, 0, 0, -4, -2];
    p1.add("@stac", 0);
    for _ in 0..2 {
        each(p1, chug, &trs);
    }
    let riff = [
        "o4 b:3 b:1 >e:2 d:2 <b:4 g:2 a:2",
        "o4 b:3 b:1 >e:2 g:2 f#:4 e:2 d:2",
        "o5 d:3 d:1 g:2 f#:2 d:4 <b:2 g:2",
        "o5 e:3 e:1 a:2 g:2 e:4 d:2 c:2",
        "o4 b:3 b:1 >e:2 d:2 <b:4 a:2 b:2",
        "o4 b:3 b:1 >e:2 g:2 b:4 a:2 g:2",
        "o5 e:3 e:1 g:2 e:2 c:4 d:2 e:2",
        "o5 d:3 d:1 f#:2 a:2 >d:6 r:2",
    ];
    p2.add("@lead25", 0);
    seq(p2, &riff);
    p2.add("@lead", 0);
    for r in riff {
        p2.add(r, 12);
    }
    t.add("@tri", 0);
    for _ in 0..2 {
        each(t, "o2 l2 e e e e e e e e", &trs);
    }
    let d = "k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2";
    for bar in 0..16 {
        n.add(
            match bar {
                7 | 15 => "k:2 h:2 s:2 h:2 s:2 t:2 T:2 c:2",
                0 | 8 => "c:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2",
                _ => d,
            },
            0,
        );
    }
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Crookstone: lounge bossa nova, 132 bpm, ii-V-I in C, flute-ish lead, clave rim, bossa bass; 12 bars.
fn crookstone() -> Song {
    let mut s = Song::new(132.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@lead25v", 0);
    seq(
        p1,
        &[
            "o5 a:6 g:2 f:4 a:4",
            "o5 b:6 a:2 g:4 d:4",
            "o5 e:8 g:4 e:4",
            "o5 c:6 e:2 d:4 c:4",
            "o5 d:2 f:2 a:4 >d:6 <a:2",
            "o5 b:4 a:2 g:2 f:6 r:2",
            "o5 e:4 g:4 b:6 r:2",
            "o5 c#:4 e:4 g:4 a:4",
            "o5 a:6 g:2 f:4 a:4",
            "o5 b:4 >d:4 f:4 e:4",
            "o6 e:4 d:2 c:2 <b:6 r:2",
            "o5 g:4 f:4 e:4 d:4",
        ],
    );
    p2.add("@harm125", 0);
    for x in ["d^n", "g^7", "c^M", "a^n", "d^n", "g^7", "e^n", "a^7", "d^n", "g^7", "c^M", "g^7"] {
        let a = x.replace('^', ":3^");
        let b = x.replace('^', ":2^");
        p2.add(&format!("o4 {a} r:1 {a} r:1 {b} r:2 {b} r:2"), 0);
    }
    t.add("@tri", 0);
    for tr in [2, 7, 0, 9, 2, 7, 4, 9, 2, 7, 0, 7] {
        t.add("o2 c:3 g:3 c:2 c:3 g:3 c:2", tr);
    }
    n.rep("q:3 q:3 q:4 q:2 q:4", 0, 12);
    s.gain = 0.9;
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Sharper Imagine: dreamy synth pads, F major, 84 bpm, held chord shimmer (hardware arpeggio), 12 bars.
fn sharper_imagine() -> Song {
    let mut s = Song::new(84.0, 4, 4, true);
    s.gain = 1.4;
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@pad25", 0);
    seq(
        p1,
        &[
            "o5 a:6 g:2 f:8",
            "o5 e:6 f:2 g:8",
            "o5 d:8 f:4 a:4",
            "o5 g:12 e:4",
            "o5 a:8 >c:8",
            "o6 d:6 c:2 <a:8",
            "o5 b-:8 a:4 f:4",
            "o5 g:6 a:2 g:8",
            "o5 b-:8 >d:8",
            "o6 c:8 <a:8",
            "o5 a:6 f:2 d:8",
            "o5 e:4 g:4 >c:8",
        ],
    );
    p2.add("@pad", 0);
    for x in ["f^M", "a^n", "b-^M", "c^M", "f^M", "d^n", "b-^M", "c^M", "g^n", "a^n", "b-^M", "c^M"] {
        p2.add(&format!("o4 {}", x.replace('^', ":16^")), 0);
    }
    t.add("@triamb", 0);
    for tr in [5, 9, 10, 0, 5, 2, 10, 0, 7, 9, 10, 0] {
        t.add("o2 c:16", tr);
    }
    n.rep("r:8 m:2 r:6", 0, 12);
    s
}

fn trem(note: &str, n: usize) -> String {
    (0..n).map(|_| format!("{note}:1 ")).collect()
}

// ---------------------------------------------------------------------------------------------------------------
// Spender's Gifts: surf groove, A phrygian-dominant flavour, 154 bpm, twangy lead with a tremolo roll, 16 bars.
fn spenders() -> Song {
    let mut s = Song::new(154.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    let lick = [
        "o5 a:2 b-:2 a:2 g#:2 a:2 e:2 a:4",
        "o5 e:2 e:2 e:2 a:2 >c:4 <b:2 a:2",
        "o5 d:2 f:2 a:2 f:2 d:2 f:2 a:4",
        "o5 c:2 b:2 a:2 g#:2 a:8",
        "o5 e:2 g#:2 b:2 >e:2 d:2 <b:2 g#:4",
        "o5 g#:2 b:2 >d:2 <b:2 g#:2 b:2 e:4",
        "o5 f:2 a:2 >d:2 c:2 <a:2 f:2 d:4",
    ];
    p1.add("@lead125", 0);
    seq(p1, &lick);
    p1.add(&format!("o5 e:2 g#:2 a:8 {}", trem("a", 4)), 0);
    p1.add("@lead25v", 0);
    seq(p1, &lick);
    p1.add(&format!("o5 e:2 g#:2 a:2 {}r:6", trem("a", 4)), 0);
    p2.add("@stac25", 0);
    let am = "o4 l2 a^m a^m a^m a^m a^m a^m a^m a^m";
    let e7 = "o4 l2 e^7 e^7 e^7 e^7 e^7 e^7 e^7 e^7";
    for _ in 0..2 {
        p2.add(am, 0).add(am, 0).add(am, 5).add(am, 0).add(e7, 0).add(e7, 0).add(am, 5).add(am, 0);
    }
    t.add("@tri", 0);
    for _ in 0..2 {
        for tr in [0, 0, 5, 0, -5, -5, 5, 0] {
            t.add("o2 l2 a a a a a a a a", tr);
        }
    }
    for bar in 0..16 {
        n.add(
            match bar % 8 {
                3 | 7 => "k:2 h:2 s:2 h:2 T:2 T:2 t:2 t:2",
                _ => "k:2 h:2 s:2 h:2 k:2 k:2 s:2 h:2",
            },
            0,
        );
    }
    s
}

// ---------------------------------------------------------------------------------------------------------------
// GameStonk: hyper game-menu jingle, C major, 168 bpm, bouncy hook over running arps, 16 bars.
fn gamestonk() -> Song {
    let mut s = Song::new(168.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    let hook = [
        "o5 g:2 g:2 >c:4 <g:2 a:2 g:4",
        "o5 g:2 g:2 >d:4 <b:2 a:2 g:4",
        "o5 a:2 a:2 >e:4 c:2 <b:2 a:4",
        "o5 f:2 a:2 >c:4 <a:2 g:2 f:4",
        "o5 g:2 g:2 >c:4 e:4 g:2 e:2",
        "o5 b:2 b:2 >d:4 g:4 f:2 d:2",
        "o5 a:2 a:2 >c:4 f:4 e:2 c:2",
        "o5 d:2 g:2 b:2 >d:2 g:4 r:4",
    ];
    p1.add("@lead25", 0);
    seq(p1, &hook);
    p1.add("@leadv", 0);
    seq(p1, &hook);
    let maj = "o4 l1 c e g >c";
    let min = "o4 l1 c e- g >c";
    p2.add("@arp", 0);
    for _ in 0..2 {
        for (m, tr) in [(maj, 0), (maj, 7), (min, 9), (maj, 5), (maj, 0), (maj, 7), (maj, 5), (maj, 7)] {
            p2.rep(m, tr, 4);
        }
    }
    t.add("@tri", 0);
    for _ in 0..2 {
        for tr in [0, 7, 9, 5, 0, 7, 5, 7] {
            t.add("o2 l2 c >c <c >c <c >c <c >c", tr);
        }
    }
    n.rep("k:2 h:2 s:2 h:2 k:2 h:2 s:1 s:1 h:2", 0, 16);
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Booth "SIDE B": bonus pop track, G major I-V-vi-IV, 112 bpm, 16 bars (verse, chorus, verse, chorus).
fn booth() -> Song {
    let mut s = Song::new(112.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    let verse = [
        "o5 g:2 b:2 >d:4 <b:2 g:2 a:4",
        "o5 f#:2 a:2 >d:4 <a:2 f#:2 a:4",
        "o5 g:2 b:2 >e:4 d:2 <b:2 g:4",
        "o5 e:2 g:2 >c:4 <b:2 a:2 g:4",
    ];
    let chorus = [
        "o5 b:4 >d:4 g:4 d:4",
        "o6 f#:4 d:4 <a:4 f#:4",
        "o5 g:4 b:4 >e:4 <b:4",
        "o5 e:4 g:4 >c:4 e:4",
    ];
    p1.add("@lead25v", 0);
    seq(p1, &verse);
    seq(p1, &chorus);
    p1.add("@leadv", 0);
    seq(p1, &verse);
    seq(p1, &chorus);
    p2.add("@harm", 0);
    for _ in 0..4 {
        for x in ["g^M", "d^M", "e^m", "c^M"] {
            let x = x.replace('^', ":2^");
            p2.add(&format!("o4 r:2 {x} r:2 {x} r:2 {x} r:2 {x}"), 0);
        }
    }
    t.add("@tri", 0);
    for _ in 0..4 {
        for tr in [7, 2, 4, 0] {
            t.add("o2 l2 c c r c c r c r", tr);
        }
    }
    for bar in 0..16 {
        n.add(if bar % 4 == 3 { "k:2 h:2 s:2 h:2 h:2 k:2 s:2 s:2" } else { "k:2 h:2 s:2 h:2 h:2 k:2 s:2 h:2" }, 0);
    }
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Continue: tense looping countdown pulse, 120 bpm, 4 bars (8 s).
fn continue_song() -> Song {
    let mut s = Song::new(120.0, 4, 4, true);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@stac", 0);
    p1.rep("o5 e:2 r:2 e:2 r:2 e:2 r:2 f:2 r:2", 0, 4);
    p2.add("@pad", 0);
    p2.add("o4 b:16", 0).add("o4 b-:16", 0).add("o4 b:16", 0).add("o4 b-:16", 0);
    t.add("@tri", 0);
    t.rep("o2 e:2 e:2 r:4 e:2 e:2 r:4", 0, 4);
    n.rep("m:4 m:4 m:4 m:4", 0, 4);
    s
}

// ---------------------------------------------------------------------------------------------------------------
// Jingles (play once). Splash: rising rainbow arpeggio resolving on a held C chord, 2.0 s.
fn splash() -> Song {
    let mut s = Song::new(150.0, 4, 4, false);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@bright", 0).add("o4 l1 c e g >c e g >c e g", 0).add("o6 c:11", 0);
    p2.add("@pluck", 0).add("r:1", 0).add("o4 l1 c e g >c e g >c e g", 0).add("@harm", 0).add("o5 g:10", 0);
    t.add("@trilong", 0).add("o3 c:20", 0);
    n.add("r:9 c:11", 0);
    s
}

// Level clear: triumphant C-major fanfare, 4 bars at 160 bpm = 6.0 s.
fn level_clear() -> Song {
    let mut s = Song::new(160.0, 4, 4, false);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@lead", 0);
    seq(p1, &["o5 g:2 g:2 g:2 >c:10", "o5 a:2 a:2 a:2 >f:10", "o5 b:2 b:2 b:2 >d:10", "o6 e:2 g:2 >c:12"]);
    p2.add("@harm25", 0);
    seq(p2, &["o5 e:2 e:2 e:2 g:10", "o5 c:2 c:2 c:2 a:10", "o5 d:2 d:2 d:2 b:10", "o5 g:2 >c:2 e:12"]);
    t.add("@tri", 0);
    for tr in [0, 5, 7, 0] {
        t.add("o2 l2 c r c r c c c c", tr);
    }
    n.add("k:2 r:2 s:2 r:2 k:2 r:2 s:2 s:2", 0).add("k:2 r:2 s:2 r:2 k:2 r:2 s:2 s:2", 0).add("k:2 r:2 s:2 r:2 k:2 r:2 s:2 s:2", 0);
    n.add("c:4 r:12", 0);
    s
}

// Game over: sad descending line in C minor, 2 bars of 3 beats at 90 bpm = 4.0 s.
fn game_over() -> Song {
    let mut s = Song::new(90.0, 4, 3, false);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@leadv", 0).add("o5 g:3 f:1 e-:4 d:4", 0).add("o5 e-:4 d:4 c:4", 0);
    p2.add("@harm25", 0).add("o5 e-:3 d:1 c:4 <b:4", 0).add("o5 c:4 <b:4 g:4", 0);
    t.add("@trilong", 0).add("o2 c:12", 0).add("o2 g:4 g:4 c:4", 0);
    n.add("r:12", 0).add("r:8 T:4", 0);
    s
}

// Item get: ascending major run and a held chord, 2.0 s at 120 bpm.
fn item_get() -> Song {
    let mut s = Song::new(120.0, 4, 4, false);
    let [p1, p2, t, n] = &mut s.ch;
    p1.add("@bright", 0).add("o4 e:2 g:2 >c:2 e:2 g:2 >c:6", 0);
    p2.add("@pluck", 0).add("o4 c:2 e:2 g:2 >c:2 e:2 g:6", 0);
    t.add("@trilong", 0).add("o3 c:8 g:8", 0);
    n.add("r:10 m:2 m:2 m:2", 0);
    s
}
