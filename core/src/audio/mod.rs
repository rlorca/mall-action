//! NES-style chiptune synthesiser (audio agent owns this module): two pulse channels, a triangle and noise,
//! rendered to mono f32 samples. The host asks it for samples; the rules only emit `Event`s.
//!
//! * `score` - song data format (MML-like patterns), instrument library, drums.
//! * `songs` - every composition (all original), one function per track.
//! * `sfx`   - sound effects as short voice programs (pulse sweeps, noise bursts).
//!
//! Everything is deterministic (fixed-seed LFSR, no clock), state carries across `render` calls so any block size
//! gives identical samples, and `render` never allocates (allocation only happens in `set_track` / `play_sfx`).

pub mod score;
pub mod sfx;
pub mod songs;
#[cfg(test)]
mod tests;

use crate::events::{Event, Sfx, Track};
use score::{drum, Inst, Song, ARP_TABLE, INSTS};
use sfx::{Kind, Seg};

const POOL: usize = 8;
/// NES-like linear mixer weights (per 0..15 unit of each channel) and master gain.
const W_PULSE: f32 = 0.00752;
const W_TRI: f32 = 0.00851;
const W_NOISE: f32 = 0.00494;
const MASTER: f32 = 2.3;
const SFX_GAIN: f32 = 1.0;
const CTRL_MASK: u8 = 15;

#[inline]
fn q15(v: f32) -> f32 {
    // 4-bit volume steps
    (v.clamp(0.0, 1.0) * 15.0 + 0.5).floor()
}

#[inline]
fn step_lfsr(l: &mut u16, short: bool) {
    let tap = if short { (*l >> 6) & 1 } else { (*l >> 1) & 1 };
    let fb = (*l & 1) ^ tap;
    *l = (*l >> 1) | (fb << 14);
}

#[inline]
fn duty_thr(duty: u8) -> u32 {
    match duty {
        0 => 1 << 29,          // 12.5 %
        1 => 1 << 30,          // 25 %
        2 => 1 << 31,          // 50 %
        _ => 3 << 30,          // 75 %
    }
}

#[inline]
fn tri_wave(phase: u32) -> f32 {
    let s = phase >> 27; // 32 steps
    (if s < 16 { s } else { 31 - s }) as f32
}

#[inline]
fn hz_inc(f: f32, inv_sr: f32) -> u32 {
    (f * inv_sr * 4_294_967_296.0).clamp(0.0, 4_294_000_000.0) as u32
}

#[inline]
fn envelope(i: &Inst, t: f32, gate_t: f32) -> f32 {
    let f = |t: f32| {
        let att = i.attack.max(0.001);
        let a = (t / att).min(1.0);
        let d = if t > att { 1.0 - (1.0 - i.sustain) * ((t - att) / i.decay.max(0.001)).min(1.0) } else { 1.0 };
        a * d
    };
    if t < gate_t {
        f(t)
    } else {
        f(gate_t) * (1.0 - (t - gate_t) / i.release.max(0.001)).max(0.0)
    }
}

#[derive(Clone, Copy)]
struct MChan {
    pos: usize,
    next_start: u32,
    active: bool,
    pitch: i16,
    inst: u8,
    arp: u8,
    age: u32,
    gate_t: f32,
    phase: u32,
    inc: u32,
    lfsr: u16,
    ctrl: u8,
    /// Steal gain (ramps to 0 while an SFX uses this hardware channel).
    mute: f32,
}

impl MChan {
    fn new() -> MChan {
        MChan { pos: 0, next_start: 0, active: false, pitch: 0, inst: 0, arp: 0, age: 0, gate_t: 0.0, phase: 0, inc: 0, lfsr: 1, ctrl: 0, mute: 1.0 }
    }
    fn reset(&mut self) {
        *self = MChan { mute: self.mute, ..MChan::new() };
    }

