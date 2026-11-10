/** Dev helper: dump the sprite gallery to a PNG (npm run shot [out.png]). */
import { Fb } from '../src/gfx/fb';
import { SPRITES } from '../src/gfx/sprites';
import { PROPS } from '../src/gfx/props';
import { savePng } from './png';

const fb = new Fb(256, 240);
fb.clear(0x31);
let x = 2, y = 2, rowH = 0;
for (const [, s] of Object.entries(process.argv[3] === 'props' ? PROPS : { ...SPRITES, ...PROPS })) {
  if (x + s.w > 254) { x = 2; y += rowH + 2; rowH = 0; }
  fb.spr(s, x, y);
  x += s.w + 2;
  rowH = Math.max(rowH, s.h);
}
savePng(fb, process.argv[2] ?? 'shots/gallery.png', 4);
console.log('ok');
