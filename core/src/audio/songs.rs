//! All songs: original compositions written as readable step-sequencer data.
//!
//! Pattern mini-notation (one token per step; `|` is a visual bar line and is ignored):
//! * `c4`, `f#5`, `bb3` = a note (name, optional `#`/`b`, octave). `a3+c4+e4` = chord.
//! * `.` = rest, `-` = hold the previous note one more step.
//! * Drum tracks use `k` kick, `s` snare, `h` hat, `o` open hat, `t` tom, `c` crash (combine with `+`).
//! A pattern shorter than the song is tiled (repeated) to fill it.
use super::synth::{midi_hz, sec, Inst, Mix, Voice};
use super::{Song, SAMPLE_RATE};
use crate::stores::StoreId;

#[derive(Clone, Copy, PartialEq)]
enum Kind {
    Notes,
    Drums,
}

struct Track {
    voice: Voice,
    kind: Kind,
    gain: f32,
    pat: String,
}

struct Spec {
    bpm: f32,
    /// Steps per beat.
    spb: usize,
    /// Beats per bar.
    bpb: usize,
    bars: usize,
    /// Peak level 0..1 (relative loudness of the song).
    level: f32,
    looping: bool,
    /// Extra ring-out seconds for one-shots.
    tail: f32,
    tracks: Vec<Track>,
}

impl Spec {
    fn steps(&self) -> usize {
        self.bars * self.bpb * self.spb
    }
    /// Samples in the musical body (a whole number of bars; the loop length).
    fn body_samples(&self) -> usize {
        let per_bar = self.bpb as f64 * 60.0 / self.bpm as f64;
        (per_bar * self.bars as f64 * SAMPLE_RATE as f64).round() as usize
    }
}

// ---------- pattern helpers ----------

/// Instantiate a pattern per bar: single capital letters A.. pick the i-th word of that bar's spec.
fn fill(pat: &str, bars: &[&str]) -> String {
    let mut out = Vec::new();
    for b in bars {
        let items: Vec<&str> = b.split_whitespace().collect();
        let mut bar = Vec::new();
        for tok in pat.split_whitespace() {
            let s = tok
                .split('+')
                .map(|part| {
                    let c = part.as_bytes()[0];
                    if part.len() == 1 && c.is_ascii_uppercase() {
                        items[(c - b'A') as usize].to_string()
                    } else {
                        part.to_string()
                    }
                })
                .collect::<Vec<_>>()
                .join("+");
            bar.push(s);
        }
        out.push(bar.join(" "));
    }
    out.join(" | ")
}

/// Held notes: `("c4+e4", 8)` = chord held 8 steps.
fn held(items: &[(&str, usize)]) -> String {
    let mut v = Vec::new();
    for (tok, n) in items {
        v.push(tok.to_string());
        for _ in 1..*n {
            v.push("-".to_string());
        }
    }
    v.join(" ")
}

/// A `n`-step pattern of rests with notes at the given step positions.
fn sparse(n: usize, items: &[(usize, &str)]) -> String {
    (0..n)
        .map(|i| items.iter().find(|(p, _)| *p == i).map(|(_, t)| t.to_string()).unwrap_or_else(|| ".".into()))
        .collect::<Vec<_>>()
        .join(" ")
}

fn nt(voice: Voice, gain: f32, pat: impl Into<String>) -> Track {
    Track { voice, kind: Kind::Notes, gain, pat: pat.into() }
}
fn dr(gain: f32, pat: &str) -> Track {
    Track { voice: Voice::new(Inst::Noise(true), 1.0, 0.0, 0.0, 0.0, 0.0), kind: Kind::Drums, gain, pat: pat.into() }
}

// ---------- voices ----------
const fn pulse(d: f32, vol: f32, a: f32, dec: f32, s: f32, r: f32) -> Voice {
    Voice::new(Inst::Pulse(d), vol, a, dec, s, r)
}
const LEAD: Voice = pulse(0.5, 0.5, 0.005, 0.12, 0.7, 0.06);
const BASS: Voice = Voice::new(Inst::Tri, 0.8, 0.004, 0.0, 1.0, 0.04).gate(0.85);
const PAD: Voice = pulse(0.125, 0.3, 0.3, 0.0, 1.0, 0.5);
const STAB: Voice = pulse(0.25, 0.3, 0.002, 0.12, 0.0, 0.03);

// ---------- note parsing ----------

fn parse_note(s: &str) -> Option<f32> {
    let b = s.as_bytes();
    let base = match b.first()?.to_ascii_lowercase() {
        b'c' => 0,
        b'd' => 2,
        b'e' => 4,
        b'f' => 5,
        b'g' => 7,
        b'a' => 9,
        b'b' => 11,
        _ => return None,
    };
    let mut semi = base as i32;
    let mut i = 1;
    while i < b.len() && (b[i] == b'#' || b[i] == b'b') {
        semi += if b[i] == b'#' { 1 } else { -1 };
        i += 1;
    }
    let oct: i32 = s.get(i..)?.parse().ok()?;
    Some((12 * (oct + 1) + semi) as f32)
}