    /// Returns 0..15 level for a pitched channel (0/1 pulse, 2 triangle).
    #[inline]
    fn pitched(&mut self, tri: bool, inv_sr: f32) -> f32 {
        if !self.active {
            return 0.0;
        }
        let inst = &INSTS[self.inst as usize].1;
        let t = self.age as f32 * inv_sr;
        if self.ctrl == 0 {
            let mut st = self.pitch as f32 - 69.0;
            if self.arp > 0 {
                let i = ((t * 60.0) as usize) % 3;
                st += ARP_TABLE[self.arp as usize][i] as f32;
            }
            if inst.vib_cents > 0.0 && t > inst.vib_delay {
                let p = (t * inst.vib_hz).fract();
                let lfo = if p < 0.5 { 4.0 * p - 1.0 } else { 3.0 - 4.0 * p };
                st += lfo * inst.vib_cents * 0.01 * ((t - inst.vib_delay) * 5.0).min(1.0);
            }
            if inst.slide != 0.0 {
                st += inst.slide * (t / inst.slide_time.max(0.001)).min(1.0);
            }
            self.inc = hz_inc(440.0 * (st / 12.0).exp2(), inv_sr);
        }
        self.ctrl = (self.ctrl + 1) & CTRL_MASK;
        let env = envelope(inst, t, self.gate_t);
        self.age += 1;
        if t > self.gate_t && env <= 0.0 {
            self.active = false;
            return 0.0;
        }
        self.phase = self.phase.wrapping_add(self.inc);
        if tri {
            tri_wave(self.phase) * env * inst.vol
        } else if self.phase < duty_thr(inst.duty) {
            q15(env * inst.vol)
        } else {
            0.0
        }
    }

    #[inline]
    fn noise(&mut self, inv_sr: f32) -> f32 {
        if !self.active {
            return 0.0;
        }
        let d = drum(self.pitch as u8);
        let t = self.age as f32 * inv_sr;
        if t >= d.decay {
            self.active = false;
            return 0.0;
        }
        let x = t / d.decay;
        if self.ctrl == 0 {
            self.inc = hz_inc(d.f0 * (d.f1 / d.f0).powf(x), inv_sr);
        }
        self.ctrl = (self.ctrl + 1) & CTRL_MASK;
        self.age += 1;
        let (p, o) = self.phase.overflowing_add(self.inc);
        self.phase = p;
        if o {
            step_lfsr(&mut self.lfsr, d.short);
        }
        if self.lfsr & 1 == 0 {
            q15(d.vol * (1.0 - x) * (1.0 - x))
        } else {
            0.0
        }
    }
}

#[derive(Clone)]
struct Voice {
    active: bool,
    tag: u8,
    order: u32,
    kind: Kind,
    short: bool,
    segs: Vec<Seg>,
    idx: usize,
    t: u32,
    seg_len: u32,
    phase: u32,
    inc: u32,
    lfsr: u16,
    ctrl: u8,
}

impl Voice {
    fn new() -> Voice {
        Voice { active: false, tag: 0, order: 0, kind: Kind::Pulse, short: false, segs: Vec::with_capacity(32), idx: 0, t: 0, seg_len: 0, phase: 0, inc: 0, lfsr: 1, ctrl: 0 }
    }

    /// Skip to the next playable segment; deactivates at the end.
    fn load_seg(&mut self, sr: f32) {
        loop {
            if self.idx >= self.segs.len() {
                self.active = false;
                return;
            }
            let ms = self.segs[self.idx].ms;
            let n = (ms * 0.001 * sr) as u32;
            if n == 0 {
                self.idx += 1;
                continue;
            }
            self.seg_len = n;
            self.t = 0;
            self.ctrl = 0;
            return;
        }
    }

