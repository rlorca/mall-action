/** Every song the game plays. */
export const SONG_IDS = [
  'title', 'mall', 'alarm', 'muzak', 'bonus',
  'store_forever12', 'store_radioshock', 'store_kgbtoys', 'store_hotspy', 'store_footlock',
  'store_sambaddy', 'store_crookstone', 'store_sharper', 'store_spenders', 'store_gamestonk',
  'jingle_clear', 'jingle_gameover', 'jingle_itemget', 'jingle_fanfare',
] as const;
export type SongId = (typeof SONG_IDS)[number];

/** Every sound effect the game triggers. */
export const SFX_IDS = [
  'shot', 'eshot', 'jump', 'ding', 'crush', 'lampfall', 'glass', 'searchtick', 'powerup', 'hurt', 'death', 'door',
  'blip', 'whistle', 'ping', 'coin', 'slide', 'zip', 'chime', 'smoke', 'shriek', 'buzzer', 'pause', 'thud', 'flash',
  'beep', 'kick', 'spyhit', 'bothit', 'select', 'confirm', 'splash', 'throw', 'cheer',
] as const;
export type SfxId = (typeof SFX_IDS)[number];
