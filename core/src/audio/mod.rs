//! NES-style chiptune synthesis: two pulse channels, a triangle and a noise channel, rendered
//! to 16-bit mono PCM entirely from source code. The shell loads the PCM as WAV and plays it.
//!
//! Contract used by the game rules and the shell:
//! * [`render_sfx`] / [`render_song`] return PCM at [`SAMPLE_RATE`].
//! * [`song_loops`] says whether a song loops (title/mall/store/alarm/elevator/booth) or is a one-shot jingle.
//! * Looping songs must loop seamlessly (exact whole number of bars; no click at the seam).
//! * [`wav`] wraps PCM as a 16-bit mono WAV file.
use crate::stores::StoreId;

pub const SAMPLE_RATE: u32 = 22050;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Sfx {
    Shot,
    EnemyShot,
    Jump,
    Land,
    Ding,
    /// Looping low elevator hum.
    Hum,
    Crush,
    LampFall,
    Glass,
    SearchTick,
    Package,
    PowerUp,
    Hurt,
    Death,
    Door,
    TextBlip,
    Whistle,
    HelmetPing,
    Coins,
    /// Zip-line slide (longer, rising/falling zing).
    Zip,
    PaChime,
    Smoke,
    Shriek,
    Buzzer,
    Pause,
    /// Short beep (continue countdown, menu).
    Beep,
    /// Phone camera shutter + flash.
    Camera,
    /// Footstep-ish tick for floors (very quiet, optional).
    Step,
    /// Disco ball / rolling rumble (short loop-free burst).
    Roll,
    /// Splash "ta-da" shimmer for splash underline.
    Select,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Song {
    /// FLICKERSOFT splash jingle (one-shot, ~2 s).
    FlickerJingle,
    /// Heroic title theme (loop).
    Title,
    /// Quiet sparse ambient bed for the mall (soft pads, slow bass, rare bell); loop.
    Mall,
    /// Tense, faster spy groove with a siren figure; loop.
    Alarm,
    /// Elevator-muzak arrangement of the theme; loop.
    Elevator,
    /// One distinct loop per open store (10 stores).
    Store(StoreId),
    /// Bonus pop track in the Sam Baddy listening booth; loop.
    ListeningBooth,
    /// Level-clear fanfare (one-shot).
    LevelClear,
    /// Game-over jingle (one-shot).
    GameOver,
    /// Item-get jingle (one-shot, ~1.5 s).
    ItemGet,
    /// Newspaper/tally music (loop, cheerful).
    Tally,
}

/// All songs (for tests and pre-render): Store variants only for the 10 open stores.
pub fn all_songs() -> Vec<Song> {
    use crate::stores::StoreId::*;
    let mut v = vec![
        Song::FlickerJingle,
        Song::Title,
        Song::Mall,
        Song::Alarm,
        Song::Elevator,
        Song::ListeningBooth,
        Song::LevelClear,
        Song::GameOver,
        Song::ItemGet,
        Song::Tally,
    ];
    for s in [
        Forever12, RadioShock, KgbToys, HotSpyOnAStick, FootLockpicker, SamBaddy, Crookstone, SharperImagine,
        SpendersGifts, GameStonk,
    ] {
        v.push(Song::Store(s));
    }
    v
}

pub fn all_sfx() -> Vec<Sfx> {
    use Sfx::*;
    vec![
        Shot, EnemyShot, Jump, Land, Ding, Hum, Crush, LampFall, Glass, SearchTick, Package, PowerUp, Hurt, Death,
        Door, TextBlip, Whistle, HelmetPing, Coins, Zip, PaChime, Smoke, Shriek, Buzzer, Pause, Beep, Camera, Step,
        Roll, Select,
    ]
}

mod synth;
pub use synth::wav;
mod sfx;
pub use sfx::{render_sfx, sfx_loops};
mod songs;
pub use songs::{render_song, song_loops};
