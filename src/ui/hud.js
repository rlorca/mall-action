import { Container, Graphics } from 'pixi.js';
import { makeText, setText } from '../gfx/font.js';
import { C } from '../gfx/palette.js';
import { hasSprite, makeSprite } from '../gfx/textures.js';
import { activeLabel } from '../logic/powerups.js';
import { TARGET_COUNT } from '../logic/rules.js';

const PANEL_X = 208, PANEL_W = 48;

// 256×16 status strip: score, packages, lives, power-up, alarm, elevator-style floor panel.
export function createHud() {
  const container = new Container();
  container.addChild(new Graphics().rect(0, 0, 256, 16).fill(0x000000));
  const at = (c, x, y) => { c.position.set(x, y); container.addChild(c); return c; };

  const score = at(makeText(''), 0, 0);
  const pkg = at(makeText(''), 104, 0);
  const alarm = at(makeText('ALARM', C.red), 164, 0);
  const life = hasSprite('hudLife') ? at(makeSprite('hudLife'), 0, 8) : at(makeText('*', C.red), 0, 8);
  const lives = at(makeText(''), 8, 8);
  const power = at(makeText(''), 32, 8);
  const bar = at(new Graphics(), 0, 0);
  const icons = at(new Container(), 0, 0);

  // elevator panel
  container.addChild(new Graphics().rect(PANEL_X, 0, PANEL_W, 16).fill(C.darkGrey).rect(PANEL_X + 1, 1, PANEL_W - 2, 14).fill(0x000000));
  const floor = at(makeText('', C.red), PANEL_X, 4);
  const marqueeMask = new Graphics().rect(PANEL_X + 2, 2, PANEL_W - 4, 12).fill(0xffffff);
  container.addChild(marqueeMask);
  const marquee = at(makeText('', C.red), PANEL_X, 4);
  marquee.mask = marqueeMask;

  const last = {};
  const changed = (k, v) => { if (last[k] === v) return false; last[k] = v; return true; };

  return {
    container,
    update(state, { floorLabel = '', marquee: marqueeText = null, alarm: alarmOn = false, frame = 0 } = {}) {
      if (changed('score', state.score)) setText(score, `SCORE ${String(state.score).padStart(6, '0')}`);
      const n = state.packages.size;
      if (changed('pkg', n)) setText(pkg, `PKG ${n}/${TARGET_COUNT}`, n >= TARGET_COUNT ? C.lime : C.pink);
      if (changed('lives', state.lives)) setText(lives, `x${state.lives}`);
      const act = activeLabel(state.power);
      if (changed('power', act?.label ?? '')) setText(power, act?.label ?? '', C.yellow);
      bar.clear();
      if (act) bar.rect(108, 11, Math.max(1, Math.round(40 * act.frac)), 3).fill(C.yellow);
      const iconKey = `${state.power.armor}|${state.power.radar}`;
      if (changed('icons', iconKey)) {
        icons.removeChildren();
        if (state.power.armor) { const t = makeText(state.power.armor === 'pretzel' ? 'P' : 'V', C.orange); t.position.set(152, 8); icons.addChild(t); }
        if (state.power.radar) { const t = makeText('R', C.lime); t.position.set(164, 8); icons.addChild(t); }
      }
      alarm.visible = alarmOn && Math.floor(frame / 16) % 2 === 0;
      life.visible = true;
      if (marqueeText) {
        floor.visible = false; marquee.visible = true;
        if (changed('marquee', marqueeText)) setText(marquee, marqueeText, C.red);
        const w = marqueeText.length * 8 + PANEL_W;
        marquee.x = PANEL_X + PANEL_W - (Math.floor(frame / 2) % w);
      } else {
        marquee.visible = false; floor.visible = true;
        if (changed('floor', floorLabel)) { setText(floor, floorLabel, C.red); floor.x = PANEL_X + Math.floor((PANEL_W - floorLabel.length * 8) / 2); }
      }
    },
  };
}
