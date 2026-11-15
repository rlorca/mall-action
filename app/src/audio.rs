//! Audio output: a Bevy `Decodable` source that pulls mono samples from the shared core `Synth`.
//! The synth is stepped by the game thread via `apply(&Event)`; the audio thread only calls `render`.

use bevy::audio::{ChannelCount, Decodable, SampleRate, Source};
use bevy::prelude::*;
use bevy::reflect::TypePath;
use mall_core::audio::Synth;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

pub const SAMPLE_RATE: u32 = 44_100;
const BLOCK: usize = 512;
/// Master gain (the synth is already soft-clipped).
const GAIN: f32 = 0.55;

#[derive(Asset, TypePath, Clone)]
pub struct SynthSource {
    pub synth: Arc<Mutex<Synth>>,
    pub muted: Arc<AtomicBool>,
}

pub struct SynthDecoder {
    src: SynthSource,
    buf: Vec<f32>,
    pos: usize,
}

impl Iterator for SynthDecoder {
    type Item = f32;
    fn next(&mut self) -> Option<f32> {
        if self.pos >= self.buf.len() {
            self.buf.resize(BLOCK, 0.0);
            match self.src.synth.lock() {
                Ok(mut s) => s.render(&mut self.buf),
                Err(_) => self.buf.iter_mut().for_each(|x| *x = 0.0),
            }
            if self.src.muted.load(Ordering::Relaxed) {
                self.buf.iter_mut().for_each(|x| *x = 0.0);
            } else {
                self.buf.iter_mut().for_each(|x| *x *= GAIN);
            }
            self.pos = 0;
        }
        let v = self.buf[self.pos];
        self.pos += 1;
        Some(v)
    }
}

impl Source for SynthDecoder {
    fn current_span_len(&self) -> Option<usize> {
        None
    }
    fn channels(&self) -> ChannelCount {
        ChannelCount::new(1).unwrap()
    }
    fn sample_rate(&self) -> SampleRate {
        SampleRate::new(SAMPLE_RATE).unwrap()
    }
    fn total_duration(&self) -> Option<Duration> {
        None
    }
}

impl Decodable for SynthSource {
    type Decoder = SynthDecoder;
    fn decoder(&self) -> Self::Decoder {
        SynthDecoder { src: self.clone(), buf: Vec::new(), pos: 0 }
    }
}
