import { Container, Graphics, Sprite } from 'pixi.js';
import { makeText, setText } from '../gfx/font.js';
import { makeSprite } from '../gfx/textures.js';
import { C } from '../gfx/palette.js';

export const CARD_W = 176, CARD_H = 132;

// A SPYGRAM post card: header, photo of the agent, two caption lines, likes, one comment.
export function buildSpygram(post, { photo = 'agentStand', photoFrame = 0 } = {}) {
  const c = new Container();
  c.addChild(new Graphics().rect(0, 0, CARD_W, CARD_H).fill(C.white).rect(0, 0, CARD_W, CARD_H).stroke({ color: C.black, width: 1 })
    .rect(0, 0, CARD_W, 14).fill(C.magenta).rect(40, 16, 96, 52).fill(C.sky));
  const head = makeText('SPYGRAM', C.white); head.position.set(8, 3); c.addChild(head);
  const me = makeSprite(photo, photoFrame); me.scale.set(2); me.position.set(88 - me.width / 2, 18); c.addChild(me);
  post.caption.split('\n').forEach((line, i) => { const t = makeText(line, C.black); t.position.set(6, 72 + i * 10); c.addChild(t); });
  const likes = makeText('', C.red); likes.position.set(6, 94); c.addChild(likes);
  const comment = makeText(post.comment, C.darkGrey); comment.position.set(6, 108); c.addChild(comment);
  return { container: c, setLikes: (n) => setText(likes, `♥ ${n} LIKES`, C.red) };
}

// likes climb fast, then slow down
export const likesAt = (frames) => Math.min(999, Math.floor(frames ** 1.6 / 4));