struct Ev {
    step: usize,
    len: usize,
    toks: Vec<String>,
}

fn parse_pattern(pat: &str) -> (Vec<Ev>, usize) {
    let mut evs: Vec<Ev> = Vec::new();
    let mut n = 0;
    for tok in pat.split_whitespace() {
        if tok == "|" {
            continue;
        }
        match tok {
            "." => {}
            "-" => {
                if let Some(last) = evs.last_mut() {
                    if last.step + last.len == n {
                        last.len += 1;
                    }
                }
            }
            _ => evs.push(Ev { step: n, len: 1, toks: tok.split('+').map(String::from).collect() }),
        }
        n += 1;
    }
    (evs, n)
}

fn render_spec(sp: &Spec) -> Vec<i16> {
    let body = sp.body_samples();
    let tail = if sp.looping { 0 } else { sec(sp.tail) };
    let mut mix = Mix::new(body + tail, sp.looping);
    let steps = sp.steps();
    let at = |s: usize| -> usize { (s as u64 * body as u64 / steps as u64) as usize };
    for tr in &sp.tracks {
        let (evs, n) = parse_pattern(&tr.pat);
        if n == 0 {
            continue;
        }
        let reps = (steps + n - 1) / n;
        for r in 0..reps {
            for ev in &evs {
                let s = ev.step + r * n;
                if s >= steps {
                    continue;
                }
                let start = at(s);
                let end = if s + ev.len > steps { body + at(s + ev.len - steps) } else { at(s + ev.len) };
                let end = end.max(start + 1);
                let dur = (((end - start) as f32) * tr.voice.gate) as usize;
                for t in &ev.toks {
                    match tr.kind {
                        Kind::Drums => mix.drum(start, t.chars().next().unwrap(), tr.gain),
                        Kind::Notes => {
                            if let Some(m) = parse_note(t) {
                                let hz = midi_hz(m);
                                mix.tone(start, dur.max(8), &tr.voice, hz, hz, tr.gain);
                            }
                        }
                    }
                }
            }
        }
    }
    mix.finish(sp.level, true)
}

fn spec(song: Song) -> Spec {
    use StoreId::*;
    match song {
        Song::Title => title(),
        Song::Mall => mall(),
        Song::Alarm => alarm(),
        Song::Elevator => elevator(),
        Song::ListeningBooth => booth(),
        Song::Tally => tally(),
        Song::FlickerJingle => flicker(),
        Song::LevelClear => level_clear(),
        Song::GameOver => game_over(),
        Song::ItemGet => item_get(),
        Song::Store(id) => match id {
            Forever12 => forever12(),
            RadioShock => radioshock(),
            KgbToys => kgb(),
            HotSpyOnAStick => hotspy(),
            FootLockpicker => footlock(),
            SamBaddy => sambaddy(),
            Crookstone => crookstone(),
            SharperImagine => sharper(),
            SpendersGifts => spenders(),
            GameStonk => gamestonk(),
            // Closed stores are never entered; give them the quiet mall bed.
            _ => mall(),
        },
    }
}

pub fn song_loops(s: Song) -> bool {
    !matches!(s, Song::FlickerJingle | Song::LevelClear | Song::GameOver | Song::ItemGet)
}

pub fn render_song(s: Song) -> Vec<i16> {
    render_spec(&spec(s))
}

// ================= compositions =================

fn title() -> Spec {
    // A minor, heroic: i - VI - III - VII, twice, with a dominant lift before the final tonic.
    let lead = "e5 - e5 d5 c5 - a4 . | c5 - c5 b4 a4 - f4 . | e5 - g5 - e5 - c5 . | d5 - d5 e5 d5 - b4 - | \
                e5 - e5 d5 c5 - a4 c5 | a5 - g5 f5 e5 - c5 - | d5 - e5 - g#5 - e5 . | a5 - - - - - - .";
    let bass = fill(
        "A B A B A B A B",
        &["a2 a3", "f2 f3", "c3 c4", "g2 g3", "a2 a3", "f2 f3", "e2 e3", "a2 a3"],
    );
    // The last bar of the arp is a held tonic.
    let arp = format!(
        "{} | a3 - - - - - - .",
        fill(
            "A B C B A B C B",
            &["a3 c4 e4", "f3 a3 c4", "c4 e4 g4", "g3 b3 d4", "a3 c4 e4", "f3 a3 c4", "e3 g#3 b3"],
        )
    );
    Spec {
        bpm: 132.0,
        spb: 2,
        bpb: 4,
        bars: 8,
        level: 1.0,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(LEAD.vib(5.5, 0.25, 0.15), 1.0, lead),
            nt(BASS, 0.9, bass),
            nt(pulse(0.125, 0.4, 0.003, 0.1, 0.5, 0.03).gate(0.8), 0.7, arp),
            dr(0.8, "k h s h k k s h"),
        ],
    }
}

