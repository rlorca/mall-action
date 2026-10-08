/**
 * Render every store room to a PNG so you can LOOK at it.
 *
 *   npx tsx scripts/store-preview.ts [outDir] [scale]
 *
 * Writes <outDir>/store-<id>.png (guards on, first-visit chatter on) plus a few scenes of the
 * special rules (GameStonk typewriter, KGB toys, search in progress, package found). Open the
 * PNGs with an image viewer / the Read tool. Scenes that need sprites which do not exist yet
 * are skipped with a message.
 */
import { Framebuffer } from '../src/engine/framebuffer';
import { C } from '../src/engine/palette';
import { OPEN_STORES } from '../src/content/stores';
import { drawStoreView } from '../src/render/storeView';
import { makeWorld, type Made } from '../src/game/store/testutil';
import { writeFramebufferPng } from './png';
import '../src/art/index';

const outDir = process.argv[2] ?? 'playtest-out';
const scale = Number(process.argv[3] ?? 3);

function shot(name: string, m: Made, frame: number): void {
  const fb = new Framebuffer();
  fb.clear(C.BLACK);
  fb.fillRect(0, 0, 256, 16, C.DKBLUE); // stand-in for the HUD strip
  try {
    drawStoreView(fb, m.world, frame);
    writeFramebufferPng(fb, `${outDir}/${name}.png`, scale);
    console.log('wrote', `${outDir}/${name}.png`);
  } catch (e) {
    console.log('skipped', name, '-', (e as Error).message);
  }
}

for (const def of OPEN_STORES) {
  const m = makeWorld(def.id, { guards: true, seen: false, seed: 3 });
  m.pilot.idle(30);
  shot(`store-${def.id}`, m, 30);
}

// searching, with the Radar flashing "!" over the package fixture
{
  const m = makeWorld('radioshock', { guards: true, seed: 3 });
  m.run.givePower('radar');
  m.world.teleportAgent(2, 2);
  m.pilot.tap('B');
  m.pilot.idle(20);
  shot('scene-searching', m, 20);
}
// the GameStonk clerk typing
{
  const m = makeWorld('gamestonk', { egg: true, guards: true, seed: 3 });
  m.pilot.idle(70);
  shot('scene-egg-typing', m, 70);
}
// KGB toys marching
{
  const m = makeWorld('kgbtoys', { guards: true, seed: 3 });
  m.world.teleportAgent(5, 2);
  m.world.agent.facing = 'up';
  m.pilot.step('A');
  m.pilot.idle(30);
  m.world.teleportAgent(12, 8);
  shot('scene-toys', m, 40);
}
// Sam Baddy booth
{
  const m = makeWorld('sambaddy', { seed: 3 });
  m.world.teleportAgent(11, 3);
  m.pilot.idle(5);
  shot('scene-booth', m, 5);
}
// package found
{
  const m = makeWorld('footlock', { seed: 3 });
  const i = m.world.store.fixtures.findIndex((f) => f.content.kind === 'package');
  const f = m.world.room.fixtures[i]!;
  m.world.teleportAgent(f.col, f.row + 1);
  m.pilot.tap('B');
  for (let k = 0; k < 60 && !m.world.fixtureOpened(i); k++) m.pilot.step();
  m.pilot.idle(10);
  shot('scene-package', m, 10);
}
