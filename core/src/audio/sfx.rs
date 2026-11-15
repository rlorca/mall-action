//! Sound effects: short NES-style blips, sweeps and noise bursts built from the synth primitives.
use super::synth::{sec, Inst, Mix, Voice, SR};
use super::Sfx;

const fn p(duty: f32, vol: f32, a: f32, d: f32, s: f32, r: f32) -> Voice {
    Voice::new(Inst::Pulse(duty), vol, a, d, s, r)
}
const fn tri(vol: f32, a: f32, d: f32, s: f32, r: f32) -> Voice {
    Voice::new(Inst::Tri, vol, a, d, s, r)
}
const fn noise(short: bool, vol: f32, a: f32, d: f32, s: f32, r: f32) -> Voice {
    Voice::new(Inst::Noise(short), vol, a, d, s, r)
}

pub fn sfx_loops(s: Sfx) -> bool {
    matches!(s, Sfx::Hum)
}

/// Note shorthand: start/dur in seconds.
fn t(m: &mut Mix, start: f32, dur: f32, v: &Voice, f0: f32, f1: f32, gain: f32) {
    m.tone(sec(start), sec(dur), v, f0, f1, gain);
}

/// Bell-ish tone: fundamental + inharmonic-ish overtone, exponential-feeling decay.
fn bell(m: &mut Mix, start: f32, hz: f32, len: f32, gain: f32) {
    let a = tri(1.0, 0.002, len, 0.0, 0.05);
    let b = p(0.5, 0.35, 0.002, len * 0.5, 0.0, 0.03);
    t(m, start, len, &a, hz, hz, gain);
    t(m, start, len * 0.5, &b, hz * 2.0, hz * 2.0, gain);
    t(m, start, len * 0.3, &b, hz * 3.01, hz * 3.01, gain * 0.5);
}