fn mall() -> Spec {
    let pad = held(&[
        ("c4+e4+g4+b4", 8),
        ("a3+c4+e4+g4", 8),
        ("f3+a3+c4+e4", 8),
        ("g3+b3+d4+e4", 8),
        ("e3+g3+b3+d4", 8),
        ("f3+a3+c4+g4", 8),
    ]);
    let bass = held(&[("c2", 8), ("a2", 8), ("f2", 8), ("g2", 8), ("e2", 8), ("f2", 8)]);
    let bell = sparse(48, &[(6, "e6"), (27, "g6"), (40, "d6")]);
    Spec {
        bpm: 60.0,
        spb: 2,
        bpb: 4,
        bars: 6,
        level: 0.4,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pad_voice(), 0.7, pad),
            nt(Voice::new(Inst::Tri, 0.8, 0.5, 0.0, 1.0, 0.8), 0.8, bass),
            nt(pulse(0.5, 0.35, 0.002, 1.2, 0.0, 0.3).gate(0.9), 0.5, bell),
        ],
    }
}

fn pad_voice() -> Voice {
    PAD.vib(4.0, 0.12, 0.6)
}

fn alarm() -> Spec {
    let bass = fill(
        "A A B A A A B A",
        &["d2 d3", "d2 d3", "bb1 bb2", "a1 a2", "d2 d3", "d2 d3", "g1 g2", "a1 a2"],
    );
    let siren = held(&[("d5", 16), ("f5", 16), ("d5", 16), ("e5", 16)]);
    Spec {
        bpm: 150.0,
        spb: 2,
        bpb: 4,
        bars: 8,
        level: 0.95,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(BASS, 1.0, bass),
            nt(pulse(0.5, 0.4, 0.05, 0.0, 1.0, 0.1).vib(1.1, 4.0, 0.0).gate(0.98), 0.8, siren),
            nt(STAB.gate(0.5), 0.8, "d4+a4 . . d4+a4 . . d4+a4 ."),
            dr(0.9, "k h s h k k s h"),
            nt(pulse(0.125, 0.25, 0.002, 0.08, 0.0, 0.02), 0.5, sparse(32, &[(0, "d6"), (6, "d6"), (12, "d6"), (20, "d6")])),
        ],
    }
}

fn elevator() -> Spec {
    let lead = "e5 - e5 d5 c5 - g4 - | c5 - c5 b4 a4 - e4 . | d5 - f5 - d5 - a4 . | b4 - d5 - f5 - d5 . | \
                e5 - e5 d5 c5 - g4 - | a4 - c5 - e5 - c5 . | d5 - e5 - f5 - a5 . | g5 - - - e5 - - .";
    let bass = fill(
        "A . B . A . B .",
        &["c3 g3", "a2 e3", "d3 a3", "g2 d3", "c3 g3", "f2 c3", "d3 a3", "g2 d3"],
    )
    .rsplit_once('|')
    .map(|(a, _)| format!("{a}| g2 . d3 . c3 - - -"))
    .unwrap();
    let comp = fill(
        ". A . A . A . A",
        &[
            "e4+g4+b4", "e4+g4+c5", "f4+a4+c5", "f4+g4+b4", "e4+g4+b4", "e4+a4+c5", "f4+a4+c5", "f4+g4+b4",
        ],
    );
    Spec {
        bpm: 96.0,
        spb: 2,
        bpb: 4,
        bars: 8,
        level: 0.55,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.5, 0.35, 0.03, 0.1, 0.8, 0.15).vib(4.5, 0.2, 0.3).gate(0.9), 1.0, lead),
            nt(BASS, 0.7, bass),
            nt(pulse(0.125, 0.3, 0.01, 0.1, 0.4, 0.1).gate(0.5), 0.6, comp),
            dr(0.25, "h . h . h . h ."),
        ],
    }
}

fn forever12() -> Spec {
    let lead = "a4 . c5 . e5 - d5 c5 | a4 . c5 e5 - . d5 c5 | c5 . a4 . f4 - a4 c5 | d5 . b4 . g4 - b4 d5 | \
                a4 . c5 . e5 - g5 e5 | d5 - c5 - a4 - e4 - | c5 . c5 a4 f4 - a4 - | b4 - g#4 - e4 - . .";
    let bass = fill(
        "A B A B A B A B",
        &["a2 a3", "a2 a3", "f2 f3", "g2 g3", "a2 a3", "a2 a3", "f2 f3", "e2 e3"],
    );
    let stab = fill(
        ". A . A . A . A",
        &[
            "a3+c4+e4", "a3+c4+e4", "a3+c4+f4", "b3+d4+g4", "a3+c4+e4", "a3+c4+e4", "a3+c4+f4", "g#3+b3+e4",
        ],
    );
    Spec {
        bpm: 118.0,
        spb: 2,
        bpb: 4,
        bars: 8,
        level: 0.95,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.25, 0.45, 0.004, 0.1, 0.7, 0.05).vib(6.0, 0.2, 0.1).gate(0.85), 1.0, lead),
            nt(BASS.gate(0.7), 0.9, bass),
            nt(pulse(0.125, 0.25, 0.002, 0.1, 0.2, 0.03).gate(0.5), 0.7, stab),
            dr(0.8, "k o k+s o k o k+s o"),
        ],
    }
}

