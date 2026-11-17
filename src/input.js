export const buttons = {up:1,down:2,left:4,right:8,a:16,b:32,select:64,start:128,crt:256,mute:512};
export const padMask = 255;
const {up,down,left,right,a,b,select,start,crt,mute} = buttons;
const printed = {w:up,s:down,a:left,d:right,z:a,j:a,x:b,k:b,c:crt,m:mute};
const physical = {
  ArrowUp:up,ArrowDown:down,ArrowLeft:left,ArrowRight:right,KeyW:up,KeyA:left,KeyS:down,KeyD:right,
  KeyZ:a,KeyJ:a,KeyX:b,KeyK:b,KeyC:crt,KeyM:mute,Space:b,ShiftLeft:select,ShiftRight:select,Tab:select,Enter:start,NumpadEnter:start
};
export const mapKey = ({key,code}) => printed[key?.toLowerCase()] ?? physical[code] ?? 0;

export function createInput() {
  const keys = new Map();
  let held = 0, queued = [], devices = 0;
  function sync() {
    const next = [...keys.values()].reduce((bits,value)=>bits | value,devices);
    for (const bit of Object.values(buttons)) {
      if ((next & bit) !== (held & bit)) queued.push({bit,down:Boolean(next & bit)});
    }
    held = next;
  }
  let simulated = 0;
  return {
    keyDown(event) {
      if (keys.has(event.code)) return keys.get(event.code);
      const bit = mapKey(event);
      if (bit) keys.set(event.code,bit);
      sync();
      return bit;
    },
    keyUp(event) {
      const bit = keys.get(event.code);
      keys.delete(event.code);
      sync();
      return bit ?? 0;
    },
    gamepads(pads) {
      devices = 0;
      for (const pad of pads) if (pad?.connected) devices |= readPad(pad);
      sync();
    },
    next() {
      let changed = 0, pressed = 0;
      const order = [];
      let consumed = 0;
      for (const event of queued) {
        if (changed & event.bit) break;
        consumed++;
        changed |= event.bit;
        if (event.down) {
          simulated |= event.bit;
          pressed |= event.bit;
          order.push(event.bit);
        } else simulated &= ~event.bit;
      }
      queued = queued.slice(consumed);
      return {held:simulated,pressed,order};
    },
    clear() {
      keys.clear();
      held = devices = simulated = 0;
      queued = [];
    }
  };
}

export function readPad(pad) {
  const active = i => Boolean(pad.buttons[i]?.pressed);
  const [x,y] = pad.axes;
  return (active(12) || y < -.45 ? up : 0) | (active(13) || y > .45 ? down : 0) |
    (active(14) || x < -.45 ? left : 0) | (active(15) || x > .45 ? right : 0) |
    (active(0) ? a : 0) | (active(1) ? b : 0) | (active(8) ? select : 0) | (active(9) ? start : 0);
}

export function mask(input) {
  if (typeof input === 'number') return input;
  return (Array.isArray(input) ? input : typeof input === 'string' ? input.split(/[+, ]+/) :
    Object.keys(input ?? {}).filter(key => input[key])).reduce((bits,key)=>bits | (buttons[key.toLowerCase()] ?? 0),0);
}

export const konami = [up,up,down,down,left,right,left,right,b,a];
export function konamiStep(progress,bit) {
  const candidate = [...konami.slice(0,progress),bit];
  for (let length=Math.min(konami.length,candidate.length); length>0; length--) {
    if (konami.slice(0,length).every((key,i)=>key===candidate[candidate.length-length+i])) return length;
  }
  return 0;
}