pub fn render_sfx(s: Sfx) -> Vec<i16> {
    use Sfx::*;
    match s {
        Hum => return hum(),
        _ => {}
    }
    let len = match s {
        Zip => 1.3,
        Package => 1.4,
        Death => 1.0,
        Crush | Glass | Smoke | PaChime | Ding | Whistle | Coins | Camera | Shriek | Roll | PowerUp => 1.0,
        _ => 0.7,
    };
    let mut m = Mix::new(sec(len), false);
    let mut peak = 0.65;
    match s {
        Shot => {
            t(&mut m, 0.0, 0.11, &p(0.25, 1.0, 0.001, 0.11, 0.0, 0.01), 1900.0, 320.0, 1.0);
            t(&mut m, 0.0, 0.04, &noise(true, 0.5, 0.001, 0.04, 0.0, 0.01), 9000.0, 6000.0, 1.0);
        }
        EnemyShot => {
            t(&mut m, 0.0, 0.16, &p(0.125, 1.0, 0.001, 0.16, 0.0, 0.01), 750.0, 140.0, 1.0);
            t(&mut m, 0.0, 0.08, &noise(false, 0.4, 0.001, 0.08, 0.0, 0.01), 3500.0, 1500.0, 1.0);
            peak = 0.6;
        }
        Jump => {
            t(&mut m, 0.0, 0.18, &p(0.5, 1.0, 0.002, 0.18, 0.3, 0.02), 280.0, 900.0, 1.0);
            peak = 0.55;
        }
        Land => {
            t(&mut m, 0.0, 0.12, &tri(1.0, 0.001, 0.12, 0.0, 0.01), 130.0, 45.0, 1.0);
            t(&mut m, 0.0, 0.05, &noise(false, 0.5, 0.001, 0.05, 0.0, 0.01), 2500.0, 900.0, 1.0);
        }
        Ding => {
            bell(&mut m, 0.0, 1318.5, 0.85, 1.0);
            peak = 0.6;
        }
        Crush => {
            t(&mut m, 0.0, 0.4, &noise(false, 1.0, 0.001, 0.4, 0.0, 0.02), 3200.0, 350.0, 1.0);
            t(&mut m, 0.0, 0.35, &tri(1.0, 0.001, 0.35, 0.0, 0.02), 95.0, 38.0, 1.0);
            t(&mut m, 0.12, 0.15, &noise(true, 0.7, 0.001, 0.15, 0.0, 0.02), 1800.0, 600.0, 1.0);
            peak = 0.8;
        }
        LampFall => {
            t(&mut m, 0.0, 0.5, &p(0.5, 0.8, 0.01, 0.5, 0.6, 0.02), 1500.0, 160.0, 1.0);
            t(&mut m, 0.0, 0.5, &p(0.25, 0.4, 0.01, 0.5, 0.6, 0.02), 1480.0, 150.0, 1.0);
            peak = 0.5;
        }
        Glass => {
            for (i, (st, hz)) in [(0.0, 4200.0), (0.03, 3300.0), (0.07, 5200.0), (0.11, 3900.0), (0.16, 4700.0), (0.22, 3500.0)]
                .iter()
                .enumerate()
            {
                t(&mut m, *st, 0.12, &p(0.125, 0.5, 0.001, 0.12, 0.0, 0.01), *hz, *hz * 0.97, 1.0 - i as f32 * 0.1);
            }
            t(&mut m, 0.0, 0.3, &noise(true, 0.6, 0.001, 0.3, 0.0, 0.02), 14000.0, 9000.0, 1.0);
            peak = 0.6;
        }
        SearchTick => {
            t(&mut m, 0.0, 0.025, &p(0.5, 1.0, 0.001, 0.025, 0.0, 0.005), 1300.0, 1100.0, 1.0);
            peak = 0.35;
        }
        Package => {
            let v = p(0.5, 0.7, 0.003, 0.05, 0.7, 0.05);
            let h = p(0.25, 0.4, 0.003, 0.05, 0.7, 0.05);
            let b = tri(0.9, 0.003, 0.0, 1.0, 0.05);
            let notes = [(0.0, 392.0), (0.1, 523.3), (0.2, 659.3), (0.3, 784.0), (0.5, 659.3), (0.6, 784.0)];
            for (st, hz) in notes {
                t(&mut m, st, 0.09, &v, hz, hz, 1.0);
                t(&mut m, st, 0.09, &h, hz * 1.5, hz * 1.5, 0.7);
            }
            t(&mut m, 0.75, 0.55, &v, 1046.5, 1046.5, 1.0);
            t(&mut m, 0.75, 0.55, &h, 784.0, 784.0, 1.0);
            t(&mut m, 0.75, 0.55, &b, 130.8, 130.8, 1.0);
        }
        PowerUp => {
            let v = p(0.25, 1.0, 0.002, 0.04, 0.6, 0.02);
            for (i, hz) in [330.0, 415.3, 523.3, 659.3, 830.6, 1046.5].iter().enumerate() {
                t(&mut m, i as f32 * 0.065, 0.06, &v, *hz, *hz, 1.0);
            }
            t(&mut m, 0.4, 0.3, &p(0.5, 0.8, 0.002, 0.3, 0.0, 0.05), 1318.5, 1568.0, 1.0);
        }
        Hurt => {
            t(&mut m, 0.0, 0.25, &p(0.5, 1.0, 0.001, 0.25, 0.5, 0.03).vib(18.0, 1.2, 0.0), 620.0, 150.0, 1.0);
            t(&mut m, 0.0, 0.12, &noise(false, 0.5, 0.001, 0.12, 0.0, 0.02), 4000.0, 1500.0, 1.0);
        }
        Death => {
            t(&mut m, 0.0, 0.8, &p(0.25, 1.0, 0.002, 0.8, 0.6, 0.05).vib(9.0, 1.5, 0.15), 880.0, 55.0, 1.0);
            t(&mut m, 0.0, 0.8, &tri(0.8, 0.002, 0.8, 0.5, 0.05), 440.0, 28.0, 1.0);
            t(&mut m, 0.7, 0.2, &noise(false, 0.6, 0.001, 0.2, 0.0, 0.05), 3000.0, 400.0, 1.0);
        }
        Door => {
            t(&mut m, 0.0, 0.05, &noise(false, 0.7, 0.001, 0.05, 0.0, 0.01), 1400.0, 500.0, 1.0);
            t(&mut m, 0.0, 0.1, &tri(1.0, 0.001, 0.1, 0.0, 0.01), 210.0, 90.0, 1.0);
            t(&mut m, 0.13, 0.06, &noise(false, 0.5, 0.001, 0.06, 0.0, 0.01), 900.0, 400.0, 1.0);
            t(&mut m, 0.13, 0.08, &tri(0.8, 0.001, 0.08, 0.0, 0.01), 150.0, 70.0, 1.0);
            peak = 0.6;
        }
        TextBlip => {
            t(&mut m, 0.0, 0.012, &noise(true, 0.5, 0.001, 0.012, 0.0, 0.004), 7000.0, 6000.0, 1.0);
            t(&mut m, 0.0, 0.02, &p(0.5, 0.6, 0.001, 0.02, 0.0, 0.005), 980.0, 940.0, 1.0);
            peak = 0.3;
        }
        Whistle => {
            // Pea whistle: a high tone with a fast trill (vibrato) and breath noise.
            t(&mut m, 0.0, 0.55, &p(0.5, 0.8, 0.02, 0.1, 0.8, 0.06).vib(26.0, 2.2, 0.0), 2900.0, 2900.0, 1.0);
            t(&mut m, 0.0, 0.55, &noise(true, 0.15, 0.02, 0.1, 0.8, 0.06), 14000.0, 14000.0, 1.0);
            peak = 0.5;
        }
        HelmetPing => {
            t(&mut m, 0.0, 0.18, &p(0.5, 0.8, 0.001, 0.18, 0.0, 0.02), 3136.0, 3136.0, 1.0);
            t(&mut m, 0.0, 0.12, &p(0.125, 0.4, 0.001, 0.12, 0.0, 0.02), 4699.0, 4699.0, 1.0);
            peak = 0.5;
        }
        Coins => {
            let v = p(0.5, 1.0, 0.001, 0.05, 0.8, 0.02);
            t(&mut m, 0.0, 0.07, &v, 880.0, 880.0, 1.0);
            t(&mut m, 0.07, 0.5, &p(0.5, 1.0, 0.001, 0.4, 0.0, 0.05), 1174.7, 1174.7, 1.0);
            t(&mut m, 0.07, 0.4, &p(0.25, 0.4, 0.001, 0.3, 0.0, 0.05), 2349.3, 2349.3, 1.0);
            peak = 0.55;
        }
        Zip => {
            t(&mut m, 0.0, 0.6, &p(0.125, 0.8, 0.05, 0.6, 0.6, 0.05).vib(14.0, 0.7, 0.0), 420.0, 2300.0, 1.0);
            t(&mut m, 0.6, 0.6, &p(0.125, 0.8, 0.01, 0.6, 0.5, 0.1).vib(14.0, 0.7, 0.0), 2300.0, 600.0, 1.0);
            t(&mut m, 0.0, 1.2, &noise(true, 0.22, 0.1, 0.5, 0.6, 0.1), 9000.0, 12000.0, 1.0);
            peak = 0.5;
        }
        PaChime => {
            bell(&mut m, 0.0, 1318.5, 0.45, 1.0);
            bell(&mut m, 0.42, 1046.5, 0.55, 1.0);
            peak = 0.55;
        }
        Smoke => {
            t(&mut m, 0.0, 0.5, &noise(false, 1.0, 0.06, 0.5, 0.2, 0.2), 4500.0, 1400.0, 1.0);
            peak = 0.4;
        }
        Shriek => {
            t(&mut m, 0.0, 0.7, &p(0.25, 1.0, 0.01, 0.7, 0.8, 0.08).vib(15.0, 1.6, 0.0), 1200.0, 2500.0, 1.0);
            t(&mut m, 0.0, 0.7, &p(0.5, 0.5, 0.01, 0.7, 0.8, 0.08).vib(13.0, 1.4, 0.0), 1210.0, 2520.0, 1.0);
            peak = 0.55;
        }
        Buzzer => {
            let v = p(0.25, 1.0, 0.002, 0.0, 1.0, 0.01);
            for st in [0.0, 0.22] {
                t(&mut m, st, 0.17, &v, 98.0, 98.0, 1.0);
                t(&mut m, st, 0.17, &v, 103.0, 103.0, 0.8);
                t(&mut m, st, 0.17, &noise(true, 0.15, 0.002, 0.0, 1.0, 0.01), 2500.0, 2500.0, 1.0);
            }
            peak = 0.6;
        }
        Pause => {
            let v = p(0.5, 1.0, 0.001, 0.05, 0.6, 0.01);
            t(&mut m, 0.0, 0.06, &v, 988.0, 988.0, 1.0);
            t(&mut m, 0.08, 0.1, &v, 659.0, 659.0, 1.0);
            peak = 0.45;
        }
        Beep => {
            t(&mut m, 0.0, 0.12, &p(0.5, 1.0, 0.002, 0.0, 1.0, 0.01), 880.0, 880.0, 1.0);
            peak = 0.5;
        }
        Camera => {
            t(&mut m, 0.0, 0.02, &noise(false, 0.9, 0.001, 0.02, 0.0, 0.005), 6000.0, 3000.0, 1.0);
            t(&mut m, 0.05, 0.04, &noise(false, 0.8, 0.001, 0.04, 0.0, 0.005), 3000.0, 1500.0, 1.0);
            t(&mut m, 0.1, 0.45, &tri(0.8, 0.005, 0.45, 0.0, 0.05), 4200.0, 2200.0, 1.0);
            t(&mut m, 0.1, 0.1, &p(0.125, 0.5, 0.002, 0.1, 0.0, 0.02), 3500.0, 3500.0, 1.0);
            peak = 0.5;
        }
        Step => {
            t(&mut m, 0.0, 0.02, &noise(false, 0.8, 0.001, 0.02, 0.0, 0.005), 900.0, 500.0, 1.0);
            peak = 0.15;
        }
        Roll => {
            t(&mut m, 0.0, 0.6, &noise(false, 0.7, 0.05, 0.4, 0.6, 0.08).vib(12.0, 4.0, 0.0), 700.0, 500.0, 1.0);
            t(&mut m, 0.0, 0.6, &tri(0.6, 0.05, 0.4, 0.6, 0.08), 70.0, 60.0, 1.0);
            peak = 0.5;
        }
        Select => {
            let v = p(0.5, 1.0, 0.001, 0.05, 0.7, 0.02);
            t(&mut m, 0.0, 0.06, &v, 660.0, 660.0, 1.0);
            t(&mut m, 0.07, 0.12, &v, 990.0, 990.0, 1.0);
            peak = 0.5;
        }
        Hum => unreachable!(),
    }
    m.finish(peak, true)
}

