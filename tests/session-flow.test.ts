import { describe, expect, it } from 'vitest';
import { difficulty } from '../src/game/difficulty';
import { FADE_FRAMES } from '../src/game/session';
import { START_LIVES, timeBonus } from '../src/game/progress';
import { applyPowerup } from '../src/game/progress';
import { DONE_FRAME } from '../src/flickersoft';
import { SessionDriver, SIX, doorOf, driveAway, enterStore, leaveStore, loseAllLives, place, quietMall, toPlay } from './session-helpers';

describe('session: splash -> title -> play', () => {
  it('the splash plays its jingle once and hands over to the title by itself', () => {
    const d = new SessionDriver({ skipSplash: false });
    expect(d.s.scene).toBe('splash');
    d.step({}, DONE_FRAME + 5);
    expect(d.s.scene).toBe('title');
    expect(d.buf.events.filter((e) => e.t === 'music' && e.name === 'jingle:splash')).toHaveLength(1);
  });

  it('any button skips the splash', () => {
    const d = new SessionDriver({ skipSplash: false });
    d.step({}, 10);
    expect(d.s.scene).toBe('splash');
    d.tap('a');
    expect(d.s.scene).toBe('title');
    expect(d.s.title).not.toBeNull();
  });

  it('skipSplash goes straight to the title; Start fades into the mall arrival (zip line first)', () => {
    const d = new SessionDriver();
    expect(d.s.scene).toBe('title');
    d.step({}, 3);
    d.tap('start');
    expect(d.s.fading).toBe(true);
    d.step({}, FADE_FRAMES + 2);
    expect(d.s.scene).toBe('play');
    expect(d.s.mall).not.toBeNull();
    expect(d.s.mall!.s.phase).toBe('zip');
    expect(d.s.progress.lives).toBe(START_LIVES);
    expect(d.s.progress.blackFriday).toBe(false);
    d.until(() => d.s.mall!.s.phase === 'play', 1500, (i) => (i % 40 === 0 ? { b: true } : {}));
    expect(d.s.hudModel().floorLabel).toBe('R');
  });
});

describe('session: pause and map stop every clock', () => {
  it('Start pauses (music ducks), nothing advances, Start resumes', () => {
    const d = new SessionDriver();
    toPlay(d);
    quietMall(d);
    applyPowerup(d.s.progress, 'rapid');
    d.step({}, 30);
    d.buf.drain();
    d.tap('start');
    expect(d.s.paused).toBe(true);
    expect(d.s.duck).toBe(true);
    expect(d.buf.sfxCount('pause')).toBe(1);
    const lf = d.s.progress.levelFrames;
    const pw = d.s.progress.power.weapon!.frames;
    const mf = d.s.mall!.s.frame;
    d.step({}, 300);
    expect(d.s.progress.levelFrames).toBe(lf);
    expect(d.s.progress.power.weapon!.frames).toBe(pw);
    expect(d.s.mall!.s.frame).toBe(mf);
    d.tap('start');
    expect(d.s.paused).toBe(false);
    expect(d.s.duck).toBe(false);
    d.step({}, 10);
    expect(d.s.progress.levelFrames).toBe(lf + 10 + 1);
    expect(d.s.progress.power.weapon!.frames).toBeLessThan(pw);
  });

  it('Select opens the map (game frozen); Select or Start closes it, and Start does not also pause', () => {
    const d = new SessionDriver();
    toPlay(d);
    quietMall(d);
    d.step({}, 20);
    d.tap('select');
    expect(d.s.mapOpen).toBe(true);
    const lf = d.s.progress.levelFrames;
    d.step({}, 200);
    expect(d.s.progress.levelFrames).toBe(lf);
    d.tap('start');
    expect(d.s.mapOpen).toBe(false);
    expect(d.s.paused).toBe(false);
    d.tap('select');
    expect(d.s.mapOpen).toBe(true);
    d.tap('select');
    expect(d.s.mapOpen).toBe(false);
    d.step({}, 5);
    expect(d.s.progress.levelFrames).toBeGreaterThan(lf);
  });

  it('pause and map are not available during the arrival', () => {
    const d = new SessionDriver();
    d.step({}, 3);
    d.tap('start');
    d.step({}, FADE_FRAMES + 30);
    expect(d.s.mall!.s.phase).not.toBe('play');
    d.tap('select');
    expect(d.s.mapOpen).toBe(false);
  });

  it('autoPause pauses a game in progress only', () => {
    const d = new SessionDriver();
    d.s.autoPause();
    expect(d.s.paused).toBe(false); // title
    toPlay(d);
    d.s.autoPause();
    expect(d.s.paused).toBe(true);
  });
});

