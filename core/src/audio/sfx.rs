//! Sound-effect definitions: each SFX is a few "parts", each part drives one hardware-style voice (pulse,
//! triangle or noise) through a list of segments (linear volume ramp + exponential pitch sweep).

use crate::events::Sfx;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Kind {
    Pulse,
    Tri,
    Noise,
}

/// `f0`/`f1` in Hz (noise: LFSR clock rate), `v0`/`v1` volume 0..1, `ms` length. `v0 == v1 == 0` is a rest.
#[derive(Clone, Copy, Debug)]
pub struct Seg {
    pub ms: f32,
    pub f0: f32,
    pub f1: f32,
    pub v0: f32,
    pub v1: f32,
    pub duty: u8,
}

#[derive(Clone, Debug)]
pub struct Part {
    pub kind: Kind,
    pub short: bool,
    pub segs: Vec<Seg>,
    duty: u8,
}

impl Part {
    fn new(kind: Kind, duty: u8, short: bool) -> Part {
        Part { kind, short, segs: Vec::new(), duty }
    }
    /// Change duty for following segments.
    fn d(mut self, duty: u8) -> Part {
        self.duty = duty;
        self
    }
    fn sweep(mut self, ms: f32, f0: f32, f1: f32, v0: f32, v1: f32) -> Part {
        self.segs.push(Seg { ms, f0, f1, v0, v1, duty: self.duty });
        self
    }
    fn tone(self, ms: f32, f: f32, v0: f32, v1: f32) -> Part {
        self.sweep(ms, f, f, v0, v1)
    }
    fn rest(self, ms: f32) -> Part {
        self.sweep(ms, 100.0, 100.0, 0.0, 0.0)
    }
    /// Sequence of equal-length tones, volume falling linearly from `v0` to `v1` over the whole run.
    fn run(mut self, freqs: &[f32], step_ms: f32, v0: f32, v1: f32) -> Part {
        let n = freqs.len() as f32;
        for (i, f) in freqs.iter().enumerate() {
            let a = v0 + (v1 - v0) * i as f32 / n;
            let b = v0 + (v1 - v0) * (i as f32 + 1.0) / n;
            self.segs.push(Seg { ms: step_ms, f0: *f, f1: *f, v0: a, v1: b, duty: self.duty });
        }
        self
    }
    pub fn total_ms(&self) -> f32 {
        self.segs.iter().map(|s| s.ms).sum()
    }
}

fn pulse(duty: u8) -> Part {
    Part::new(Kind::Pulse, duty, false)
}
fn tri() -> Part {
    Part::new(Kind::Tri, 0, false)
}
fn noise() -> Part {
    Part::new(Kind::Noise, 0, false)
}
fn snoise() -> Part {
    Part::new(Kind::Noise, 0, true)
}

// Note frequencies (Hz).
const C4: f32 = 261.63;
const E4: f32 = 329.63;
const G4: f32 = 392.0;
const C5: f32 = 523.25;
const D5: f32 = 587.33;
const E5: f32 = 659.25;
const F5: f32 = 698.46;
const G5: f32 = 783.99;
const A5: f32 = 880.0;
const B5: f32 = 987.77;
const C6: f32 = 1046.5;
const D6: f32 = 1174.7;
const E6: f32 = 1318.5;
const G6: f32 = 1568.0;
const C7: f32 = 2093.0;
const E7: f32 = 2637.0;