fn radioshock() -> Spec {
    let chords = [
        "e4 g4 b4 e5",
        "c4 e4 g4 c5",
        "d4 f#4 a4 d5",
        "b3 d#4 f#4 b4",
        "e4 g4 b4 e5",
        "c4 e4 g4 c5",
        "a3 c4 e4 a4",
        "b3 d#4 f#4 b4",
    ];
    let arp = fill("A B C D D C B A A B C D D C B A", &chords);
    let bass = fill(
        "A . A . B . A . A . A . B . A .",
        &["e2 e3", "c2 c3", "d2 d3", "b1 b2", "e2 e3", "c2 c3", "a1 a2", "b1 b2"],
    );
    Spec {
        bpm: 138.0,
        spb: 4,
        bpb: 4,
        bars: 8,
        level: 0.9,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.125, 0.4, 0.002, 0.05, 0.6, 0.02).gate(0.6), 1.0, arp),
            nt(pulse(0.5, 0.3, 0.002, 0.06, 0.2, 0.02).gate(0.4), 0.8, "e6 . . e6 . . g6 . b6 . . . g6 . . ."),
            nt(BASS.gate(0.6), 0.9, bass),
            dr(0.7, "k . . . s . . . k . k . s . h h"),
        ],
    }
}

fn kgb() -> Spec {
    // Music-box waltz in 3/4 (6 eighth-steps per bar).
    let melody = "e5 . a5 . c6 . | b5 . g#5 . e5 . | a5 . c6 . e6 . | d6 . b5 . a5 -";
    let bass = fill("A . . . . .", &["a2", "e2", "a2", "e2"]);
    let pah = fill(
        ". . A . A .",
        &["a3+c4+e4", "e3+g#3+b3", "a3+c4+e4", "e3+g#3+b3"],
    );
    Spec {
        bpm: 138.0,
        spb: 2,
        bpb: 3,
        bars: 12,
        level: 0.85,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.125, 0.5, 0.001, 0.25, 0.0, 0.1), 1.0, melody),
            nt(BASS.gate(0.7), 0.9, bass),
            nt(pulse(0.25, 0.3, 0.002, 0.1, 0.0, 0.03).gate(0.4), 0.7, pah),
        ],
    }
}

fn hotspy() -> Spec {
    let melody = "a4 . a4 c5 f5 . e5 d5 | c5 . c5 e5 g5 . f5 e5 | a4 . a4 c5 f5 . a5 f5 | g5 . e5 . c5 . . . | \
                  a5 . f5 a5 c6 . a5 f5 | d6 . bb5 . g5 . d5 . | e5 . g5 . c6 . bb5 g5 | f5 - a5 - f5 - . .";
    let bass = fill(
        "A . . . B . . .",
        &["f2 c3", "f2 c3", "c3 g2", "c3 g2", "f2 c3", "bb2 f2", "c3 g2", "f2 c3"],
    );
    let pah = fill(
        ". . A . . . A .",
        &[
            "f3+a3+c4", "f3+a3+c4", "e3+g3+c4", "e3+g3+c4", "f3+a3+c4", "f3+bb3+d4", "e3+g3+c4", "f3+a3+c4",
        ],
    );
    Spec {
        bpm: 132.0,
        spb: 2,
        bpb: 4,
        bars: 8,
        level: 0.95,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.5, 0.5, 0.003, 0.1, 0.6, 0.04).gate(0.75), 1.0, melody),
            nt(BASS.gate(0.6), 0.9, bass),
            nt(pulse(0.25, 0.3, 0.002, 0.08, 0.2, 0.03).gate(0.5), 0.8, pah),
            dr(0.7, "k h s h k h s h"),
        ],
    }
}

