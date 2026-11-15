//! NES-flavoured synth primitives: pulse (12.5/25/50/75 %), quantised triangle and LFSR noise,
//! rendered note-by-note into a float mix buffer. No per-sample transcendental maths.
use super::SAMPLE_RATE;

pub const SR: f32 = SAMPLE_RATE as f32;

/// Seconds to samples.
pub fn sec(s: f32) -> usize {
    (s * SR).round() as usize
}

/// MIDI note number to Hz.
pub fn midi_hz(m: f32) -> f32 {
    440.0 * ((m - 69.0) / 12.0).exp2()
}

#[derive(Clone, Copy, Debug)]
pub enum Inst {
    /// Pulse wave with duty cycle (0.125, 0.25, 0.5, 0.75).
    Pulse(f32),
    /// 4-bit-ish quantised triangle.
    Tri,
    /// LFSR noise; `true` = short (metallic) mode. Frequency argument is the LFSR clock rate in Hz.
    Noise(bool),
}

/// An instrument patch: waveform + envelope + optional vibrato.
#[derive(Clone, Copy, Debug)]
pub struct Voice {
    pub inst: Inst,
    pub vol: f32,
    pub atk: f32,
    pub dec: f32,
    pub sus: f32,
    pub rel: f32,
    pub vib_hz: f32,
    /// Vibrato depth in semitones.
    pub vib_depth: f32,
    pub vib_delay: f32,
    /// Fraction of the written note length that is actually held (staccato < 1).
    pub gate: f32,
}

impl Voice {
    pub const fn new(inst: Inst, vol: f32, atk: f32, dec: f32, sus: f32, rel: f32) -> Voice {
        Voice { inst, vol, atk, dec, sus, rel, vib_hz: 0.0, vib_depth: 0.0, vib_delay: 0.0, gate: 1.0 }
    }
    pub const fn vib(mut self, hz: f32, depth: f32, delay: f32) -> Voice {
        self.vib_hz = hz;
        self.vib_depth = depth;
        self.vib_delay = delay;
        self
    }
    pub const fn gate(mut self, g: f32) -> Voice {
        self.gate = g;
        self
    }
}

/// Float mix buffer. With `wrap` notes that run past the end continue at the start (seamless loops).
pub struct Mix {
    pub buf: Vec<f32>,
    wrap: bool,
}

impl Mix {
    pub fn new(len: usize, wrap: bool) -> Mix {
        Mix { buf: vec![0.0; len], wrap }
    }

    /// Render one note starting at sample `start`, held `dur` samples (then released).
    /// Pitch glides linearly from `f0` to `f1` Hz (equal = steady). For noise, f is the LFSR clock.
    pub fn tone(&mut self, start: usize, dur: usize, v: &Voice, f0: f32, f1: f32, gain: f32) {
        let n = self.buf.len();
        if n == 0 {
            return;
        }
        let atk = ((v.atk * SR) as usize).max(24);
        let dec = ((v.dec * SR) as usize).max(1);
        let rel = ((v.rel * SR) as usize).max(48);
        let total = dur + rel;
        let vdelay = (v.vib_delay * SR) as usize;
        let lfo_inc = v.vib_hz / SR;
        let mut lfo_p = 0.0f32;
        let mut phase = 0.0f32;
        let mut lfsr: u16 = 1;
        let amp = v.vol * gain;
        for i in 0..total {
            let mut idx = start + i;
            if idx >= n {
                if self.wrap {
                    idx %= n;
                } else {
                    break;
                }
            }
            let mut e = if i < atk {
                i as f32 / atk as f32
            } else if i < atk + dec {
                1.0 - (1.0 - v.sus) * ((i - atk) as f32 / dec as f32)
            } else {
                v.sus
            };
            if i >= dur {
                e *= 1.0 - (i - dur) as f32 / rel as f32;
            }
            let mut f = f0 + (f1 - f0) * (i as f32 / total as f32);
            if v.vib_depth > 0.0 && i >= vdelay {
                lfo_p += lfo_inc;
                lfo_p -= (lfo_p as i32) as f32;
                let lfo = 4.0 * (lfo_p - 0.5).abs() - 1.0;
                f *= 1.0 + v.vib_depth * 0.0578 * lfo;
            }
            phase += f / SR;
            let s = match v.inst {
                Inst::Pulse(d) => {
                    phase -= (phase as i32) as f32;
                    if phase < d {
                        1.0
                    } else {
                        -1.0
                    }
                }
                Inst::Tri => {
                    phase -= (phase as i32) as f32;
                    let q = 4.0 * (phase - 0.5).abs() - 1.0;
                    (q * 7.5).round() / 7.5
                }
                Inst::Noise(short) => {
                    while phase >= 1.0 {
                        phase -= 1.0;
                        let tap = if short { 6 } else { 1 };
                        let fb = (lfsr & 1) ^ ((lfsr >> tap) & 1);
                        lfsr = (lfsr >> 1) | (fb << 14);
                    }
                    if lfsr & 1 == 0 {
                        1.0
                    } else {
                        -1.0
                    }
                }
            };
            self.buf[idx] += s * e * amp;
        }
    }

