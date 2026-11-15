//! GENERATED from audio/ids.js (SFX_IDS / MUSIC_IDS, fixed order). Do not reorder.
//!
//! Variant naming rule: split the string id on '.', '-' and '_', upper-case the first letter of each part and
//! keep the rest as is (camelCase ids keep their inner capitals). Examples: 'enemyShot' -> EnemyShot,
//! 'store.forever12' -> StoreForever12, 'lampFall' -> LampFall, 'oneup' -> Oneup.
//! SfxId and MusicId each have their own 'Splash' (fountain spray sfx / splash-screen jingle).

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SfxId {
    Shot,
    EnemyShot,
    Jump,
    Kick,
    Land,
    Thud,
    Ding,
    Hum,
    Crush,
    LampFall,
    Glass,
    DiscoRoll,
    SearchTick,
    Fanfare,
    Powerup,
    Oneup,
    Hurt,
    Death,
    Door,
    Blip,
    Whistle,
    HelmetPing,
    Coin,
    Zip,
    PaChime,
    Smoke,
    Shriek,
    Buzzer,
    Pause,
    Select,
    Beep,
    AlarmOn,
    Escalator,
    Splash,
    Step,
    Camera,
    Bounce,
}

impl SfxId {
    pub const ALL: [SfxId; 37] = [
        SfxId::Shot,
        SfxId::EnemyShot,
        SfxId::Jump,
        SfxId::Kick,
        SfxId::Land,
        SfxId::Thud,
        SfxId::Ding,
        SfxId::Hum,
        SfxId::Crush,
        SfxId::LampFall,
        SfxId::Glass,
        SfxId::DiscoRoll,
        SfxId::SearchTick,
        SfxId::Fanfare,
        SfxId::Powerup,
        SfxId::Oneup,
        SfxId::Hurt,
        SfxId::Death,
        SfxId::Door,
        SfxId::Blip,
        SfxId::Whistle,
        SfxId::HelmetPing,
        SfxId::Coin,
        SfxId::Zip,
        SfxId::PaChime,
        SfxId::Smoke,
        SfxId::Shriek,
        SfxId::Buzzer,
        SfxId::Pause,
        SfxId::Select,
        SfxId::Beep,
        SfxId::AlarmOn,
        SfxId::Escalator,
        SfxId::Splash,
        SfxId::Step,
        SfxId::Camera,
        SfxId::Bounce,
    ];

    /// Original string id (the entry in audio/ids.js).
    pub fn as_str(self) -> &'static str {
        match self {
            SfxId::Shot => "shot",
            SfxId::EnemyShot => "enemyShot",
            SfxId::Jump => "jump",
            SfxId::Kick => "kick",
            SfxId::Land => "land",
            SfxId::Thud => "thud",
            SfxId::Ding => "ding",
            SfxId::Hum => "hum",
            SfxId::Crush => "crush",
            SfxId::LampFall => "lampFall",
            SfxId::Glass => "glass",
            SfxId::DiscoRoll => "discoRoll",
            SfxId::SearchTick => "searchTick",
            SfxId::Fanfare => "fanfare",
            SfxId::Powerup => "powerup",
            SfxId::Oneup => "oneup",
            SfxId::Hurt => "hurt",
            SfxId::Death => "death",
            SfxId::Door => "door",
            SfxId::Blip => "blip",
            SfxId::Whistle => "whistle",
            SfxId::HelmetPing => "helmetPing",
            SfxId::Coin => "coin",
            SfxId::Zip => "zip",
            SfxId::PaChime => "paChime",
            SfxId::Smoke => "smoke",
            SfxId::Shriek => "shriek",
            SfxId::Buzzer => "buzzer",
            SfxId::Pause => "pause",
            SfxId::Select => "select",
            SfxId::Beep => "beep",
            SfxId::AlarmOn => "alarmOn",
            SfxId::Escalator => "escalator",
            SfxId::Splash => "splash",
            SfxId::Step => "step",
            SfxId::Camera => "camera",
            SfxId::Bounce => "bounce",
        }
    }

    /// Index into audio/ids.js SFX_IDS (the integer passed to JS playSfx).
    pub fn index(self) -> usize {
        self as usize
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MusicId {
    Title,
    Mall,
    Alarm,
    Elevator,
    Booth,
    Continue,
    Newspaper,
    StoreForever12,
    StoreRadioshock,
    StoreKgbtoys,
    StoreHotspy,
    StoreFootlock,
    StoreSambaddy,
    StoreCrookstone,
    StoreSharper,
    StoreSpenders,
    StoreGamestonk,
    Splash,
    Levelclear,
    Gameover,
    Itemget,
    Selfie,
}

impl MusicId {
    pub const ALL: [MusicId; 22] = [
        MusicId::Title,
        MusicId::Mall,
        MusicId::Alarm,
        MusicId::Elevator,
        MusicId::Booth,
        MusicId::Continue,
        MusicId::Newspaper,
        MusicId::StoreForever12,
        MusicId::StoreRadioshock,
        MusicId::StoreKgbtoys,
        MusicId::StoreHotspy,
        MusicId::StoreFootlock,
        MusicId::StoreSambaddy,
        MusicId::StoreCrookstone,
        MusicId::StoreSharper,
        MusicId::StoreSpenders,
        MusicId::StoreGamestonk,
        MusicId::Splash,
        MusicId::Levelclear,
        MusicId::Gameover,
        MusicId::Itemget,
        MusicId::Selfie,
    ];

    /// Original string id (the entry in audio/ids.js).
    pub fn as_str(self) -> &'static str {
        match self {
            MusicId::Title => "title",
            MusicId::Mall => "mall",
            MusicId::Alarm => "alarm",
            MusicId::Elevator => "elevator",
            MusicId::Booth => "booth",
            MusicId::Continue => "continue",
            MusicId::Newspaper => "newspaper",
            MusicId::StoreForever12 => "store.forever12",
            MusicId::StoreRadioshock => "store.radioshock",
            MusicId::StoreKgbtoys => "store.kgbtoys",
            MusicId::StoreHotspy => "store.hotspy",
            MusicId::StoreFootlock => "store.footlock",
            MusicId::StoreSambaddy => "store.sambaddy",
            MusicId::StoreCrookstone => "store.crookstone",
            MusicId::StoreSharper => "store.sharper",
            MusicId::StoreSpenders => "store.spenders",
            MusicId::StoreGamestonk => "store.gamestonk",
            MusicId::Splash => "splash",
            MusicId::Levelclear => "levelclear",
            MusicId::Gameover => "gameover",
            MusicId::Itemget => "itemget",
            MusicId::Selfie => "selfie",
        }
    }

    /// Index into audio/ids.js MUSIC_IDS (the integer passed to JS setMusic is index() + 1; 0 = silence).
    pub fn index(self) -> usize {
        self as usize
    }
}
