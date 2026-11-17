import {byId,clamp,rooms,solidTile,tilePixel} from './data.js';
import {gifts,visits,words} from './copy.js';
import {buttons} from './input.js';
import {integer,pick,random} from './random.js';
import {announce,awardPackage,bubble,difficulty,givePower,hurt,points,sound,speed,updateEffects} from './rules.js';

const {up,down,left,right,a,b} = buttons;
const motion = [[up,0,-1],[down,0,1],[left,-1,0],[right,1,0]];
const direction = held => motion.find(([bit])=>bit & held) ?? [0,0,0];
const near = (a,b,d) => Math.abs(a-b)<=d;
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const pixel = ({x,y}) => ({x:tilePixel(x),y:tilePixel(y)});
export const at = (room,x,y) => room.layout[y]?.[x];
export const blocked = (room,x,y) => {
  const tile = at(room,x,y);
  return tile===undefined || solidTile(tile);
};

export function beginTransition(state,shop) {
  state.transition = {left:24,to:shop?'store':'mall',shop};
  sound(state,'door');
}
export function enterStore(state,id) {
  const room = rooms[id], shop = byId[id], start = pixel({x:room.door.x,y:room.door.y-1});
  const first = !state.visited.includes(id);
  if (first) state.visited.push(id);
  const guards = room.guards.map((tile,i)=>({
    ...pixel(tile), tx:tile.x,ty:tile.y,dx:i%2?-1:1,dy:0,kind:shop.guards[i]??'spy',
    hp:shop.guards[i]==='bot'?3:1,stun:0,dead:0,aim:0,shot:0,to:null
  }));
  state.room = {
    id,...start,dx:0,dy:-1,safe:start,guards,bullets:[],toys:[],particles:[],bubbles:[],
    grace:130,stun:0,cooldown:0,age:0,search:null,visit:first && visits[id] ? 115 : 0,
    cave:first && id==='games'?165:0,gift:first && id==='games'?pick(state,gifts):null,
    released:[],sideB:false,moving:false
  };
  if (state.room.visit && guards[0]) bubble(state,'room',guards[0].x,guards[0].y-12,visits[id][0],71);
}
export function tickTransition(state) {
  const t = state.transition;
  if (--t.left===12) {
    if (t.to==='store') enterStore(state,t.shop);
    else {
      state.room = null;
      state.player.invulnerable = Math.max(state.player.invulnerable,42);
    }
    state.scene = t.to;
  }
  if (t.left===0) state.transition = null;
}

function fits(room,x,y,radius=5) {
  const x0=Math.floor((x-radius)/16), x1=Math.floor((x+radius)/16);
  const y0=Math.floor((y-radius)/16), y1=Math.floor((y+radius)/16);
  return !blocked(room,x0,y0) && !blocked(room,x0,y1) && !blocked(room,x1,y0) && !blocked(room,x1,y1);
}
function nudge(r,room,dx,dy,amount) {
  const x = r.x + dx*amount, y = r.y + dy*amount;
  if (fits(room,x,y)) {
    Object.assign(r,{x,y,moving:true});
    return;
  }
  const opposite = dx ? r.y : r.x;
  for (const shift of [-1,1,-2,2,-3,3,-4,4,-5,5]) {
    if (!fits(room,x+dy*shift,y+dx*shift)) continue;
    if (dx) r.y = opposite+Math.sign(shift)*amount;
    else r.x = opposite+Math.sign(shift)*amount;
    r.moving = true;
    return;
  }
}