fn footlock() -> Spec {
    let b1 = "c5 . . c5 . . e5 . g5 . . . . . . .";
    let b2 = "c5 . . c5 . . e5 . g5 . . . g5 a5 g5 .";
    let b3 = "f5 . . f5 . . a5 . c6 . . . . . . .";
    let b4 = "b5 . a5 . g5 . . . d5 . . . . . . .";
    let b8 = "c5 . e5 . g5 . c6 . . . . . . . . .";
    let lead = [b1, b2, b3, b4, b1, b2, b3, b8].join(" | ");
    let bass = fill(
        "A . . . . . . . B . . . . . . .",
        &["c3 g2", "c3 g2", "f3 c3", "g2 d3", "c3 g2", "c3 g2", "f3 c3", "c3 g2"],
    );
    let chords = fill(
        ". . . . A . . . . . . . A . . .",
        &[
            "e4+g4+c5", "e4+g4+c5", "f4+a4+c5", "g4+b4+d5", "e4+g4+c5", "e4+g4+c5", "f4+a4+c5", "e4+g4+c5",
        ],
    );
    Spec {
        bpm: 116.0,
        spb: 4,
        bpb: 4,
        bars: 8,
        level: 0.95,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.25, 0.5, 0.008, 0.1, 0.8, 0.06).vib(6.0, 0.15, 0.1).gate(0.9), 1.0, lead),
            nt(BASS.gate(0.7), 0.9, bass),
            nt(pulse(0.5, 0.3, 0.003, 0.1, 0.3, 0.05).gate(0.3), 0.8, chords),
            dr(0.8, "k . s s s . s . k . s s s . s s"),
        ],
    }
}

fn sambaddy() -> Spec {
    let riff = fill(
        "A . A . A . A A",
        &[
            "e3+b3+e4", "e3+b3+e4", "g3+d4+g4", "a3+e4+a4", "e3+b3+e4", "e3+b3+e4", "g3+d4+g4", "b3+f#4+b4",
        ],
    );
    let bass = fill(
        "A A . A A . B C",
        &["e2 g2 a2", "e2 g2 a2", "g2 b2 c3", "a2 c3 d3", "e2 g2 a2", "e2 g2 a2", "g2 b2 c3", "b2 d3 e3"],
    );
    let lead = "e5 - g5 - a5 - a#5 a5 | g5 - e5 - . . . . | g5 - b5 - d6 - b5 g5 | a5 - c6 - e6 - c6 a5 | \
                e5 - g5 - a5 - a#5 a5 | e6 - d6 - b5 - g5 . | g5 - b5 - d6 - b5 g5 | b5 - - - - - - .";
    Spec {
        bpm: 124.0,
        spb: 2,
        bpb: 4,
        bars: 8,
        level: 0.95,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.5, 0.35, 0.002, 0.1, 0.8, 0.04).gate(0.7), 0.9, riff),
            nt(BASS.gate(0.8), 1.0, bass),
            nt(pulse(0.25, 0.45, 0.003, 0.1, 0.7, 0.05).vib(5.5, 0.25, 0.1).gate(0.85), 0.9, lead),
            dr(0.9, "k h s h k k s h"),
        ],
    }
}

fn crookstone() -> Spec {
    let comp = fill(
        "A . . A . . A . . . A . . A . .",
        &[
            "a3+c4+d4+f4", "b3+d4+f4+g4", "b3+e4+g4+c5", "g3+c4+e4+a4", "a3+c4+d4+f4", "b3+d4+f4+g4", "b3+e4+g4+c5", "g3+c4+e4+a4",
        ],
    );
    let bass = fill(
        "A . . . . . B . A . . . . . B .",
        &["d3 a2", "g2 d3", "c3 g2", "a2 e3", "d3 a2", "g2 d3", "c3 g2", "a2 e3"],
    );
    let mel = "f5 - - - e5 - d5 - a4 - - - . . . . | d5 - - - b4 - d5 - f5 - - - . . . . | \
               e5 - - - g5 - e5 - c5 - - - . . . . | c5 - - - a4 - c5 - e5 - - - . . . . | \
               f5 - - - e5 - d5 - a4 - - - . . . . | d5 - - - g5 - f5 - d5 - - - . . . . | \
               e5 - g5 - b5 - - - g5 - - - e5 - - - | e5 - - - - - - - - - - - - - - -";
    Spec {
        bpm: 126.0,
        spb: 4,
        bpb: 4,
        bars: 8,
        level: 0.85,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.5, 0.32, 0.03, 0.1, 0.8, 0.15).vib(5.0, 0.3, 0.25).gate(0.9), 1.0, mel),
            nt(pulse(0.125, 0.35, 0.002, 0.1, 0.3, 0.05).gate(0.35), 0.8, comp),
            nt(BASS.gate(0.7), 0.9, bass),
            dr(0.35, "k h . h s h . h k h . h s h . h"),
        ],
    }
}

