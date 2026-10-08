/**
 * Public surface of src/audio. The game only needs `AudioEngine` and the id types; the song data, sequencer and
 * offline renderer are exported for tests and tooling.
 */
export { AudioEngine } from './audio';
export { MUSIC_IDS, SFX_IDS, type MusicId, type SfxId } from './ids';
export { SONG_DEFS, getSong } from './songs';
export { SFX } from './sfx';
export { compileSong, type CompiledSong, type SongDef } from './song';
export { eventsBetween } from './sequencer';
export { renderSfx, renderSong } from './offline';