describe('session: stores', () => {
  it('walking through a door fades out, builds the store, fades in; power timers keep running inside; leaving returns to that door', () => {
    const d = new SessionDriver();
    toPlay(d);
    quietMall(d);
    applyPowerup(d.s.progress, 'rapid');
    place(d, '4F', doorOf('radioshock'));
    d.buf.drain();
    d.step({ up: true });
    d.step({});
    d.step({}, 1);
    expect(d.s.fading).toBe(true);
    expect(d.s.playMode).toBe('mall'); // swap happens at full black
    d.step({}, FADE_FRAMES);
    expect(d.s.playMode).toBe('store');
    expect(d.s.inStore).toBe('radioshock');
    expect(d.s.mall!.pendingStore).toBeNull();
    expect(d.s.progress.visited).toContain('radioshock');
    d.until(() => !d.s.fading, 100);
    expect(d.s.hudModel().marquee).toBe('RADIOSHOCK');
    expect(d.s.hudModel().floorLabel).toBe('4F');
    const before = d.s.progress.power.weapon!.frames;
    const lf = d.s.progress.levelFrames;
    const mallFrame = d.s.mall!.s.frame;
    d.step({}, 100);
    expect(d.s.progress.power.weapon!.frames).toBe(before - 100);
    expect(d.s.progress.levelFrames).toBe(lf + 100);
    expect(d.s.mall!.s.frame).toBe(mallFrame); // the mall is frozen while inside
    expect(d.music()).toContain('store:radioshock');
    // map inside a store still freezes the clocks
    d.tap('select');
    const lf2 = d.s.progress.levelFrames;
    d.step({}, 50);
    expect(d.s.progress.levelFrames).toBe(lf2);
    d.tap('select');
    d.buf.drain();
    leaveStore(d);
    expect(d.s.playMode).toBe('mall');
    expect(d.s.store).toBeNull();
    const p = d.s.mall!.s.player;
    expect(p.x).toBe(doorOf('radioshock'));
    expect(p.floor).toBe('4F');
    expect(d.music()).toContain('mall');
    expect(d.s.hudModel().marquee).toBeNull();
    // fade sequence completed: no black left
    expect(d.s.fade).toBe(0);
  });

  it('a target store cleared inside cannot be entered again', () => {
    const d = new SessionDriver();
    toPlay(d);
    quietMall(d);
    enterStore(d, 'radioshock', '4F');
    d.s.progress.packages.push('radioshock');
    leaveStore(d);
    place(d, '4F', doorOf('radioshock'));
    d.step({ up: true });
    d.step({}, 60);
    expect(d.s.playMode).toBe('mall');
    expect(d.s.fading).toBe(false);
  });
});