export function nearbyFixture(state) {
  const r = state.room, info = rooms[r.id], data = state.rooms[r.id];
  let best = null, bestScore = Infinity;
  for (const [i,f] of info.fixtures.entries()) {
    if (data.opened.includes(i)) continue;
    const dx = tilePixel(f.x)-r.x, dy = tilePixel(f.y)-r.y;
    if (Math.abs(dx)>16 || Math.abs(dy)>16 || Math.abs(dx)+Math.abs(dy)>24) continue;
    const score = Math.hypot(dx,dy)-(dx*r.dx+dy*r.dy)*.12;
    if (score<bestScore) {
      best = {index:i,dx,dy};
      bestScore = score;
    }
  }
  return best;
}
function startSearch(state) {
  const r = state.room, hit = nearbyFixture(state);
  if (!hit) return;
  if (Math.abs(hit.dx)>Math.abs(hit.dy)) Object.assign(r,{dx:Math.sign(hit.dx),dy:0});
  else Object.assign(r,{dx:0,dy:Math.sign(hit.dy)||1});
  const total = state.power.speed?.id==='sneakers'?30:45;
  r.search = {index:hit.index,left:total,total,heldDir:0};
  sound(state,'search');
}
function finishSearch(state,search) {
  const r = state.room,data = state.rooms[r.id], fixture = rooms[r.id].fixtures[search.index];
  const x = tilePixel(fixture.x), y=tilePixel(fixture.y);
  if (fixture.type==='F' && random(state)<.25) {
    const tx=clamp(fixture.x===1?2:13,1,14), ty=fixture.y+1;
    r.guards.push({x:tilePixel(tx),y:tilePixel(ty),tx,ty,dx:0,dy:1,kind:'spy',hp:1,stun:25,dead:0,aim:0,shot:100,to:null});
    const dirX = Math.abs(r.x-x)>Math.abs(r.y-y)?Math.sign(r.x-x):0;
    r.bullets.push({x,y,vx:dirX*2,vy:dirX?0:Math.sign(r.y-y)*2,team:'guard',kind:'shoe',left:115});
    bubble(state,'room',x,y-13,words.occupied);
    sound(state,'shriek');
    return;
  }
  data.opened.push(search.index);
  const item = data.contents[search.index];
  if (item==='package') awardPackage(state,r.id,r.x,r.y-11);
  else if (item==='trap' || item==='empty') {
    announce(state,item==='trap'?words.trap:words.nothing,75,item==='trap'?'red':'cream');
    sound(state,'smoke');
    r.particles.push({x,y,text:'',left:34});
    if (item==='trap') r.stun = 60;
  } else givePower(state,item,'room',r.x,r.y-12);
}
function fireStore(state,r) {
  const weapon = state.power.weapon?.id;
  const count = new Set(r.bullets.filter(s=>s.team==='player').map(s=>s.volley)).size;
  if (r.cooldown || count>=(weapon==='rapid'?4:2)) return;
  const volley = ++state.nextId;
  for (const spread of (weapon==='spread'?[0,.65,-.65]:[0])) {
    r.bullets.push({x:r.x+r.dx*6,y:r.y+r.dy*6,vx:4*r.dx+r.dy*spread,vy:4*r.dy-r.dx*spread,volley,team:'player',left:140});
  }
  r.cooldown = weapon==='rapid'?9:19;
  sound(state,'shot');
}
function guardKilled(state,g) {
  if (g.dead) return;
  g.dead = 25;
  g.hp = 0;
  points(state,100,'room',g.x,g.y-15);
  sound(state,'hurt');
}
function chooseTile(state,g,r,info) {
  const options = motion.map(([,dx,dy])=>({x:g.tx+dx,y:g.ty+dy,dx,dy}))
    .filter(o=>!blocked(info,o.x,o.y) && at(info,o.x,o.y)!=='e');
  if (!options.length) return null;
  if (g.kind==='bot') {
    return options.find(o=>o.dx===g.dx && o.dy===g.dy) ??
      options.find(o=>o.dx===-g.dx && o.dy===-g.dy) ?? options[0];
  }
  const score = o=>Math.hypot(tilePixel(o.x)-r.x,tilePixel(o.y)-r.y);
  return random(state)<.78?options.sort((a,b)=>score(a)-score(b))[0]:pick(state,options);
}
function sight(info,r,g) {
  const dx = r.x-g.x, dy = r.y-g.y;
  if (Math.abs(dx)>7 && Math.abs(dy)>7 || Math.abs(dx)+Math.abs(dy)<20) return null;
  const vx = Math.abs(dx)>Math.abs(dy)?Math.sign(dx):0;
  const vy = vx?0:Math.sign(dy);
  for (let i=8;i<Math.max(Math.abs(dx),Math.abs(dy));i+=4) {
    if (blocked(info,Math.floor((g.x+vx*i)/16),Math.floor((g.y+vy*i)/16))) return null;
  }
  return {dx:vx,dy:vy};
}
function tickGuards(state,r,info) {
  r.guards = r.guards.filter(g=>!g.dead || --g.dead>0);
  const d = difficulty(state.loop,state.alarm);
  for (const g of r.guards) {
    if (g.dead) continue;
    if (g.stun) {
      g.stun--;
      continue;
    }
    if (g.shot) g.shot--;
    if (!r.grace && dist(r,g)<12) {
      if (state.power.cinna) guardKilled(state,g);
      else hurt(state);
    }
    if (g.aim) {
      if (--g.aim===0) {
        r.bullets.push({x:g.x+g.dx*6,y:g.y+g.dy*6,vx:2*g.dx,vy:2*g.dy,team:'guard',left:130});
        sound(state,'foeShot');
        g.shot = d.shot-30;
      }
      continue;
    }
    const target = !r.grace && !g.shot && g.kind==='spy' && sight(info,r,g);
    if (target) {
      g.aim = 30;
      Object.assign(g,target);
      continue;
    }
    g.to ??= chooseTile(state,g,r,info);
    if (!g.to) continue;
    const pos = pixel(g.to);
    const amount = (g.kind==='bot'?.67:.48) * d.speed;
    g.x += clamp(pos.x-g.x,-amount,amount);
    g.y += clamp(pos.y-g.y,-amount,amount);
    g.dx = g.to.dx;
    g.dy = g.to.dy;
    if (g.x===pos.x && g.y===pos.y) {
      g.tx = g.to.x;
      g.ty = g.to.y;
      g.to = null;
    }
  }
}
function releaseToys(state,r,info,x,y,shot) {
  const i = info.fixtures.findIndex(f=>f.x===x && f.y===y && f.type==='t');
  if (i===-1 || r.released.includes(i)) return;
  r.released.push(i);
  const dir = Math.abs(shot.vx)>Math.abs(shot.vy) ? [Math.sign(shot.vx),0] : [0,Math.sign(shot.vy)];
  for (let n=0;n<3;n++) {
    const px=shot.x-dir[0]*(4+n*4), py=shot.y-dir[1]*(4+n*4);
    r.toys.push({x:px,y:py,dx:dir[1]*(n===1?-1:1),dy:dir[0]*(n===1?1:-1),left:365,phase:n*7});
  }
  sound(state,'toy');
}
function tickShots(state,r,info) {
  r.bullets = r.bullets.filter(shot=>{
    shot.x += shot.vx;
    shot.y += shot.vy;
    const x=Math.floor(shot.x/16),y=Math.floor(shot.y/16);
    if (--shot.left<=0) return false;
    if (blocked(info,x,y) && shot.kind!=='shoe') {
      if (shot.team==='player' && r.id==='toys') releaseToys(state,r,info,x,y,shot);
      return false;
    }
    if (shot.team==='guard') {
      if (dist(r,shot)>8) return true;
      hurt(state);
      return false;
    }
    const target = r.guards.find(g=>!g.dead && dist(g,shot)<8);
    if (!target) return true;
    target.hp--;
    if (!target.hp) guardKilled(state,target);
    else {
      target.stun = 15;
      sound(state,'ping');
    }
    return false;
  });
}
function tickToys(state,r,info) {
  const data = state.rooms[r.id];
  r.toys = r.toys.filter(toy=>{
    if (--toy.left===0) return false;
    if (toy.phase>0) {
      toy.phase--;
      return true;
    }
    let {x,y,dx,dy}=toy;
    const solid = (xx,yy)=>blocked(info,Math.floor(xx/16),Math.floor(yy/16));
    for (const [i,f] of info.fixtures.entries()) {
      if (data.contents[i]==='trap' && !data.opened.includes(i) &&
        near(tilePixel(f.x),x+dx*6,11) && near(tilePixel(f.y),y+dy*6,11)) {
        data.opened.push(i);
        const pos=pixel(f);
        r.particles.push({...pos,text:'',left:36});
        for (const g of r.guards) if (dist(g,pos)<40) g.stun=105;
        sound(state,'smoke');
      }
    }
    if (solid(x+dx*3,y+dy*3)) [dx,dy]=[-dy,dx];
    if (!solid(x+dx*1.2,y+dy*1.2)) {
      x+=dx*1.2;
      y+=dy*1.2;
    }
    Object.assign(toy,{x,y,dx,dy});
    for (const g of r.guards) if (dist(g,toy)<10) g.stun=104;
    return true;
  });
}

