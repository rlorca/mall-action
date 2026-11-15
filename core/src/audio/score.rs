//! Score format: songs are DATA. Each channel is a list of `Ev` (note/rest + length in ticks), produced from a tiny
//! MML-like text notation by `Chan::add`, so a song is a handful of readable pattern strings plus transpositions.
//!
//! Notation (whitespace separated tokens):
//! * `c d e f g a b`, with `#` sharp / `-` flat suffix: a note, e.g. `f#`, `b-`.
//! * `:N` after a note/rest/drum: length in ticks (otherwise the default length, set by `lN`).
//! * `^M ^m ^7 ^n ^5 ^4` after a note: hardware-style arpeggio (major, minor, dom7, minor7, power, sus4) at 60 Hz.
//! * `r` rest. `oN` octave (c4 = middle C = MIDI 60). `>` / `<` shift the octave up / down (also as a prefix).
//! * `lN` default length in ticks. `@name` pick an instrument from `INSTS`. `|` is ignored (bar lines).
//! * Noise channel (drum mode): `k` kick, `s` snare, `h` hat, `o` open hat, `t`/`T` toms, `c` crash, `x` clap,
//!   `m` metallic tick, `q` rim, `r` rest.
//! Every `add` starts at octave 4, default length 4 ticks; the instrument persists across `add`s.

#[derive(Clone, Copy, Debug)]
pub struct Inst {
    /// Pulse duty index 0..=3 = 12.5 / 25 / 50 / 75 %.
    pub duty: u8,
    /// Peak level 0..1 (hardware has 16 volume steps).
    pub vol: f32,
    /// Seconds.
    pub attack: f32,
    pub decay: f32,
    pub sustain: f32,
    /// Fraction of the note length that the key is held, the rest is release.
    pub gate: f32,
    pub release: f32,
    pub vib_cents: f32,
    pub vib_delay: f32,
    pub vib_hz: f32,
    /// Pitch slide in semitones reached after `slide_time` seconds from note start.
    pub slide: f32,
    pub slide_time: f32,
}

const BASE: Inst = Inst {
    duty: 2,
    vol: 1.0,
    attack: 0.002,
    decay: 0.3,
    sustain: 0.75,
    gate: 0.92,
    release: 0.03,
    vib_cents: 0.0,
    vib_delay: 0.0,
    vib_hz: 5.5,
    slide: 0.0,
    slide_time: 0.0,
};

/// Instrument library (name, definition). `@name` in a pattern selects one.
pub static INSTS: &[(&str, Inst)] = &[
    ("lead", BASE),
    ("leadv", Inst { vib_cents: 22.0, vib_delay: 0.12, ..BASE }),
    ("lead25", Inst { duty: 1, ..BASE }),
    ("lead25v", Inst { duty: 1, vib_cents: 22.0, vib_delay: 0.12, ..BASE }),
    ("lead125", Inst { duty: 0, ..BASE }),
    ("bright", Inst { duty: 1, decay: 0.15, sustain: 0.6, ..BASE }),
    ("stac", Inst { decay: 0.09, sustain: 0.2, gate: 0.6, release: 0.02, ..BASE }),
    ("stac25", Inst { duty: 1, decay: 0.09, sustain: 0.2, gate: 0.6, release: 0.02, ..BASE }),
    ("stac125", Inst { duty: 0, decay: 0.09, sustain: 0.2, gate: 0.6, release: 0.02, ..BASE }),
    ("pluck", Inst { duty: 1, decay: 0.18, sustain: 0.05, gate: 1.0, release: 0.02, ..BASE }),
    ("harm", Inst { vol: 0.6, sustain: 0.7, ..BASE }),
    ("harm25", Inst { duty: 1, vol: 0.6, sustain: 0.7, ..BASE }),
    ("harm125", Inst { duty: 0, vol: 0.6, sustain: 0.7, ..BASE }),
    ("pad", Inst { duty: 0, vol: 0.55, attack: 0.15, decay: 0.5, sustain: 0.85, gate: 1.0, release: 0.25, vib_cents: 10.0, vib_delay: 0.4, vib_hz: 4.0, ..BASE }),
    ("pad25", Inst { duty: 1, vol: 0.5, attack: 0.2, decay: 0.5, sustain: 0.85, gate: 1.0, release: 0.3, vib_cents: 9.0, vib_delay: 0.5, vib_hz: 3.6, ..BASE }),
    ("bell", Inst { vol: 0.7, attack: 0.001, decay: 0.9, sustain: 0.0, gate: 1.0, release: 0.3, ..BASE }),
    ("glock", Inst { duty: 3, vol: 0.55, attack: 0.001, decay: 0.5, sustain: 0.0, gate: 1.0, release: 0.2, ..BASE }),
    ("mbox", Inst { vol: 0.6, attack: 0.001, decay: 0.35, sustain: 0.0, gate: 1.0, release: 0.1, ..BASE }),
    ("mbox125", Inst { duty: 0, vol: 0.5, attack: 0.001, decay: 0.3, sustain: 0.0, gate: 1.0, release: 0.1, ..BASE }),
    ("arp", Inst { duty: 1, vol: 0.6, decay: 0.05, sustain: 0.5, gate: 0.8, ..BASE }),
    ("pbass", Inst { duty: 1, vol: 0.8, decay: 0.2, sustain: 0.8, gate: 0.85, ..BASE }),
    ("scoop", Inst { slide: -2.0, slide_time: 0.06, ..BASE }),
    ("dive", Inst { duty: 1, slide: -12.0, slide_time: 0.5, decay: 0.5, sustain: 0.6, gate: 1.0, ..BASE }),
    // triangle instruments (only gate/release/attack/vol matter)
    ("tri", Inst { gate: 0.9, release: 0.01, ..BASE }),
    ("trilong", Inst { gate: 1.0, release: 0.01, ..BASE }),
    ("tristac", Inst { gate: 0.5, release: 0.01, ..BASE }),
    ("triamb", Inst { vol: 0.8, attack: 0.05, gate: 0.97, release: 0.3, ..BASE }),
];