    #[inline]
    fn sample(&mut self, sr: f32, inv_sr: f32) -> f32 {
        if !self.active {
            return 0.0;
        }
        let seg = self.segs[self.idx];
        let x = self.t as f32 / self.seg_len as f32;
        if self.ctrl == 0 {
            let f = if seg.f0 == seg.f1 { seg.f0 } else { seg.f0 * (seg.f1 / seg.f0).powf(x) };
            self.inc = hz_inc(f, inv_sr);
        }
        self.ctrl = (self.ctrl + 1) & CTRL_MASK;
        let v = seg.v0 + (seg.v1 - seg.v0) * x;
        self.t += 1;
        let out = match self.kind {
            Kind::Pulse => {
                self.phase = self.phase.wrapping_add(self.inc);
                if v > 0.0 && self.phase < duty_thr(seg.duty) {
                    q15(v)
                } else {
                    0.0
                }
            }
            Kind::Tri => {
                self.phase = self.phase.wrapping_add(self.inc);
                tri_wave(self.phase) * v
            }
            Kind::Noise => {
                let (p, o) = self.phase.overflowing_add(self.inc);
                self.phase = p;
                if o {
                    step_lfsr(&mut self.lfsr, self.short);
                }
                if v > 0.0 && self.lfsr & 1 == 0 {
                    q15(v)
                } else {
                    0.0
                }
            }
        };
        if self.t >= self.seg_len {
            self.idx += 1;
            self.load_seg(sr);
        }
        out
    }
}

pub struct Synth {
    sample_rate: u32,
    sr: f32,
    inv_sr: f32,
    // music
    track: Option<Track>,
    song: Option<Song>,
    tick_len: f64,
    acc: f64,
    tick: u32,
    ended: bool,
    mch: [MChan; 4],
    music_gain: f32,
    music_target: f32,
    song_gain: f32,
    gain_step: f32,
    fade_in: f32,
    // sfx
    voices: Vec<Voice>,
    sfx_counter: u32,
    // hum
    hum_on: bool,
    hum_gain: f32,
    hum_phase: u32,
    hum_lfsr: u16,
    hum_noise: f32,
    hum_cnt: u32,
    hum_lfo: f32,
    // output stage
    dc_x: f32,
    dc_y: f32,
    dc_r: f32,
    lp_y: f32,
    lp_a: f32,
}

impl Synth {
    pub fn new(sample_rate: u32) -> Synth {
        let sr = sample_rate.clamp(8000, 192_000) as f32;
        Synth {
            sample_rate,
            sr,
            inv_sr: 1.0 / sr,
            track: None,
            song: None,
            tick_len: 1.0,
            acc: 0.0,
            tick: 0,
            ended: false,
            mch: [MChan::new(); 4],
            music_gain: 1.0,
            music_target: 1.0,
            song_gain: 1.0,
            gain_step: 1.0 / (0.03 * sr),
            fade_in: 1.0,
            voices: (0..POOL).map(|_| Voice::new()).collect(),
            sfx_counter: 0,
            hum_on: false,
            hum_gain: 0.0,
            hum_phase: 0,
            hum_lfsr: 1,
            hum_noise: 0.0,
            hum_cnt: 0,
            hum_lfo: 0.0,
            dc_x: 0.0,
            dc_y: 0.0,
            dc_r: 1.0 - 2.0 * std::f32::consts::PI * 20.0 / sr,
            lp_y: 0.0,
            lp_a: 1.0 - (-2.0 * std::f32::consts::PI * 12000.0f32.min(sr * 0.4) / sr).exp(),
        }
    }

    pub fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    pub fn apply(&mut self, e: &Event) {
        match *e {
            Event::Sfx(s) => self.play_sfx(s),
            Event::Music(t) => self.set_track(t),
            Event::Hum(on) => self.set_hum(on),
            Event::MusicVolume(v) => self.set_music_volume(v),
        }
    }

    /// Start a song. Does nothing when `t` is already the current track (a finished jingle may be replayed).
    pub fn set_track(&mut self, t: Track) {
        if self.track == Some(t) && !(t.is_jingle() && self.music_finished()) {
            return;
        }
        self.track = Some(t);
        for m in self.mch.iter_mut() {
            m.reset();
        }
        self.tick = 0;
        self.ended = false;
        self.fade_in = 0.0;
        self.song = songs::song(t);
        if let Some(s) = &self.song {
            self.tick_len = s.tick_seconds() as f64 * self.sr as f64;
            self.acc = self.tick_len; // first tick fires immediately
            self.song_gain = s.gain;
        }
    }

