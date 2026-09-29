import { describe, it, expect } from 'vitest';
import { SPRITES, SpriteData } from '../src/sprites/sprites';

function checkSprite(sprite: SpriteData, expectedW: number, expectedH: number, name: string) {
  expect(sprite.width, `${name} width`).toBe(expectedW);
  expect(sprite.height, `${name} height`).toBe(expectedH);
  expect(sprite.pixels.length, `${name} pixel rows`).toBe(expectedH);
  for (let r = 0; r < sprite.pixels.length; r++) {
    expect(sprite.pixels[r].length, `${name} row ${r} cols`).toBe(expectedW);
  }
  expect(sprite.palette.length, `${name} palette`).toBeLessThanOrEqual(3);
}

function checkPixelValues(sprite: SpriteData, name: string) {
  for (let r = 0; r < sprite.pixels.length; r++) {
    for (let c = 0; c < sprite.pixels[r].length; c++) {
      const v = sprite.pixels[r][c];
      expect(v, `${name} pixel[${r}][${c}]`).toBeGreaterThanOrEqual(0);
      expect(v, `${name} pixel[${r}][${c}]`).toBeLessThanOrEqual(3);
    }
  }
  if (sprite.frames) {
    for (let f = 0; f < sprite.frames.length; f++) {
      for (let r = 0; r < sprite.frames[f].length; r++) {
        for (let c = 0; c < sprite.frames[f][r].length; c++) {
          const v = sprite.frames[f][r][c];
          expect(v, `${name} frame[${f}][${r}][${c}]`).toBeGreaterThanOrEqual(0);
          expect(v, `${name} frame[${f}][${r}][${c}]`).toBeLessThanOrEqual(3);
        }
      }
    }
  }
}