describe('session: level clear and the next loop', () => {
  it('fires exactly once, then loop 2 starts harder with packages reset', () => {
    const d = new SessionDriver();
    toPlay(d);
    quietMall(d);
    d.s.progress.score = 4000;
    d.s.progress.lives = 2;
    driveAway(d);
    const lc = d.s.levelClear;
    expect(lc).not.toBeNull();
    const oldMall = d.s.mall;
    const packagesBefore = d.s.progress.packages.length;
    expect(packagesBefore).toBe(6);
    // holding buttons through the screens: the level clear object is never replaced, never created twice
    let created = 0;
    let last = lc;
    for (let i = 0; i < 4000 && d.s.scene === 'levelclear'; i++) {
      d.step(i % 30 === 0 ? { start: true } : {});
      if (d.s.levelClear !== last && d.s.levelClear) created++;
      last = d.s.levelClear ?? last;
    }
    expect(created).toBe(0);
    d.until(() => d.s.scene === 'play' && !d.s.fading, 400);
    expect(d.s.progress.loop).toBe(2);
    expect(d.s.progress.packages).toEqual([]);
    expect(d.s.progress.opened).toEqual({});
    expect(d.s.progress.levelFrames).toBeLessThan(600);
    expect(d.s.mall).not.toBe(oldMall);
    expect(d.s.mall!.s.phase).toBe('zip');
    expect(d.s.mall!.levelClear).toBe(false);
    expect(d.s.progress.score).toBeGreaterThan(4000);
    expect(d.s.progress.lives).toBe(2);
    const d1 = difficulty(1);
    const d2 = difficulty(d.s.progress.loop);
    expect(d2.spySpeedMul).toBeGreaterThan(d1.spySpeedMul);
    expect(d2.alarmFrames).toBeLessThan(d1.alarmFrames);
    expect(d.s.levelClear).toBeNull();
    // and the new level can also be cleared once more
    d.until(() => d.s.mall!.s.phase === 'play', 1500, (i) => (i % 40 === 0 ? { b: true } : {}));
    quietMall(d);
    driveAway(d);
    expect(d.s.scene).toBe('levelclear');
  });

  it('adds the clear bonus and the time bonus exactly once', () => {
    const d = new SessionDriver();
    toPlay(d);
    quietMall(d);
    d.s.progress.levelFrames = 60 * 100; // 100 s into the level
    driveAway(d);
    const frames = d.s.progress.levelFrames;
    const before = d.s.progress.score;
    d.until(() => d.s.scene !== 'levelclear', 5000, (i) => (i % 25 === 0 ? { start: true } : {}));
    const gained = d.s.progress.score - before;
    expect(gained).toBeGreaterThanOrEqual(1000 + timeBonus(frames));
    // idle for a long while: nothing more is added
    const after = d.s.progress.score;
    d.step({}, 300);
    expect(d.s.progress.score).toBe(after);
  });

  it('Black Friday from the title carries into the game', () => {
    const d = new SessionDriver();
    d.step({}, 3);
    for (const b of ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'] as const) d.tap(b);
    expect(d.s.title!.blackFriday).toBe(true);
    d.tap('start');
    d.step({}, FADE_FRAMES + 2);
    expect(d.s.progress.blackFriday).toBe(true);
  });
});

describe('session: continue and game over', () => {
  it('lose all lives -> CONTINUE? -> accept -> 3 lives, score/packages/loop kept, power-ups reset, resumes where he fell', () => {
    const d = new SessionDriver();
    toPlay(d);
    quietMall(d);
    d.s.progress.score = 1234;
    d.s.progress.packages.push('forever12');
    d.s.progress.loop = 2;
    place(d, '3F', 300);
    applyPowerup(d.s.progress, 'radar');
    applyPowerup(d.s.progress, 'spread');
    d.s.progress.score = 1234;
    loseAllLives(d);
    expect(d.s.scene).toBe('continue');
    expect(d.s.continueState).not.toBeNull();
    // frozen: nothing in the mall runs
    const frame = d.s.mall!.s.frame;
    d.step({}, 30);
    expect(d.s.mall!.s.frame).toBe(frame);
    expect(d.s.scene).toBe('continue');
    d.until(() => d.s.scene === 'play', 300, (i) => (i % 10 === 0 ? { start: true } : {}));
    expect(d.s.progress.lives).toBe(3);
    expect(d.s.progress.continuesLeft).toBe(2);
    expect(d.s.progress.score).toBe(1234);
    expect(d.s.progress.packages).toEqual(['forever12']);
    expect(d.s.progress.loop).toBe(2);
    expect(d.s.progress.power.weapon).toBeNull();
    expect(d.s.progress.power.radar).toBe(false);
    d.step({}, 20);
    expect(d.s.mall!.s.player.mode).toBe('walk');
    expect(d.s.mall!.outOfLives).toBe(false);
    expect(d.s.mall!.s.player.floor).toBe('3F');
  });

  it('the countdown running out ends the game: game over, then back to the title, keeping the session high score', () => {
    const d = new SessionDriver({ highScore: 500 });
    toPlay(d);
    quietMall(d);
    d.s.progress.score = 7000;
    loseAllLives(d);
    expect(d.s.scene).toBe('continue');
    d.until(() => d.s.scene === 'gameover', 1500);
    expect(d.s.gameOver).not.toBeNull();
    expect(d.s.highScore).toBe(7000);
    expect(d.highScores).toEqual([7000]);
    d.until(() => d.s.scene === 'title', 3000, (i) => (i % 20 === 0 ? { start: true } : {}));
    expect(d.s.highScore).toBe(7000);
    expect(d.s.title).not.toBeNull();
    d.step({}, 40);
    // a worse second game does not lower it
    toPlay(d);
    quietMall(d);
    d.s.progress.score = 100;
    loseAllLives(d);
    d.until(() => d.s.scene === 'gameover', 1500);
    expect(d.s.highScore).toBe(7000);
    expect(d.highScores).toEqual([7000]);
  });

  it('with no continues left the last death goes straight to game over', () => {
    const d = new SessionDriver();
    toPlay(d);
    quietMall(d);
    d.s.progress.continuesLeft = 0;
    loseAllLives(d);
    expect(d.s.scene).toBe('gameover');
  });

  it('three continues are granted, the fourth death is game over', () => {
    const d = new SessionDriver();
    toPlay(d);
    quietMall(d);
    for (let n = 0; n < 3; n++) {
      loseAllLives(d);
      expect(d.s.scene).toBe('continue');
      d.until(() => d.s.scene === 'play', 300, (i) => (i % 10 === 0 ? { start: true } : {}));
      d.step({}, 150); // invulnerability wears off
      quietMall(d);
    }
    expect(d.s.progress.continuesLeft).toBe(0);
    loseAllLives(d);
    expect(d.s.scene).toBe('gameover');
  });

  it('dying inside a store continues inside that store', () => {
    const d = new SessionDriver();
    toPlay(d);
    quietMall(d);
    enterStore(d, 'radioshock', '4F');
    const st = d.s.store!;
    d.s.progress.lives = 1;
    // kill through the store's public state: an enemy bullet on the player
    st.guards.length = 0;
    st.bullets.push({ x: st.player.x + 8, y: st.player.y + 8, vx: 0, vy: 0, from: 'spy' } as never);
    d.until(() => d.s.scene !== 'play', 400);
    expect(d.s.scene).toBe('continue');
    d.until(() => d.s.scene === 'play', 300, (i) => (i % 10 === 0 ? { start: true } : {}));
    expect(d.s.playMode).toBe('store');
    expect(d.s.progress.lives).toBe(3);
    expect(d.s.store!.outOfLives).toBe(false);
    d.step({}, 30);
    expect(d.s.scene).toBe('play');
  });
});

describe('session: determinism', () => {
  const script = (i: number) => {
    const held: Record<string, boolean> = {};
    const ph = Math.floor(i / 45) % 6;
    if (ph === 0) held.right = true;
    if (ph === 1) held.left = true;
    if (ph === 2) held.a = true;
    if (ph === 3) { held.right = true; held.b = true; }
    if (ph === 4) held.up = true;
    if (ph === 5) held.down = true;
    return held;
  };
  const run = (seed: number): number[] => {
    const d = new SessionDriver({ seed });
    d.step({}, 3);
    d.tap('start');
    const hashes: number[] = [];
    for (let i = 0; i < 1500; i++) {
      d.step(i % 61 === 0 ? { b: true, ...script(i) } : script(i));
      if (i % 100 === 99) hashes.push(d.s.stateHash());
    }
    return hashes;
  };
  it('same seed + same inputs => same state; different seed differs', () => {
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });
});

// Keep the imports used even if a scenario above is edited.
void SIX;