    /// Play a custom song (dev/test tool: analyse one channel, audition a score).
    pub fn song_override(&mut self, song: Song) {
        self.track = None;
        for m in self.mch.iter_mut() {
            m.reset();
        }
        self.tick = 0;
        self.ended = false;
        self.fade_in = 1.0;
        self.tick_len = song.tick_seconds() as f64 * self.sr as f64;
        self.acc = self.tick_len;
        self.song_gain = song.gain;
        self.song = Some(song);
    }

    pub fn current_track(&self) -> Option<Track> {
        self.track
    }

    /// True when no song is playing or a jingle has finished (all notes released).
    pub fn music_finished(&self) -> bool {
        match &self.song {
            None => true,
            Some(s) => !s.looping && self.ended && self.mch.iter().all(|m| !m.active),
        }
    }

    pub fn play_sfx(&mut self, s: Sfx) {
        let tag = s as u8 + 1;
        for v in self.voices.iter_mut() {
            if v.active && v.tag == tag {
                v.active = false; // retrigger replaces the previous instance
            }
        }
        self.sfx_counter = self.sfx_counter.wrapping_add(1);
        for p in sfx::parts(s) {
            // free voice, else steal the oldest
            let slot = match self.voices.iter().position(|v| !v.active) {
                Some(i) => i,
                None => {
                    let mut best = 0;
                    for (i, v) in self.voices.iter().enumerate() {
                        if v.order < self.voices[best].order {
                            best = i;
                        }
                    }
                    best
                }
            };
            let v = &mut self.voices[slot];
            v.active = true;
            v.tag = tag;
            v.order = self.sfx_counter;
            v.kind = p.kind;
            v.short = p.short;
            v.segs.clear();
            v.segs.extend_from_slice(&p.segs);
            v.idx = 0;
            v.phase = 0;
            v.lfsr = 1;
            v.load_seg(self.sr);
        }
    }

    pub fn set_hum(&mut self, on: bool) {
        self.hum_on = on;
    }

    pub fn set_music_volume(&mut self, v: f32) {
        self.music_target = if v.is_finite() { v.clamp(0.0, 1.0) } else { 1.0 };
    }

    /// Number of SFX voices currently sounding.
    pub fn sfx_voices_active(&self) -> usize {
        self.voices.iter().filter(|v| v.active).count()
    }

    fn start_events(&mut self) {
        let Synth { song, mch, tick, ended, .. } = self;
        let s = match song {
            Some(s) => s,
            None => return,
        };
        if *tick >= s.len() {
            if s.looping {
                *tick = 0;
                for m in mch.iter_mut() {
                    m.pos = 0;
                    m.next_start = 0;
                }
            } else {
                *ended = true;
                return;
            }
        }
        let tick_s = s.tick_seconds();
        for c in 0..4 {
            let m = &mut mch[c];
            let evs = &s.ch[c].evs;
            while m.pos < evs.len() && m.next_start == *tick {
                let ev = evs[m.pos];
                m.pos += 1;
                m.next_start += ev.dur as u32;
                if ev.pitch >= 0 {
                    m.active = true;
                    m.pitch = ev.pitch;
                    m.inst = ev.inst;
                    m.arp = ev.arp;
                    m.age = 0;
                    m.ctrl = 0;
                    m.phase = 0;
                    m.gate_t = ev.dur as f32 * tick_s * INSTS[ev.inst as usize].1.gate;
                }
            }
        }
        *tick += 1;
    }

