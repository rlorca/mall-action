/**
 * Every music track and sound effect the game can ask for. The rules layer only
 * emits these ids; src/audio implements them. Adding an id here without an
 * implementation fails the audio coverage test.
 */
export const STORE_SONG_IDS = [
  'store.forever12', // disco strut
  'store.radioshock', // bleepy arpeggios
  'store.kgbtoys', // music-box waltz in 3/4
  'store.hotspy', // boardwalk polka
  'store.footlock', // stadium march
  'store.sambaddy', // rock riff
  'store.crookstone', // lounge bossa nova
  'store.sharper', // dreamy synth pads
  'store.spenders', // surf groove
  'store.gamestonk', // hyper game-menu jingle
] as const;

/** Looping tracks. */
export const LOOP_MUSIC_IDS = [
  'title', // heroic theme
  'mall', // quiet sparse ambient bed (soft pads, slow bass, rare bell), noticeably quieter
  'alarm', // tense faster spy groove with a siren figure
  'elevator', // muzak arrangement of the mall theme
  'booth', // Sam Baddy listening-booth bonus track ("SIDE B"), bonus pop
  'continue', // countdown tension loop
  'newspaper', // light jazzy loop for THE DAILY MALL / SPYGRAM
  ...STORE_SONG_IDS,
] as const;

/** One-shot jingles (do not loop). */
export const JINGLE_IDS = ['splash', 'levelclear', 'gameover', 'itemget', 'selfie'] as const;

export const MUSIC_IDS = [...LOOP_MUSIC_IDS, ...JINGLE_IDS] as const;
export type MusicId = (typeof MUSIC_IDS)[number];

export const SFX_IDS = [
  'shot', // player pistol
  'enemyShot',
  'jump',
  'kick', // jump-kick hit
  'land', // landing thud
  'thud', // heavier landing (after zip line)
  'ding', // elevator stop (exactly one per stop)
  'hum', // low elevator hum while riding (short, retriggered)
  'crush',
  'lampFall',
  'glass',
  'discoRoll',
  'searchTick',
  'fanfare', // package found
  'powerup',
  'oneup',
  'hurt',
  'death',
  'door',
  'blip', // text/typewriter blip
  'whistle',
  'helmetPing',
  'coin',
  'zip', // zip line / slide
  'paChime',
  'smoke',
  'shriek',
  'buzzer',
  'pause',
  'select', // menu move / confirm
  'beep', // continue countdown beep
  'alarmOn',
  'escalator',
  'splash', // fountain spray
  'step',
  'camera', // phone flash / photo booth
  'bounce', // coin bounce / wind-up toy
] as const;
export type SfxId = (typeof SFX_IDS)[number];