/// Seamless 1 s low elevator hum: every component has a whole number of cycles per loop.
fn hum() -> Vec<i16> {
    let n = SR as usize;
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let ph = i as f32 / n as f32;
        let a = {
            let x = (ph * 55.0).fract();
            let q = 4.0 * (x - 0.5).abs() - 1.0;
            (q * 7.5).round() / 7.5
        };
        let b = if (ph * 110.0).fract() < 0.25 { 1.0 } else { -1.0 };
        let wob = 4.0 * ((ph * 3.0).fract() - 0.5).abs() - 1.0;
        let v = (a * 0.8 + b * 0.12) * (0.85 + 0.15 * wob);
        out.push((v * 4200.0) as i16);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::super::all_sfx;
    use super::*;

    #[test]
    fn every_sfx_renders_audible_and_unclipped() {
        for s in all_sfx() {
            let pcm = render_sfx(s);
            assert!(pcm.len() > 200, "{s:?} too short");
            assert!(pcm.len() <= 33075, "{s:?} too long ({})", pcm.len());
            let peak = pcm.iter().map(|x| (*x as i32).abs()).max().unwrap();
            assert!(peak > 500, "{s:?} silent (peak {peak})");
            assert!(peak < 28000, "{s:?} clips (peak {peak})");
        }
    }

    #[test]
    fn only_hum_loops_and_it_is_seamless() {
        for s in all_sfx() {
            assert_eq!(sfx_loops(s), s == Sfx::Hum);
        }
        let h = render_sfx(Sfx::Hum);
        let jump = (h[0] as i32 - *h.last().unwrap() as i32).abs();
        let max_adj = h.windows(2).map(|w| (w[1] as i32 - w[0] as i32).abs()).max().unwrap();
        assert!(jump <= max_adj * 2, "hum seam jump {jump} > {max_adj}");
    }

    #[test]
    fn sfx_are_deterministic_and_distinct() {
        let mut hashes = std::collections::HashSet::new();
        for s in all_sfx() {
            let a = render_sfx(s);
            assert_eq!(a, render_sfx(s));
            let h: u64 = a.iter().fold(1469598103934665603u64, |h, x| (h ^ (*x as u16 as u64)).wrapping_mul(1099511628211));
            assert!(hashes.insert(h), "{s:?} duplicates another sfx");
        }
    }

    #[test]
    fn sfx_end_quietly() {
        for s in all_sfx() {
            if s == Sfx::Hum {
                continue;
            }
            let pcm = render_sfx(s);
            assert!(pcm.last().unwrap().abs() < 200, "{s:?} ends loudly");
        }
    }
}