    #[inline]
    fn next(&mut self) -> f32 {
        let inv_sr = self.inv_sr;
        // sequencer
        if self.song.is_some() && !self.ended {
            self.acc += 1.0;
            if self.acc >= self.tick_len {
                self.acc -= self.tick_len;
                self.start_events();
            }
        }
        // SFX voices + channel stealing
        let mut sfx_mix = 0.0;
        let mut steal = [0u8; 3]; // pulse, tri, noise counts
        for v in self.voices.iter_mut() {
            if v.active {
                match v.kind {
                    Kind::Pulse => steal[0] += 1,
                    Kind::Tri => steal[1] += 1,
                    Kind::Noise => steal[2] += 1,
                }
                let o = v.sample(self.sr, inv_sr);
                sfx_mix += o
                    * match v.kind {
                        Kind::Pulse => W_PULSE,
                        Kind::Tri => W_TRI,
                        Kind::Noise => W_NOISE,
                    };
            }
        }
        let ramp = 1.0 / (0.002 * self.sr);
        let targets = [1.0, if steal[0] > 0 { 0.0 } else { 1.0 }, if steal[1] > 0 { 0.0 } else { 1.0 }, if steal[2] > 0 { 0.0 } else { 1.0 }];
        let targets = [if steal[0] > 1 { 0.0 } else { targets[0] }, targets[1], targets[2], targets[3]];
        for (m, t) in self.mch.iter_mut().zip(targets) {
            if m.mute < t {
                m.mute = (m.mute + ramp).min(t);
            } else if m.mute > t {
                m.mute = (m.mute - ramp).max(t);
            }
        }
        // music
        let p1 = self.mch[0].pitched(false, inv_sr) * self.mch[0].mute;
        let p2 = self.mch[1].pitched(false, inv_sr) * self.mch[1].mute;
        let tr = self.mch[2].pitched(true, inv_sr) * self.mch[2].mute;
        let nz = self.mch[3].noise(inv_sr) * self.mch[3].mute;
        let music = W_PULSE * (p1 + p2) + W_TRI * tr + W_NOISE * nz;
        // smooth music gain
        if self.music_gain < self.music_target {
            self.music_gain = (self.music_gain + self.gain_step).min(self.music_target);
        } else if self.music_gain > self.music_target {
            self.music_gain = (self.music_gain - self.gain_step).max(self.music_target);
        }
        if self.fade_in < 1.0 {
            self.fade_in = (self.fade_in + 1.0 / (0.005 * self.sr)).min(1.0);
        }
        let mut mix = music * self.music_gain * self.song_gain * self.fade_in + sfx_mix * SFX_GAIN;
        // elevator hum (own gain ramp, not affected by music volume)
        let hum_target = if self.hum_on { 1.0 } else { 0.0 };
        if self.hum_gain < hum_target {
            self.hum_gain = (self.hum_gain + 1.0 / (0.15 * self.sr)).min(hum_target);
        } else if self.hum_gain > hum_target {
            self.hum_gain = (self.hum_gain - 1.0 / (0.15 * self.sr)).max(hum_target);
        }
        if self.hum_gain > 0.0 {
            self.hum_phase = self.hum_phase.wrapping_add(hz_inc(54.0, inv_sr));
            let tri = tri_wave(self.hum_phase) / 7.5 - 1.0;
            self.hum_cnt += 1;
            if self.hum_cnt % ((self.sr / 400.0) as u32).max(1) == 0 {
                step_lfsr(&mut self.hum_lfsr, true);
                let target = if self.hum_lfsr & 1 == 0 { 1.0 } else { -1.0 };
                self.hum_noise += (target - self.hum_noise) * 0.2;
            }
            self.hum_lfo += 0.35 * inv_sr;
            if self.hum_lfo >= 1.0 {
                self.hum_lfo -= 1.0;
            }
            let wob = 0.8 + 0.2 * (if self.hum_lfo < 0.5 { 4.0 * self.hum_lfo - 1.0 } else { 3.0 - 4.0 * self.hum_lfo });
            mix += self.hum_gain * (tri * 0.07 + self.hum_noise * 0.012) * wob;
        }
        // output stage: master gain, DC block, soft clip, gentle low-pass
        let x = mix * MASTER;
        let y = x - self.dc_x + self.dc_r * self.dc_y;
        self.dc_x = x;
        self.dc_y = y;
        let c = y.clamp(-3.0, 3.0);
        let sc = c * (27.0 + c * c) / (27.0 + 9.0 * c * c);
        self.lp_y += self.lp_a * (sc - self.lp_y);
        self.lp_y.clamp(-1.0, 1.0)
    }

    /// Fill `out` with mono samples in -1.0..=1.0. Any block size; no allocation.
    pub fn render(&mut self, out: &mut [f32]) {
        for s in out.iter_mut() {
            *s = self.next();
        }
    }
}