fn sharper() -> Spec {
    let arp = fill(
        "A B C D E D C B",
        &["f3 c4 a4 e5 a5", "g3 d4 b4 f#5 b5", "a3 e4 c5 g5 c6", "e3 b3 g4 d5 g5", "d3 a3 f4 c5 f5", "c3 g3 e4 b4 e5"],
    );
    let pad = held(&[
        ("f3+a3+c4+e4", 8),
        ("g3+b3+d4+e4", 8),
        ("a3+c4+e4+g4", 8),
        ("e3+g3+b3+d4", 8),
        ("d3+f3+a3+c4", 8),
        ("c3+e3+g3+d4", 8),
    ]);
    let bass = held(&[("f2", 8), ("g2", 8), ("a2", 8), ("e2", 8), ("d2", 8), ("c2", 8)]);
    Spec {
        bpm: 76.0,
        spb: 2,
        bpb: 4,
        bars: 6,
        level: 0.6,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.25, 0.35, 0.01, 0.45, 0.2, 0.3), 1.0, arp),
            nt(PAD.vib(4.5, 0.15, 0.5), 0.8, pad),
            nt(Voice::new(Inst::Tri, 0.8, 0.3, 0.0, 1.0, 0.5), 0.9, bass),
        ],
    }
}

fn spenders() -> Spec {
    let b1 = "e5 g5 b5 e6 b5 g5 e5 g5";
    let b2 = "e5 g5 b5 e6 d6 b5 a5 g5";
    let b3 = "c5 e5 g5 c6 g5 e5 c5 e5";
    let b4 = "d#5 f#5 a5 b5 a5 f#5 d#5 b4";
    let b8 = "e5 - - - - - - .";
    let lead = [b1, b2, b3, b4, b1, b2, b3, b8].join(" | ");
    let bass = fill("A A A A A A A A", &["e2", "e2", "c3", "b2", "e2", "e2", "c3", "b2"]);
    let gtr = fill(". A . A . A . A", &["e4+g4+b4", "e4+g4+b4", "e4+g4+c5", "d#4+f#4+b4", "e4+g4+b4", "e4+g4+b4", "e4+g4+c5", "d#4+f#4+b4"]);
    Spec {
        bpm: 152.0,
        spb: 2,
        bpb: 4,
        bars: 8,
        level: 0.95,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.125, 0.5, 0.002, 0.08, 0.6, 0.03).vib(9.0, 0.45, 0.0).gate(0.8), 1.0, lead),
            nt(BASS.gate(0.7), 0.9, bass),
            nt(pulse(0.25, 0.25, 0.002, 0.08, 0.3, 0.03).gate(0.5), 0.7, gtr),
            dr(0.85, "k h s h k h s s"),
        ],
    }
}

fn gamestonk() -> Spec {
    let lead = "c5 e5 g5 c6 g5 e5 g5 c6 | a5 f5 a5 c6 a5 f5 d5 f5 | g5 b5 d6 g6 d6 b5 g5 b5 | e6 c6 g5 e5 c5 e5 g5 c6 | \
                f5 a5 c6 f6 c6 a5 f5 a5 | g5 b5 d6 g6 d6 b5 d6 g6 | e6 d6 c6 b5 a5 g5 f5 e5 | c6 - g5 - e5 - c5 .";
    let bass = fill(
        "A B A B A B A B",
        &["c3 c4", "f3 f4", "g3 g4", "c3 c4", "f3 f4", "g3 g4", "a2 a3", "c3 c4"],
    );
    let harm = fill(
        ". A . A . A . A",
        &["e4+g4", "a4+c5", "b4+d5", "e4+g4", "a4+c5", "b4+d5", "c4+e4", "e4+g4"],
    );
    Spec {
        bpm: 152.0,
        spb: 2,
        bpb: 4,
        bars: 8,
        level: 1.0,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.5, 0.45, 0.002, 0.08, 0.6, 0.03).gate(0.6), 1.0, lead),
            nt(BASS.gate(0.6), 0.9, bass),
            nt(pulse(0.125, 0.25, 0.002, 0.06, 0.2, 0.03).gate(0.5), 0.8, harm),
            dr(0.8, "k h s h k h s k"),
        ],
    }
}

fn booth() -> Spec {
    let lead = "d5 - d5 e5 g5 - e5 d5 | a4 - a4 b4 d5 - b4 a4 | b4 - b4 d5 e5 - d5 b4 | c5 - e5 - g5 - - . | \
                d5 - d5 e5 g5 - e5 d5 | d5 - d5 e5 f#5 - a5 f#5 | g5 - e5 - b4 - e5 - | c5 - d5 - e5 - - .";
    let bass = fill(
        "A . A . A . B .",
        &["g2 d3", "d3 a2", "e2 b2", "c3 g2", "g2 d3", "d3 a2", "e2 b2", "c3 g2"],
    );
    let chords = fill(
        "A . . A . . A .",
        &["g3+b3+d4", "a3+d4+f#4", "g3+b3+e4", "g3+c4+e4", "g3+b3+d4", "a3+d4+f#4", "g3+b3+e4", "g3+c4+e4"],
    );
    Spec {
        bpm: 116.0,
        spb: 2,
        bpb: 4,
        bars: 8,
        level: 0.95,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.5, 0.5, 0.003, 0.1, 0.7, 0.05).vib(5.5, 0.2, 0.15).gate(0.8), 1.0, lead),
            nt(BASS.gate(0.8), 0.9, bass),
            nt(pulse(0.25, 0.25, 0.002, 0.1, 0.3, 0.03).gate(0.5), 0.7, chords),
            dr(0.8, "k h s h k h s o"),
        ],
    }
}

