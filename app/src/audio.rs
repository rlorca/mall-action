//! Audio playback: the core synthesises PCM; we wrap it as WAV and hand it to macroquad.
//! * Nothing plays until the first user input (browser autoplay rules).
//! * Every sound is rendered once at start-up behind a LOADING bar (`preload_step`), then decoded in the
//!   background (a coroutine per sound), so the game loop never stalls on synthesis or decoding.
//! * If audio is unavailable the game still runs (the JS side swallows audio errors).
use macroquad::audio::{load_sound_from_bytes, play_sound, set_sound_volume, stop_sound, PlaySoundParams, Sound};
use macroquad::experimental::coroutines::{start_coroutine, Coroutine};
use mall_core::audio::{self, Sfx, Song};
use mall_core::game::Game;
use std::collections::{HashMap, VecDeque};

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
enum Key {
    Song(Song),
    Sfx(Sfx),
}

pub struct Audio {
    ready: HashMap<Key, Sound>,
    loading: HashMap<Key, Coroutine<Option<Sound>>>,
    warm: VecDeque<Key>,
    total: usize,
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
        let mut warm = VecDeque::new();
        for s in audio::all_sfx() {
            warm.push_back(Key::Sfx(s));
        }
        for s in [Song::Title, Song::Mall, Song::Elevator, Song::Alarm] {
            warm.push_back(Key::Song(s));
        }
        for s in audio::all_songs() {
            warm.push_back(Key::Song(s));
        }
        let total = warm.len();
        Audio {
            ready: HashMap::new(),
            loading: HashMap::new(),
            warm,
            total,
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
            if let Some(s) = self.cur.and_then(|s| self.ready.get(&Key::Song(s))) {
                stop_sound(s);
            }
            if let Some(h) = self.ready.get(&Key::Sfx(Sfx::Hum)) {
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

    /// Render + start decoding a sound in the background (no-op if loaded or loading).
    fn ensure(&mut self, key: Key) {
        if self.ready.contains_key(&key) || self.loading.contains_key(&key) {
            return;
        }
        let pcm = match key {
            Key::Song(s) => audio::render_song(s),
            Key::Sfx(s) => audio::render_sfx(s),
        };
        let wav = audio::wav(&pcm);
        let co = start_coroutine(async move { load_sound_from_bytes(&wav).await.ok() });
        self.loading.insert(key, co);
    }

    fn poll_loading(&mut self) {
        let done: Vec<Key> = self.loading.iter().filter(|(_, c)| c.is_done()).map(|(k, _)| *k).collect();
        for k in done {
            if let Some(co) = self.loading.remove(&k) {
                if let Some(Some(s)) = co.retrieve() {
                    self.ready.insert(k, s);
                }
            }
        }
    }

    /// Items still to be rendered at start-up.
    pub fn preload_remaining(&self) -> usize {
        self.warm.len()
    }
    pub fn preload_total(&self) -> usize {
        self.total
    }
    /// Render sounds until `budget_s` seconds have been spent this frame (called behind the LOADING bar).
    pub fn preload_step(&mut self, budget_s: f64) {
        let t0 = macroquad::miniquad::date::now();
        while let Some(k) = self.warm.pop_front() {
            self.ensure(k);
            if macroquad::miniquad::date::now() - t0 > budget_s {
                break;
            }
        }
        self.poll_loading();
    }

    pub fn update(&mut self, game: &Game) {
        let pending = std::mem::take(&mut self.pending);
        self.poll_loading();
        if !self.unlocked || self.muted {
            return;
        }
        // ---- music ----
        let want = game.song();
        if want != self.cur || (!self.started && want.is_some()) {
            if let Some(old) = self.cur.and_then(|s| self.ready.get(&Key::Song(s))) {
                if self.started {
                    stop_sound(old);
                }
            }
            if want != self.cur {
                self.started = false;
            }
            self.cur = want;
        }
        if let (Some(song), false) = (self.cur, self.started) {
            self.ensure(Key::Song(song));
            if let Some(s) = self.ready.get(&Key::Song(song)) {
                let vol = game.music_volume();
                play_sound(s, PlaySoundParams { looped: audio::song_loops(song), volume: MUSIC_GAIN * vol });
                self.last_vol = vol;
                self.started = true;
            }
        }
        if self.started {
            let vol = game.music_volume();
            if (vol - self.last_vol).abs() > 0.01 {
                if let Some(s) = self.cur.and_then(|s| self.ready.get(&Key::Song(s))) {
                    set_sound_volume(s, MUSIC_GAIN * vol);
                }
                self.last_vol = vol;
            }
        }
        // ---- elevator hum ----
        let hum = game.hum();
        if hum != self.hum {
            self.ensure(Key::Sfx(Sfx::Hum));
            if let Some(h) = self.ready.get(&Key::Sfx(Sfx::Hum)) {
                if hum {
                    play_sound(h, PlaySoundParams { looped: true, volume: 0.35 });
                } else {
                    stop_sound(h);
                }
                self.hum = hum;
            } else if !hum {
                self.hum = false;
            }
        }
        // ---- sound effects (one of each kind per frame) ----
        let mut seen: Vec<Sfx> = vec![];
        for s in pending {
            if seen.contains(&s) || s == Sfx::Hum {
                continue;
            }
            seen.push(s);
            self.ensure(Key::Sfx(s));
            if let Some(snd) = self.ready.get(&Key::Sfx(s)) {
                play_sound(snd, PlaySoundParams { looped: false, volume: SFX_GAIN });
            }
        }
    }
}