describe('Sprites', () => {
  describe('agent mall sprites (16x24)', () => {
    it('stand', () => checkSprite(SPRITES.agent.mall.stand, 16, 24, 'agent.mall.stand'));
    it('walk has frames', () => {
      checkSprite(SPRITES.agent.mall.walk, 16, 24, 'agent.mall.walk');
      expect(SPRITES.agent.mall.walk.frames!.length).toBeGreaterThanOrEqual(2);
    });
    it('jump', () => checkSprite(SPRITES.agent.mall.jump, 16, 24, 'agent.mall.jump'));
    it('duck', () => checkSprite(SPRITES.agent.mall.duck, 16, 24, 'agent.mall.duck'));
    it('shoot', () => checkSprite(SPRITES.agent.mall.shoot, 16, 24, 'agent.mall.shoot'));
    it('shootDuck', () => checkSprite(SPRITES.agent.mall.shootDuck, 16, 24, 'agent.mall.shootDuck'));
    it('death', () => checkSprite(SPRITES.agent.mall.death, 16, 24, 'agent.mall.death'));
    it('holdItem', () => checkSprite(SPRITES.agent.mall.holdItem, 16, 24, 'agent.mall.holdItem'));
  });

  describe('agent store sprites (16x16)', () => {
    it('down', () => checkSprite(SPRITES.agent.store.down, 16, 16, 'agent.store.down'));
    it('up', () => checkSprite(SPRITES.agent.store.up, 16, 16, 'agent.store.up'));
    it('left', () => checkSprite(SPRITES.agent.store.left, 16, 16, 'agent.store.left'));
    it('right', () => checkSprite(SPRITES.agent.store.right, 16, 16, 'agent.store.right'));
    it('search', () => checkSprite(SPRITES.agent.store.search, 16, 16, 'agent.store.search'));
  });

  describe('spy mall sprites (16x24)', () => {
    it('stand', () => checkSprite(SPRITES.spy.mall.stand, 16, 24, 'spy.mall.stand'));
    it('walk has frames', () => {
      checkSprite(SPRITES.spy.mall.walk, 16, 24, 'spy.mall.walk');
      expect(SPRITES.spy.mall.walk.frames!.length).toBeGreaterThanOrEqual(2);
    });
    it('aim', () => checkSprite(SPRITES.spy.mall.aim, 16, 24, 'spy.mall.aim'));
    it('shootHigh', () => checkSprite(SPRITES.spy.mall.shootHigh, 16, 24, 'spy.mall.shootHigh'));
    it('shootLow', () => checkSprite(SPRITES.spy.mall.shootLow, 16, 24, 'spy.mall.shootLow'));
    it('duck', () => checkSprite(SPRITES.spy.mall.duck, 16, 24, 'spy.mall.duck'));
    it('death', () => checkSprite(SPRITES.spy.mall.death, 16, 24, 'spy.mall.death'));
  });

  describe('spy store sprites (16x16)', () => {
    it('down', () => checkSprite(SPRITES.spy.store.down, 16, 16, 'spy.store.down'));
  });

  it('security bot (16x16)', () => checkSprite(SPRITES.securityBot, 16, 16, 'securityBot'));

  describe('bullets', () => {
    it('player bullet (4x2)', () => checkSprite(SPRITES.bullets.player, 4, 2, 'bullet.player'));
    it('enemy bullet (4x2)', () => checkSprite(SPRITES.bullets.enemy, 4, 2, 'bullet.enemy'));
  });

  describe('elevator', () => {
    it('closed (24x48)', () => checkSprite(SPRITES.elevator.closed, 24, 48, 'elevator.closed'));
    it('open (24x48)', () => checkSprite(SPRITES.elevator.open, 24, 48, 'elevator.open'));
  });

  it('escalator (32x48)', () => checkSprite(SPRITES.escalator, 32, 48, 'escalator'));
  it('mall cop (16x24)', () => checkSprite(SPRITES.mallCop, 16, 24, 'mallCop'));
  it('janitor (16x24)', () => checkSprite(SPRITES.janitor, 16, 24, 'janitor'));
  it('mall walker (16x24)', () => checkSprite(SPRITES.mallWalker, 16, 24, 'mallWalker'));
  it('lamp (8x16)', () => checkSprite(SPRITES.lamp, 8, 16, 'lamp'));

  it('disco ball (8x8) with animation frames', () => {
    checkSprite(SPRITES.discoBall, 8, 8, 'discoBall');
    expect(SPRITES.discoBall.frames!.length).toBeGreaterThanOrEqual(2);
  });

  it('fountain (16x16) with animation frames', () => {
    checkSprite(SPRITES.fountain, 16, 16, 'fountain');
    expect(SPRITES.fountain.frames!.length).toBeGreaterThanOrEqual(2);
  });

  it('kiosk (16x24)', () => checkSprite(SPRITES.kiosk, 16, 24, 'kiosk'));
  it('photo booth (16x24)', () => checkSprite(SPRITES.photoBooth, 16, 24, 'photoBooth'));
  it('station wagon (48x24)', () => checkSprite(SPRITES.stationWagon, 48, 24, 'stationWagon'));

  it('coin (8x8) with animation frames', () => {
    checkSprite(SPRITES.coin, 8, 8, 'coin');
    expect(SPRITES.coin.frames!.length).toBeGreaterThanOrEqual(2);
  });

  it('wet floor sign (8x16)', () => checkSprite(SPRITES.wetFloorSign, 8, 16, 'wetFloorSign'));

  describe('power-up sprites (8x8)', () => {
    it('rapidFire', () => checkSprite(SPRITES.powerUps.rapidFire, 8, 8, 'rapidFire'));
    it('spreadShot', () => checkSprite(SPRITES.powerUps.spreadShot, 8, 8, 'spreadShot'));
    it('armorVest', () => checkSprite(SPRITES.powerUps.armorVest, 8, 8, 'armorVest'));
    it('sneakers', () => checkSprite(SPRITES.powerUps.sneakers, 8, 8, 'sneakers'));
    it('radar', () => checkSprite(SPRITES.powerUps.radar, 8, 8, 'radar'));
    it('oneUp', () => checkSprite(SPRITES.powerUps.oneUp, 8, 8, 'oneUp'));
    it('cinnabomb', () => checkSprite(SPRITES.powerUps.cinnabomb, 8, 8, 'cinnabomb'));
    it('orangeJuliOoze', () => checkSprite(SPRITES.powerUps.orangeJuliOoze, 8, 8, 'orangeJuliOoze'));
    it('softPretzel', () => checkSprite(SPRITES.powerUps.softPretzel, 8, 8, 'softPretzel'));
  });

  it('package (8x8) with blink frames', () => {
    checkSprite(SPRITES.package, 8, 8, 'package');
    expect(SPRITES.package.frames!.length).toBeGreaterThanOrEqual(2);
  });

  it('bench (16x8)', () => checkSprite(SPRITES.bench, 16, 8, 'bench'));
  it('plant (8x16)', () => checkSprite(SPRITES.plant, 8, 16, 'plant'));
  it('pillar (8x24)', () => checkSprite(SPRITES.pillar, 8, 24, 'pillar'));
  it('head icon (8x8)', () => checkSprite(SPRITES.headIcon, 8, 8, 'headIcon'));

  describe('fixtures (16x16)', () => {
    it('closed', () => checkSprite(SPRITES.fixtures.closed, 16, 16, 'fixture.closed'));
    it('opened', () => checkSprite(SPRITES.fixtures.opened, 16, 16, 'fixture.opened'));
  });

  it('all pixel values are 0-3 across all sprites', () => {
    checkPixelValues(SPRITES.agent.mall.stand, 'agent.mall.stand');
    checkPixelValues(SPRITES.spy.mall.stand, 'spy.mall.stand');
    checkPixelValues(SPRITES.securityBot, 'securityBot');
    checkPixelValues(SPRITES.bullets.player, 'bullet.player');
    checkPixelValues(SPRITES.elevator.closed, 'elevator.closed');
    checkPixelValues(SPRITES.coin, 'coin');
    checkPixelValues(SPRITES.package, 'package');
  });
});
