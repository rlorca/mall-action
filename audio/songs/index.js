import { compileSong } from '../song.js';
import { alarm, booth, continueSong, elevator, mall, newspaper, title } from './core.js';
import { gameover, itemget, levelclear, selfie, splash } from './jingles.js';
import { footlock, forever12, hotspy, kgbtoys, radioshock } from './stores1.js';
import { crookstone, gamestonk, sambaddy, sharper, spenders } from './stores2.js';
export const SONG_DEFS = {
    title,
    mall,
    alarm,
    elevator,
    booth,
    continue: continueSong,
    newspaper,
    'store.forever12': forever12,
    'store.radioshock': radioshock,
    'store.kgbtoys': kgbtoys,
    'store.hotspy': hotspy,
    'store.footlock': footlock,
    'store.sambaddy': sambaddy,
    'store.crookstone': crookstone,
    'store.sharper': sharper,
    'store.spenders': spenders,
    'store.gamestonk': gamestonk,
    splash,
    levelclear,
    gameover,
    itemget,
    selfie,
};
const cache = new Map();
/** The compiled song for an id (compiled on first use). Throws if the authoring data is malformed. */
export function getSong(id) {
    let s = cache.get(id);
    if (!s) {
        s = compileSong(SONG_DEFS[id]);
        cache.set(id, s);
    }
    return s;
}