fn tally() -> Spec {
    let melody = "e5 . g5 . e5 c5 d5 e5 | c5 . e5 . a5 . e5 c5 | f5 . a5 . f5 c5 d5 f5 | d5 . g5 . b5 . g5 d5 | \
                  e5 . g5 . e5 c5 d5 e5 | f5 . a5 . c6 . a5 f5 | g5 . b5 . d6 . b5 g5 | c6 - g5 - e5 - c5 .";
    let bass = fill(
        "A . B . A . B .",
        &["c3 g3", "a2 e3", "f2 c3", "g2 d3", "c3 g3", "f2 c3", "g2 d3", "c3 g3"],
    );
    let pah = fill(
        ". A . A . A . A",
        &["e4+g4+c5", "e4+a4+c5", "f4+a4+c5", "f4+g4+b4", "e4+g4+c5", "f4+a4+c5", "f4+g4+b4", "e4+g4+c5"],
    );
    Spec {
        bpm: 128.0,
        spb: 2,
        bpb: 4,
        bars: 8,
        level: 0.9,
        looping: true,
        tail: 0.0,
        tracks: vec![
            nt(pulse(0.5, 0.45, 0.003, 0.1, 0.6, 0.04).gate(0.6), 1.0, melody),
            nt(BASS.gate(0.6), 0.9, bass),
            nt(pulse(0.125, 0.25, 0.002, 0.08, 0.2, 0.03).gate(0.5), 0.7, pah),
            dr(0.7, "k . s . k . s h"),
        ],
    }
}

fn flicker() -> Spec {
    Spec {
        bpm: 140.0,
        spb: 4,
        bpb: 4,
        bars: 1,
        level: 0.9,
        looping: false,
        tail: 0.8,
        tracks: vec![
            nt(
                pulse(0.25, 0.5, 0.002, 0.1, 0.6, 0.3).gate(0.75),
                1.0,
                "c5 e5 g5 c6 e6 g6 c7 . c6+e6+g6+c7 - - - - - - -",
            ),
            nt(pulse(0.5, 0.25, 0.002, 0.1, 0.5, 0.3).gate(0.7), 0.7, ". c5 e5 g5 c6 e6 g6 . g5+c6+e6 - - - - - - -"),
            nt(BASS, 0.9, "c3 . . . . . . . c3 - - - - - - -"),
        ],
    }
}

fn level_clear() -> Spec {
    let harm = held(&[("c4+e4+g4", 8), ("f4+a4+c5", 8), ("c5+e5+g5", 8)]);
    Spec {
        bpm: 132.0,
        spb: 2,
        bpb: 4,
        bars: 3,
        level: 1.0,
        looping: false,
        tail: 0.7,
        tracks: vec![
            nt(pulse(0.5, 0.5, 0.004, 0.1, 0.8, 0.2).vib(5.5, 0.2, 0.2), 1.0, "c5 . c5 c5 e5 - g5 - | a5 - g5 - e5 - g5 - | c6 - - - - - - -"),
            nt(pulse(0.125, 0.3, 0.005, 0.1, 0.8, 0.2).gate(0.9), 0.7, harm),
            nt(BASS.gate(0.7), 0.9, fill("A . A . A . A A", &["c3", "f3", "c3"])),
            dr(0.7, "k . s . k . s s | k . s . k . s s | k . . . . . . ."),
        ],
    }
}

fn game_over() -> Spec {
    Spec {
        bpm: 90.0,
        spb: 2,
        bpb: 3,
        bars: 2,
        level: 0.9,
        looping: false,
        tail: 1.0,
        tracks: vec![
            nt(pulse(0.25, 0.5, 0.01, 0.2, 0.8, 0.4).vib(5.0, 0.5, 0.2), 1.0, "e5 - d5 - c5 - | b4 - - - a4 -"),
            nt(pulse(0.125, 0.25, 0.2, 0.0, 1.0, 0.5), 0.7, held(&[("a3+c4+e4", 6), ("a3+c4+e4", 6)])),
            nt(Voice::new(Inst::Tri, 0.8, 0.01, 0.0, 1.0, 0.5), 0.9, held(&[("a2", 6), ("e2", 6)])),
        ],
    }
}

fn item_get() -> Spec {
    Spec {
        bpm: 180.0,
        spb: 2,
        bpb: 4,
        bars: 1,
        level: 0.9,
        looping: false,
        tail: 0.6,
        tracks: vec![
            nt(pulse(0.5, 0.5, 0.002, 0.1, 0.7, 0.25).gate(0.8), 1.0, "d5 g5 b5 d6 - b5 d6 -"),
            nt(pulse(0.125, 0.3, 0.002, 0.1, 0.5, 0.25).gate(0.8), 0.7, ". d5 g5 b5 - g5 b5 -"),
            nt(BASS, 0.9, "g3 - - - g3 - - -"),
        ],
    }
}

