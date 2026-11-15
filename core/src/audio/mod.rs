//! NES-style chiptune synthesiser (audio agent owns this module): two pulse channels, a triangle and noise,
//! rendered to mono f32 samples. The host asks it for samples; the rules only emit `Event`s.

use crate::events::{Event, Sfx, Track};

pub struct Synth {
    #[allow(dead_code)]
    sample_rate: u32,
}

impl Synth {
    pub fn new(sample_rate: u32) -> Synth {
        Synth { sample_rate }
    }
    pub fn apply(&mut self, e: &Event) {
        match *e {
            Event::Sfx(s) => self.play_sfx(s),
            Event::Music(t) => self.set_track(t),
            Event::Hum(on) => self.set_hum(on),
            Event::MusicVolume(v) => self.set_music_volume(v),
        }
    }
    pub fn set_track(&mut self, _t: Track) {}
    pub fn play_sfx(&mut self, _s: Sfx) {}
    pub fn set_hum(&mut self, _on: bool) {}
    pub fn set_music_volume(&mut self, _v: f32) {}
    /// Fill `out` with mono samples in -1.0..=1.0.
    pub fn render(&mut self, out: &mut [f32]) {
        out.iter_mut().for_each(|s| *s = 0.0);
    }
}
