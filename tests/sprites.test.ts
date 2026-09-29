import { describe, it, expect } from "vitest";
import { SPRITES } from "../src/graphics/sprites";
import { PAL } from "../src/graphics/palette";

describe("Sprite Graphics Pipeline & Palette constraints", () => {
  it("verifies every required sprite exists and uses at most 3 non-transparent colors", () => {
    const requiredSprites = [
      "agent_stand", "agent_walk_1", "agent_walk_2", "agent_jump", "agent_duck", "agent_shoot",
      "agent_td_down", "agent_td_up", "agent_td_right", "agent_td_left",
      "spy_stand", "spy_aim", "spy_duck", "spy_death", "spy_td_down",
      "sec_bot", "janitor", "walker", "cop_segway",
      "pw_rapid", "pw_spread", "pw_armor", "pw_sneakers", "pw_radar", "pw_1up",
      "pw_cinnabomb", "pw_juliooze", "pw_pretzel",
      "package", "wagon"
    ];

    requiredSprites.forEach((key) => {
      const sprite = SPRITES[key];
      expect(sprite, `Missing sprite: ${key}`).toBeDefined();

      // Ensure color palette contains at most 4 entries (1 transparent + max 3 colors)
      const nonTransparentColors = sprite.colors.filter((c) => c !== PAL.TRANSPARENT);
      expect(nonTransparentColors.length, `Sprite ${key} exceeds 3 color limit! (${nonTransparentColors.length} colors)`).toBeLessThanOrEqual(3);
    });
  });
});