pub fn inst_index(name: &str) -> u8 {
    INSTS.iter().position(|(n, _)| *n == name).unwrap_or_else(|| panic!("unknown instrument @{name}")) as u8
}

/// One note, rest (`pitch < 0`) or drum hit.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Ev {
    pub pitch: i16,
    pub dur: u16,
    pub inst: u8,
    pub arp: u8,
}

pub const ARP_TABLE: [[i8; 3]; 7] = [[0, 0, 0], [0, 4, 7], [0, 3, 7], [0, 4, 10], [0, 3, 10], [0, 7, 12], [0, 5, 7]];

#[derive(Clone, Debug)]
pub struct Chan {
    pub evs: Vec<Ev>,
    drum: bool,
    inst: u8,
}

impl Chan {
    pub fn new(drum: bool) -> Chan {
        Chan { evs: Vec::new(), drum, inst: 0 }
    }
    /// Append a pattern, transposed by `tr` semitones.
    pub fn add(&mut self, src: &str, tr: i32) -> &mut Chan {
        let mut oct: i32 = 4;
        let mut len: u16 = 4;
        for tok in src.split_whitespace() {
            let mut t = tok;
            while let Some(rest) = t.strip_prefix('>') {
                oct += 1;
                t = rest;
            }
            while let Some(rest) = t.strip_prefix('<') {
                oct -= 1;
                t = rest;
            }
            if t.is_empty() || t == "|" {
                continue;
            }
            if let Some(n) = t.strip_prefix('@') {
                self.inst = inst_index(n);
                continue;
            }
            let first = t.as_bytes()[0];
            if first == b'o' && t.len() > 1 && t.as_bytes()[1].is_ascii_digit() {
                oct = t[1..].parse().expect("octave");
                continue;
            }
            if first == b'l' && t.len() > 1 && t.as_bytes()[1].is_ascii_digit() {
                len = t[1..].parse().expect("length");
                continue;
            }
            // note / rest / drum with optional :dur and ^arp
            let (head, arp) = match t.find('^') {
                Some(i) => {
                    let a = match &t[i + 1..] {
                        "M" => 1,
                        "m" => 2,
                        "7" => 3,
                        "n" => 4,
                        "5" => 5,
                        "4" => 6,
                        x => panic!("bad arp {x}"),
                    };
                    (&t[..i], a)
                }
                None => (t, 0u8),
            };
            let (name, dur) = match head.find(':') {
                Some(i) => (&head[..i], head[i + 1..].parse::<u16>().unwrap_or_else(|_| panic!("bad duration in {tok}"))),
                None => (head, len),
            };
            assert!(dur > 0, "zero duration in {tok}");
            let nb = name.as_bytes();
            let pitch: i16 = if name == "r" {
                -1
            } else if self.drum {
                assert!(matches!(nb[0], b'k' | b's' | b'h' | b'o' | b't' | b'T' | b'c' | b'x' | b'm' | b'q'), "bad drum {tok}");
                nb[0] as i16
            } else {
                let base = match nb[0] {
                    b'c' => 0,
                    b'd' => 2,
                    b'e' => 4,
                    b'f' => 5,
                    b'g' => 7,
                    b'a' => 9,
                    b'b' => 11,
                    _ => panic!("bad token {tok}"),
                };
                let acc = match nb.get(1) {
                    Some(b'#') => 1,
                    Some(b'-') => -1,
                    _ => 0,
                };
                (12 * (oct + 1) + base + acc + tr) as i16
            };
            self.evs.push(Ev { pitch, dur, inst: self.inst, arp });
        }
        self
    }
    /// Append a pattern `n` times.
    pub fn rep(&mut self, src: &str, tr: i32, n: usize) -> &mut Chan {
        for _ in 0..n {
            self.add(src, tr);
        }
        self
    }
    pub fn ticks(&self) -> u32 {
        self.evs.iter().map(|e| e.dur as u32).sum()
    }
}