pub fn parts(s: Sfx) -> Vec<Part> {
    use Sfx::*;
    match s {
        Shot => vec![pulse(1).sweep(90.0, 1900.0, 260.0, 0.9, 0.0), snoise().tone(25.0, 30000.0, 0.6, 0.0)],
        EnemyShot => vec![pulse(0).sweep(110.0, 800.0, 210.0, 0.8, 0.0), tri().sweep(100.0, 400.0, 100.0, 0.5, 0.0)],
        Jump => vec![pulse(2).sweep(70.0, 260.0, 520.0, 0.6, 0.5).sweep(60.0, 520.0, 780.0, 0.5, 0.0)],
        Land => vec![noise().sweep(55.0, 1500.0, 300.0, 0.6, 0.0), tri().sweep(100.0, 120.0, 55.0, 0.8, 0.2)],
        Ding => vec![
            pulse(2).tone(130.0, 1568.0, 0.7, 0.5).tone(520.0, 1175.0, 0.7, 0.0),
            pulse(3).rest(2.0).tone(130.0, 3136.0, 0.2, 0.1).tone(380.0, 2350.0, 0.2, 0.0),
        ],
        Crush => vec![
            noise().sweep(180.0, 900.0, 300.0, 1.0, 0.8).sweep(320.0, 300.0, 70.0, 0.8, 0.0),
            tri().sweep(450.0, 110.0, 30.0, 1.0, 0.2),
        ],
        LampFall => vec![
            pulse(1).sweep(560.0, 2100.0, 260.0, 0.45, 0.35).rest(5.0),
            noise().rest(560.0).sweep(260.0, 3500.0, 300.0, 0.9, 0.0),
            tri().rest(560.0).sweep(200.0, 140.0, 40.0, 1.0, 0.0),
        ],
        Glass => vec![
            snoise().sweep(140.0, 14000.0, 9000.0, 0.8, 0.0),
            pulse(0).run(&[3100.0, 4300.0, 3600.0, 5300.0, 2900.0, 4700.0, 3900.0, 5600.0], 28.0, 0.6, 0.0),
        ],
        SearchTick => vec![pulse(2).tone(18.0, 1800.0, 0.6, 0.0)],
        PackageFanfare => vec![
            pulse(1).run(&[C5, E5, G5, C6], 90.0, 0.8, 0.6).tone(140.0, G5, 0.7, 0.6).tone(120.0, A5, 0.7, 0.6).tone(560.0, C6, 0.8, 0.0)
                .rest(0.0),
            pulse(2).run(&[G4, C5, E5, G5], 90.0, 0.5, 0.4).tone(140.0, E5, 0.5, 0.4).tone(120.0, F5, 0.5, 0.4).tone(560.0, E5, 0.5, 0.0),
            tri().tone(360.0, C4, 1.0, 1.0).tone(260.0, 349.23, 1.0, 1.0).tone(560.0, C4, 1.0, 0.0),
        ],
        PowerUp => vec![pulse(1).run(&[C5, E5, G5, C6, E6, G6, C7, E7], 38.0, 0.8, 0.2).tone(160.0, E7, 0.4, 0.0)],
        Hurt => vec![pulse(1).sweep(200.0, 620.0, 130.0, 0.9, 0.0), noise().tone(30.0, 9000.0, 0.7, 0.0)],
        Death => vec![
            pulse(2).run(&[A5, F5, D5, B5 / 2.0, G4, E4, C4], 95.0, 0.8, 0.5).sweep(380.0, 262.0, 62.0, 0.5, 0.0),
            tri().rest(200.0).sweep(750.0, 220.0, 40.0, 1.0, 0.0),
        ],
        Door => vec![
            noise().sweep(60.0, 800.0, 200.0, 0.8, 0.0).rest(90.0).sweep(40.0, 5000.0, 1500.0, 0.5, 0.0),
            tri().sweep(60.0, 110.0, 70.0, 1.0, 0.0),
        ],
        TextBlip => vec![pulse(2).tone(24.0, 900.0, 0.45, 0.15)],
        Whistle => vec![
            pulse(2).run(&[2600.0, 2950.0, 2600.0, 2950.0, 2600.0, 2950.0, 2600.0, 2950.0, 2600.0, 2950.0, 2600.0, 2950.0], 24.0, 0.55, 0.25)
                .tone(110.0, 2800.0, 0.25, 0.0),
            snoise().tone(300.0, 24000.0, 0.12, 0.0),
        ],
        HelmetPing => vec![pulse(3).sweep(160.0, 3520.0, 3400.0, 0.7, 0.0), pulse(2).tone(70.0, 5274.0, 0.25, 0.0)],
        Coins => vec![pulse(2).tone(65.0, G6, 0.7, 0.6).tone(320.0, C7, 0.7, 0.0), pulse(3).rest(65.0).tone(250.0, C7 * 2.0, 0.15, 0.0)],
        Zip => vec![
            pulse(1).sweep(450.0, 300.0, 1800.0, 0.3, 0.45).sweep(450.0, 1800.0, 400.0, 0.45, 0.0),
            snoise().sweep(900.0, 14000.0, 30000.0, 0.14, 0.14),
        ],
        PaChime => vec![pulse(2).tone(300.0, G5, 0.5, 0.35).tone(520.0, E5, 0.5, 0.0), tri().tone(300.0, G4, 0.8, 0.8).tone(520.0, E4, 0.8, 0.0)],
        Smoke => vec![noise().sweep(120.0, 3800.0, 3200.0, 0.1, 0.55).sweep(300.0, 3200.0, 1500.0, 0.55, 0.0)],
        Shriek => vec![pulse(0).run(&[2400.0, 3100.0, 2400.0, 3100.0, 2500.0, 3300.0, 2500.0, 3300.0, 2700.0, 3500.0], 22.0, 0.7, 0.2).tone(80.0, 3000.0, 0.2, 0.0)],
        Buzzer => vec![pulse(1).tone(150.0, 140.0, 0.8, 0.8).rest(40.0).tone(220.0, 120.0, 0.8, 0.0), snoise().tone(150.0, 700.0, 0.25, 0.2)],
        Pause => vec![pulse(2).sweep(60.0, 988.0, 659.0, 0.6, 0.6).sweep(110.0, 659.0, 1319.0, 0.6, 0.0)],
        Beep => vec![pulse(2).tone(110.0, 880.0, 0.6, 0.55)],
        Flash => vec![
            snoise().tone(55.0, 40000.0, 0.9, 0.0).rest(35.0).tone(30.0, 20000.0, 0.5, 0.0),
            pulse(1).sweep(130.0, 4000.0, 500.0, 0.5, 0.0),
        ],
        ExtraLife => vec![
            pulse(1).run(&[C5, E5, G5, C6, G5, C6, E6, G6], 62.0, 0.8, 0.5).sweep(380.0, G6, C7, 0.7, 0.0),
            pulse(2).rest(62.0).run(&[C4 * 2.0, E4 * 2.0, G4 * 2.0, C5, G4 * 2.0, C5, E5], 62.0, 0.35, 0.2).tone(380.0, E6, 0.3, 0.0),
        ],
        Kick => vec![pulse(2).sweep(85.0, 230.0, 55.0, 0.9, 0.0), noise().sweep(70.0, 1500.0, 300.0, 0.6, 0.0)],
        Splat => vec![noise().sweep(150.0, 3000.0, 400.0, 0.9, 0.0), pulse(1).sweep(110.0, 300.0, 80.0, 0.6, 0.0)],
        MenuBlip => vec![pulse(2).tone(45.0, E6, 0.55, 0.3)],
        Alarm => vec![pulse(2).sweep(220.0, 600.0, 1200.0, 0.6, 0.6).sweep(220.0, 1200.0, 600.0, 0.6, 0.6).sweep(220.0, 600.0, 1200.0, 0.6, 0.0)],
        Thud => vec![tri().sweep(130.0, 100.0, 48.0, 1.0, 0.2), noise().sweep(60.0, 400.0, 150.0, 0.6, 0.0)],
        Fall => vec![pulse(2).sweep(700.0, 1200.0, 150.0, 0.5, 0.3), noise().rest(700.0).sweep(90.0, 1000.0, 300.0, 0.6, 0.0)],
        Trap => vec![
            pulse(0).sweep(50.0, 2500.0, 400.0, 0.8, 0.0),
            noise().tone(40.0, 3000.0, 0.8, 0.0).rest(30.0).sweep(90.0, 1000.0, 200.0, 0.8, 0.0),
        ],
        Tick => vec![snoise().tone(10.0, 5000.0, 0.7, 0.0), pulse(3).tone(10.0, 1200.0, 0.3, 0.0)],
    }
}

pub fn all_sfx() -> Vec<Sfx> {
    use Sfx::*;
    vec![
        Shot, EnemyShot, Jump, Land, Ding, Crush, LampFall, Glass, SearchTick, PackageFanfare, PowerUp, Hurt, Death, Door,
        TextBlip, Whistle, HelmetPing, Coins, Zip, PaChime, Smoke, Shriek, Buzzer, Pause, Beep, Flash, ExtraLife, Kick,
        Splat, MenuBlip, Alarm, Thud, Fall, Trap, Tick,
    ]
}