export function tickStore(state,input) {
  const r = state.room, info = rooms[r.id], p = state.player;
  updateEffects(r);
  r.age++;
  r.moving = false;
  if (r.cave>0) {
    if (r.cave%5===0 && r.cave>36) sound(state,'text');
    r.cave--;
    return;
  }
  if (r.visit>0) {
    if (--r.visit===55 && visits[r.id][1]) {
      const speaker = r.guards[1] ?? r.guards[0];
      bubble(state,'room',speaker.x,speaker.y-12,visits[r.id][1],72);
    }
    return;
  }
  if (r.grace) r.grace--;
  if (r.cooldown) r.cooldown--;
  if (r.stun) r.stun--;
  const [bit,dx,dy] = direction(input.held);
  if (!r.stun && !p.frozen && !p.death) {
    if (r.search) {
      const freshDirection = input.pressed & (up|down|left|right);
      if ((freshDirection & ~r.search.heldDir) || input.pressed & a) r.search = null;
      else {
        if (--r.search.left===0) {
          finishSearch(state,r.search);
          r.search = null;
        } else if (r.search.left%11===0) sound(state,'search');
        tickGuards(state,r,info);
        tickShots(state,r,info);
        tickToys(state,r,info);
        return;
      }
    }
    if (input.pressed & b) {
      startSearch(state);
      if (r.search) r.search.heldDir = bit;
    }
    if (!r.search && bit && !r.stun) {
      Object.assign(r,{dx,dy});
      nudge(r,info,dx,dy,speed(state));
    }
    if (!r.search && input.held & a) fireStore(state,r);
    if (r.y>=tilePixel(info.door.y)+2 && near(r.x,tilePixel(info.door.x),8)) {
      beginTransition(state,null);
      return;
    }
    if (info.bonus) {
      const on = dist(r,pixel(info.bonus))<11;
      if (on && !r.sideB) announce(state,words.sideB,110,'pink');
      r.sideB = on;
    }
    if (r.gift && info.pedestal && dist(r,pixel(info.pedestal))<11) {
      state.inventory.push(r.gift);
      points(state,1,'room',r.x,r.y-12);
      announce(state,words.gift+r.gift,125,'pink');
      r.gift = null;
      r.particles.push({x:tilePixel(8),y:tilePixel(1),text:'',left:36});
      state.pickup = {id:'gift',left:65};
      sound(state,'item');
    }
  }
  tickGuards(state,r,info);
  tickShots(state,r,info);
  tickToys(state,r,info);
}
