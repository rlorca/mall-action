//! Audio playback: the core synthesises PCM; we wrap it as WAV and hand it to macroquad.
//! Nothing plays until the first user input (browser autoplay rules).
use macroquad::audio::{load_sound_from_bytes, play_sound, set_sound_volume, stop_sound, PlaySoundParams, Sound};
use mall_core::audio::{self, Sfx, Song};
use mall_core::game::Game;
use std::collections::HashMap;

pub struct Audio {
    songs: HashMap<Song, Sound>,
    sfx: HashMap<Sfx, Sound>,
    cur: Option<Song>,
    started: bool,
    hum: bool,
    unlocked: bool,
    muted: bool,
    last_vol: f32,
    pending: Vec<Sfx>,
}

const MUSIC_GAIN: f32 = 0.55;
const SFX_GAIN: f32 = 0.8;

impl Audio {
    pub fn new() -> Audio {
        Audio {
            songs: HashMap::new(),
            sfx: HashMap::new(),
            cur: None,
            started: false,
            hum: false,
            unlocked: false,
            muted: false,
            last_vol: 1.0,
            pending: vec![],
        }
    }
    pub fn unlock(&mut self) {
        self.unlocked = true;
    }
    pub fn unlocked(&self) -> bool {
        self.unlocked
    }
    pub fn muted(&self) -> bool {
        self.muted
    }
    /// Returns the new muted state.
    pub fn toggle_mute(&mut self) -> bool {
        self.muted = !self.muted;
        if self.muted {
            if let Some(s) = self.cur.and_then(|s| self.songs.get(&s)) {
                stop_sound(s);
            }
            if let Some(h) = self.sfx.get(&Sfx::Hum) {
                stop_sound(h);
            }
            self.started = false;
            self.hum = false;
        }
        self.muted
    }
    pub fn sfx(&mut self, list: Vec<Sfx>) {
        self.pending.extend(list);
    }

    pub async fn update(&mut self, game: &Game) {
        let pending = std::mem::take(&mut self.pending);
        if !self.unlocked || self.muted {
            return;
        }
        // ---- music ----
        let want = game.song();
        if want != self.cur || (!self.started && want.is_some()) {
            if let Some(old) = self.cur.and_then(|s| self.songs.get(&s)) {
                stop_sound(old);
            }
            self.cur = want;
            self.started = false;
        }
        if let (Some(song), false) = (self.cur, self.started) {
            if !self.songs.contains_key(&song) {
                let wav = audio::wav(&audio::render_song(song));
                if let Ok(s) = load_sound_from_bytes(&wav).await {
                    self.songs.insert(song, s);
                }
            }
            if let Some(s) = self.songs.get(&song) {
                let vol = game.music_volume();
                play_sound(s, PlaySoundParams { looped: audio::song_loops(song), volume: MUSIC_GAIN * vol });
                self.last_vol = vol;
                self.started = true;
            }
        }
        if self.started {
            let vol = game.music_volume();
            if (vol - self.last_vol).abs() > 0.01 {
                if let Some(s) = self.cur.and_then(|s| self.songs.get(&s)) {
                    set_sound_volume(s, MUSIC_GAIN * vol);
                }
                self.last_vol = vol;
            }
        }
        // ---- elevator hum ----
        let hum = game.hum();
        if hum != self.hum {
            if !self.sfx.contains_key(&Sfx::Hum) {
                let wav = audio::wav(&audio::render_sfx(Sfx::Hum));
                if let Ok(s) = load_sound_from_bytes(&wav).await {
                    self.sfx.insert(Sfx::Hum, s);
                }
            }
            if let Some(h) = self.sfx.get(&Sfx::Hum) {
                if hum {
                    play_sound(h, PlaySoundParams { looped: true, volume: 0.35 });
                } else {
                    stop_sound(h);
                }
            }
            self.hum = hum;
        }
        // ---- sound effects (one of each kind per frame) ----
        let mut seen: Vec<Sfx> = vec![];
        for s in pending {
            if seen.contains(&s) || s == Sfx::Hum {
                continue;
            }
            seen.push(s);
            if !self.sfx.contains_key(&s) {
                let wav = audio::wav(&audio::render_sfx(s));
                if let Ok(snd) = load_sound_from_bytes(&wav).await {
                    self.sfx.insert(s, snd);
                }
            }
            if let Some(snd) = self.sfx.get(&s) {
                play_sound(snd, PlaySoundParams { looped: false, volume: SFX_GAIN });
            }
        }
    }
}