    /// A drum hit: 'k' kick, 's' snare, 'h' closed hat, 'o' open hat, 't' tom, 'c' crash.
    pub fn drum(&mut self, start: usize, kind: char, gain: f32) {
        const KICK: Voice = Voice::new(Inst::Tri, 1.0, 0.001, 0.1, 0.0, 0.01);
        const SNARE: Voice = Voice::new(Inst::Noise(false), 0.6, 0.001, 0.13, 0.0, 0.02);
        const SNARE_BODY: Voice = Voice::new(Inst::Tri, 0.5, 0.001, 0.07, 0.0, 0.01);
        const HAT: Voice = Voice::new(Inst::Noise(true), 0.3, 0.001, 0.03, 0.0, 0.01);
        const OPEN: Voice = Voice::new(Inst::Noise(true), 0.3, 0.001, 0.16, 0.0, 0.02);
        const TOM: Voice = Voice::new(Inst::Tri, 0.9, 0.001, 0.16, 0.0, 0.01);
        const CRASH: Voice = Voice::new(Inst::Noise(false), 0.4, 0.002, 0.6, 0.0, 0.05);
        match kind {
            'k' => self.tone(start, sec(0.1), &KICK, 170.0, 45.0, gain),
            's' => {
                self.tone(start, sec(0.13), &SNARE, 7000.0, 3500.0, gain);
                self.tone(start, sec(0.07), &SNARE_BODY, 200.0, 130.0, gain);
            }
            'h' => self.tone(start, sec(0.035), &HAT, 15000.0, 15000.0, gain),
            'o' => self.tone(start, sec(0.16), &OPEN, 15000.0, 15000.0, gain),
            't' => self.tone(start, sec(0.16), &TOM, 130.0, 70.0, gain),
            'c' => self.tone(start, sec(0.6), &CRASH, 12000.0, 9000.0, gain),
            _ => {}
        }
    }

    /// Normalise to `peak` (fraction of 24000) and convert to 16-bit with short edge fades (no clicks).
    pub fn finish(self, peak: f32, fade: bool) -> Vec<i16> {
        let max = self.buf.iter().fold(0.0f32, |m, x| m.max(x.abs()));
        let k = if max > 0.0 { peak * 24000.0 / max } else { 0.0 };
        let n = self.buf.len();
        let fl = 48.min(n / 2);
        self.buf
            .iter()
            .enumerate()
            .map(|(i, x)| {
                let mut g = 1.0;
                if fade {
                    if i < fl {
                        g = i as f32 / fl as f32;
                    }
                    if i + fl > n {
                        g = g.min((n - i) as f32 / fl as f32);
                    }
                }
                (x * k * g).clamp(-28000.0, 28000.0) as i16
            })
            .collect()
    }
}

/// Wrap 16-bit mono PCM as a WAV file at `SAMPLE_RATE`.
pub fn wav(pcm: &[i16]) -> Vec<u8> {
    let data_len = (pcm.len() * 2) as u32;
    let mut o = Vec::with_capacity(44 + pcm.len() * 2);
    o.extend_from_slice(b"RIFF");
    o.extend_from_slice(&(36 + data_len).to_le_bytes());
    o.extend_from_slice(b"WAVEfmt ");
    o.extend_from_slice(&16u32.to_le_bytes());
    o.extend_from_slice(&1u16.to_le_bytes()); // PCM
    o.extend_from_slice(&1u16.to_le_bytes()); // mono
    o.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    o.extend_from_slice(&(SAMPLE_RATE * 2).to_le_bytes());
    o.extend_from_slice(&2u16.to_le_bytes());
    o.extend_from_slice(&16u16.to_le_bytes());
    o.extend_from_slice(b"data");
    o.extend_from_slice(&data_len.to_le_bytes());
    for s in pcm {
        o.extend_from_slice(&s.to_le_bytes());
    }
    o
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wav_header_is_valid() {
        let w = wav(&[1, -1, 2, -2]);
        assert_eq!(&w[0..4], b"RIFF");
        assert_eq!(&w[8..16], b"WAVEfmt ");
        assert_eq!(u32::from_le_bytes(w[4..8].try_into().unwrap()) as usize, w.len() - 8);
        assert_eq!(u32::from_le_bytes(w[40..44].try_into().unwrap()), 8);
        assert_eq!(u32::from_le_bytes(w[24..28].try_into().unwrap()), SAMPLE_RATE);
        assert_eq!(w.len(), 44 + 8);
    }

    #[test]
    fn midi_pitch() {
        assert!((midi_hz(69.0) - 440.0).abs() < 0.01);
        assert!((midi_hz(81.0) - 880.0).abs() < 0.05);
    }

    #[test]
    fn tone_is_wrapped_in_loops_and_cut_in_oneshots() {
        let v = Voice::new(Inst::Pulse(0.5), 1.0, 0.001, 0.0, 1.0, 0.05);
        let mut a = Mix::new(1000, true);
        a.tone(900, 500, &v, 440.0, 440.0, 1.0);
        assert!(a.buf[..200].iter().any(|x| *x != 0.0));
        let mut b = Mix::new(1000, false);
        b.tone(900, 500, &v, 440.0, 440.0, 1.0);
        assert!(b.buf[..200].iter().all(|x| *x == 0.0));
    }

    #[test]
    fn finish_normalises_and_fades() {
        let mut m = Mix::new(2000, false);
        for (i, x) in m.buf.iter_mut().enumerate() {
            *x = if i % 2 == 0 { 3.0 } else { -3.0 };
        }
        let p = m.finish(0.5, true);
        assert_eq!(p[0], 0);
        assert!(p[1999].abs() < 800);
        assert!(p.iter().map(|x| x.abs()).max().unwrap() <= 12001);
    }
}