#[cfg(test)]
mod tests {
    use super::super::all_songs;
    use super::*;

    fn hash(p: &[i16]) -> u64 {
        p.iter().fold(1469598103934665603u64, |h, x| (h ^ (*x as u16 as u64)).wrapping_mul(1099511628211))
    }
    fn peak(p: &[i16]) -> i32 {
        p.iter().map(|x| (*x as i32).abs()).max().unwrap()
    }

    #[test]
    fn every_pattern_aligns_with_the_song_grid() {
        for s in all_songs() {
            let sp = spec(s);
            for (i, tr) in sp.tracks.iter().enumerate() {
                let (_, n) = parse_pattern(&tr.pat);
                assert!(n > 0, "{s:?} track {i} empty");
                assert!(sp.steps() % n == 0 || n == sp.steps(), "{s:?} track {i}: {n} steps does not divide {}", sp.steps());
                // every note token must parse
                for tok in tr.pat.split_whitespace() {
                    if matches!(tok, "." | "-" | "|") {
                        continue;
                    }
                    for part in tok.split('+') {
                        match tr.kind {
                            Kind::Notes => assert!(parse_note(part).is_some(), "{s:?} bad note {part:?}"),
                            Kind::Drums => assert!("kshotc".contains(part), "{s:?} bad drum {part:?}"),
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn songs_render_audible_unclipped_and_a_sensible_length() {
        for s in all_songs() {
            let pcm = render_song(s);
            let secs = pcm.len() as f32 / SAMPLE_RATE as f32;
            let pk = peak(&pcm);
            assert!(pk > 3000, "{s:?} too quiet ({pk})");
            assert!(pk < 28000, "{s:?} clips ({pk})");
            match s {
                Song::FlickerJingle | Song::ItemGet => assert!((1.2..=3.0).contains(&secs), "{s:?} {secs}s"),
                Song::GameOver | Song::LevelClear => assert!((3.5..=7.5).contains(&secs), "{s:?} {secs}s"),
                _ => assert!((12.0..=24.5).contains(&secs), "{s:?} {secs}s"),
            }
        }
    }

    #[test]
    fn loops_are_whole_bars_and_seamless() {
        for s in all_songs() {
            let sp = spec(s);
            assert_eq!(song_loops(s), sp.looping, "{s:?}");
            let pcm = render_song(s);
            if sp.looping {
                assert_eq!(pcm.len(), sp.body_samples(), "{s:?}");
                let bar = sp.bpb as f64 * 60.0 / sp.bpm as f64 * SAMPLE_RATE as f64;
                let bars = pcm.len() as f64 / bar;
                assert!((bars - bars.round()).abs() < 0.01, "{s:?} not whole bars: {bars}");
                let jump = (pcm[0] as i32 - *pcm.last().unwrap() as i32).abs();
                assert!(jump < 200, "{s:?} seam jump {jump}");
            } else {
                assert!(pcm.last().unwrap().abs() < 200, "{s:?} jingle ends loudly");
            }
        }
    }

    #[test]
    fn jingles_are_one_shots() {
        for s in [Song::FlickerJingle, Song::LevelClear, Song::GameOver, Song::ItemGet] {
            assert!(!song_loops(s));
        }
        for s in [Song::Title, Song::Mall, Song::Alarm, Song::Elevator, Song::ListeningBooth, Song::Tally] {
            assert!(song_loops(s));
        }
    }

    #[test]
    fn all_songs_are_distinct_and_deterministic() {
        let mut seen = std::collections::HashSet::new();
        for s in all_songs() {
            let a = render_song(s);
            assert_eq!(hash(&a), hash(&render_song(s)), "{s:?} not deterministic");
            assert!(seen.insert(hash(&a)), "{s:?} duplicates another song");
        }
        assert_eq!(seen.len(), 20);
    }

    #[test]
    fn mall_ambient_is_much_quieter_than_title() {
        let m = peak(&render_song(Song::Mall)) as f32;
        let t = peak(&render_song(Song::Title)) as f32;
        assert!(m < t * 0.5, "mall {m} vs title {t}");
        assert!(m > t * 0.3);
    }

    #[test]
    fn songs_render_quickly() {
        let t0 = std::time::Instant::now();
        for s in all_songs() {
            let t = std::time::Instant::now();
            render_song(s);
            assert!(t.elapsed().as_secs_f32() < 3.0, "{s:?} slow");
        }
        eprintln!("all songs rendered in {:?}", t0.elapsed());
    }

    #[test]
    fn note_names_parse() {
        assert_eq!(parse_note("a4"), Some(69.0));
        assert_eq!(parse_note("c#5"), Some(73.0));
        assert_eq!(parse_note("bb3"), Some(58.0));
        assert_eq!(parse_note("x"), None);
    }
}
