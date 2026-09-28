import { describe, it, expect } from 'vitest';
import { SceneManager, FADE_FRAMES } from '../src/core/scenes.js';

const layer = () => ({ kids: [], addChild(c) { this.kids.push(c); }, removeChild(c) { this.kids = this.kids.filter((k) => k !== c); } });
const scene = (log, name) => ({ container: { name }, enter: () => log.push(`enter ${name}`), exit: () => log.push(`exit ${name}`), update: () => log.push(`update ${name}`) });

describe('SceneManager', () => {
  it('replace fades out, swaps at the midpoint, fades in, and suppresses updates meanwhile', () => {
    const log = []; let alpha = 0;
    const m = new SceneManager({ layer: layer(), overlayLayer: layer(), setFade: (a) => { alpha = a; } }, {});
    m.replace(scene(log, 'A'), {}, { fade: false });
    expect(log).toEqual(['enter A']);
    m.replace(scene(log, 'B'));
    for (let i = 0; i < FADE_FRAMES; i++) m.update();
    expect(log).toEqual(['enter A', 'exit A', 'enter B']); expect(alpha).toBe(1);
    for (let i = 0; i < FADE_FRAMES; i++) m.update();
    expect(alpha).toBe(0); expect(m.fading).toBe(false);
    m.update(); expect(log.at(-1)).toBe('update B');
  });
  it('overlays receive updates instead of the scene until popped', () => {
    const log = [];
    const m = new SceneManager({ layer: layer(), overlayLayer: layer(), setFade() {} }, {});
    m.replace(scene(log, 'A'), {}, { fade: false });
    m.push(scene(log, 'Map')); m.update();
    expect(log.at(-1)).toBe('update Map');
    m.pop(); m.update();
    expect(log.slice(-2)).toEqual(['exit Map', 'update A']);
  });
});
