import { describe, expect, it } from 'vitest';
import { buildSprites } from '../src/core/sprites';
import { checkSprite, MAX_SPRITE_COLOURS } from '../src/core/pixels';

const SIZES: [RegExp, number, number][] = [
  [/^agent_/, 16, 24],
  [/^spy_/, 16, 24],
  [/^janitor_|^walker_|^cop_/, 16, 24],
  [/^bullet_/, 4, 2],
  [/^coin/, 8, 8],
  [/^package$/, 12, 10],
  [/^lamp$/, 16, 16],
  [/^disco$/, 16, 16],
  [/^kiosk$/, 16, 24],
  [/^smoke$/, 16, 16],
  [/^security_bot$/, 16, 16],
  [/^windup_toy$/, 8, 8],
  [/^segway$/, 16, 16],
  [/^pu_/, 8, 8],
];

describe('sprites', () => {
  const sprites = buildSprites();

  it('builds the required set, including every agent and spy pose', () => {
    for (const pose of ['stand', 'walkA', 'walkB', 'jump', 'kick', 'duck', 'aim', 'dead', 'zip']) {
      expect(sprites[`agent_${pose}`]).toBeDefined();
      expect(sprites[`spy_${pose}`]).toBeDefined();
    }
    for (const id of ['rapid', 'spread', 'armor', 'sneakers', 'radar', 'oneup', 'cinnabomb', 'juli', 'pretzel']) {
      expect(sprites[`pu_${id}`]).toBeDefined();
    }
  });

  it('gives every sprite the right size and at most three colours plus transparent', () => {
    const problems: string[] = [];
    for (const [name, s] of Object.entries(sprites)) {
      const rule = SIZES.find(([re]) => re.test(name));
      if (!rule) {
        problems.push(`${name}: no size rule`);
        continue;
      }
      for (const issue of checkSprite(s, rule[1], rule[2])) problems.push(`${issue.sprite}: ${issue.problem}`);
      expect(s.bitmap.colourIndices().length).toBeLessThanOrEqual(MAX_SPRITE_COLOURS);
    }
    expect(problems).toEqual([]);
  });
});
