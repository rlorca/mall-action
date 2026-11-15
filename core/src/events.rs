//! Things the rules tell the outside world (sound, music). The rendering/audio shell reacts to these;
//! the rules never touch audio or graphics directly.

use crate::types::StoreId;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Sfx {
    Shot,
    EnemyShot,
    Jump,
    Land,
    Ding,
    Crush,
    LampFall,
    Glass,
    SearchTick,
    PackageFanfare,
    PowerUp,
    Hurt,
    Death,
    Door,
    TextBlip,
    Whistle,
    HelmetPing,
    Coins,
    Zip,
    PaChime,
    Smoke,
    Shriek,
    Buzzer,
    Pause,
    Beep,
    Flash,
    ExtraLife,
    Kick,
    Splat,
    MenuBlip,
    Alarm,
    Thud,
    Fall,
    Trap,
    Tick,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Track {
    Silence,
    Splash,
    Title,
    MallAmbient,
    Alarm,
    Elevator,
    Store(StoreId),
    Booth,
    LevelClear,
    GameOver,
    ItemGet,
    Continue,
}

impl Track {
    /// Jingles play once and then music falls back to silence / whatever the game asks for next.
    pub fn is_jingle(self) -> bool {
        matches!(self, Track::Splash | Track::LevelClear | Track::GameOver | Track::ItemGet)
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Event {
    Sfx(Sfx),
    /// Switch background music. The audio side restarts the song only if the track changed.
    Music(Track),
    /// Loop the elevator hum while riding.
    Hum(bool),
    /// Music volume factor 0.0..=1.0 (pause turns it down, the mall bed is quiet).
    MusicVolume(f32),
}

/// Collector the rules push events into during a step.
#[derive(Default, Debug)]
pub struct Out {
    pub events: Vec<Event>,
}

impl Out {
    pub fn new() -> Out {
        Out { events: Vec::new() }
    }
    pub fn sfx(&mut self, s: Sfx) {
        self.events.push(Event::Sfx(s));
    }
    pub fn music(&mut self, t: Track) {
        self.events.push(Event::Music(t));
    }
    pub fn take(&mut self) -> Vec<Event> {
        std::mem::take(&mut self.events)
    }
    pub fn count_sfx(&self, s: Sfx) -> usize {
        self.events.iter().filter(|e| **e == Event::Sfx(s)).count()
    }
}