/// A song: 4 channels (pulse 1, pulse 2, triangle, noise), tempo and loop flag.
#[derive(Clone, Debug)]
pub struct Song {
    pub bpm: f32,
    /// Ticks per beat (4 = a tick is a sixteenth note; 3 for waltz-style eighth-triplet grids etc.).
    pub tpb: u32,
    pub beats_per_bar: u32,
    pub looping: bool,
    /// Loudness trim for the whole song (the mall bed is much quieter than the rest).
    pub gain: f32,
    pub ch: [Chan; 4],
}

impl Song {
    pub fn new(bpm: f32, tpb: u32, beats_per_bar: u32, looping: bool) -> Song {
        Song { bpm, tpb, beats_per_bar, looping, gain: 1.0, ch: [Chan::new(false), Chan::new(false), Chan::new(false), Chan::new(true)] }
    }
    pub fn bar_ticks(&self) -> u32 {
        self.tpb * self.beats_per_bar
    }
    /// Song length in ticks (longest channel).
    pub fn len(&self) -> u32 {
        self.ch.iter().map(|c| c.ticks()).max().unwrap_or(0)
    }
    pub fn tick_seconds(&self) -> f32 {
        60.0 / (self.bpm * self.tpb as f32)
    }
    pub fn seconds(&self) -> f32 {
        self.len() as f32 * self.tick_seconds()
    }
    /// True when every channel has the same length (and, for looping songs, a whole number of bars) so loops line up.
    pub fn consistent(&self) -> bool {
        let l = self.len();
        l > 0 && (!self.looping || l % self.bar_ticks() == 0) && self.ch.iter().all(|c| c.ticks() == l)
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Drum {
    pub f0: f32,
    pub f1: f32,
    pub vol: f32,
    pub decay: f32,
    pub short: bool,
}

pub fn drum(c: u8) -> Drum {
    let d = |f0, f1, vol, decay, short| Drum { f0, f1, vol, decay, short };
    match c {
        b'k' => d(1800.0, 140.0, 1.0, 0.11, false),
        b's' => d(9000.0, 4500.0, 0.85, 0.13, false),
        b'h' => d(40000.0, 40000.0, 0.45, 0.03, true),
        b'o' => d(40000.0, 30000.0, 0.45, 0.16, true),
        b't' => d(2600.0, 900.0, 0.8, 0.12, false),
        b'T' => d(1400.0, 450.0, 0.85, 0.15, false),
        b'c' => d(30000.0, 20000.0, 0.7, 0.5, false),
        b'x' => d(12000.0, 9000.0, 0.7, 0.08, false),
        b'm' => d(8000.0, 8000.0, 0.5, 0.05, true),
        _ => d(6000.0, 6000.0, 0.6, 0.03, true), // q rim
    }
}
