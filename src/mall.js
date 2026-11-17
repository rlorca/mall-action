import {booth,byId,car,clamp,escalators,floorAt,floors,foodPowers,fountains,kiosks,lamps,powers,shafts,shops,WORLD} from './data.js';
import {elevatorLines,floorAnnouncements,floorNames,lastWords,pa,words} from './copy.js';
import {buttons} from './input.js';
import {integer,pick,random} from './random.js';
import {announce,bubble,difficulty,givePower,handleExit,hurt,isOpen,points,shortestPackage,sound,speed,updateEffects} from './rules.js';
import {beginTransition} from './store.js';

const {up,down,left,right,a,b} = buttons;
const near = (x,target,distance) => Math.abs(x-target)<=distance;
const served = (shaft,floor) => floor>=shaft.top && floor<=shaft.bottom;
const motorInput = held => (held & down ? 1 : 0) - (held & up ? 1 : 0);
const horizontal = held => (held & right ? 1 : 0) - (held & left ? 1 : 0);
const vulnerable = p => !p.hidden && !p.death;
const nextLanding = (shaft,y,dir) => dir>0
  ? floors.find((level,i)=>i<=shaft.bottom && level>y)
  : floors.findLast((level,i)=>i>=shaft.top && level<y);

export function killSpy(state,spy,award=100) {
  if (spy.dead) return;
  spy.dead = 25;
  points(state,award,'mall',spy.x,floors[spy.floor]-22);
  sound(state,'hurt');
  if (random(state)<.35) bubble(state,'mall',spy.x,floors[spy.floor]-27,pick(state,lastWords));
  if (random(state)<.05) {
    const pool = random(state)<.5?foodPowers:powers.slice(0,6);
    state.mall.drops.push({x:spy.x,floor:spy.floor,id:pick(state,pool),left:660});
  }
}

function safeCall(state,index,floor) {
  const c = state.mall.cars[index];
  if (c.call===floor || c.y===floors[floor] && !c.direction) return;
  c.call = floor;
  c.target = floors[floor];
  c.direction = Math.sign(c.target-c.y) || c.direction;
}

export function updateElevators(state,held) {
  const p = state.player;
  for (const [index,shaft] of shafts.entries()) {
    const c = state.mall.cars[index], oldY = c.y;
    const occupied = p.ride===index;
    const dir = occupied && !shaft.auto && !p.frozen && !p.death ? motorInput(held) : 0;
    if (dir && !c.direction) {
      const landing = nextLanding(shaft,c.y,dir);
      if (landing!==undefined) {
        c.direction = dir;
        c.target = landing;
      }
    }
    if (shaft.auto && !c.direction && !occupied && --c.wait<=0) {
      const choices = floors.slice(shaft.top,shaft.bottom+1).filter(y=>y!==c.y);
      c.target = pick(state,choices);
      c.direction = Math.sign(c.target-c.y);
    }
    if (c.direction) {
      c.y += c.direction;
      if (c.y === c.target) {
        const next = dir===c.direction && c.call===null ? nextLanding(shaft,c.y,c.direction) : undefined;
        if (next!==undefined) c.target = next;
        else {
          c.direction = 0;
          c.wait = 120;
          const floor = floorAt(c.y);
          if (near(p.x,shaft.x,175) && Math.abs(p.y-c.y)<105) {
            sound(state,'ding');
            if (!occupied && state.elapsed>360 && floor>0 && floor<5 && state.mall.spies.length<difficulty(state.loop,state.alarm,state.blackFriday).cap && random(state)<.14) {
              const spy = spawnSpy(state,shaft.x+14,floor);
              bubble(state,'mall',spy.x,c.y-26,pick(state,elevatorLines));
            }
          }
          if (occupied) announce(state,floorNames[floor]+' - '+floorAnnouncements[floor],105);
        }
      }
    }
    const stoppedHere = !c.direction && c.call!==null && c.y===floors[c.call];
    if (c.y>oldY) {
      if (p.ride===null && p.roof!==index && near(p.x,shaft.x,10) && p.fallFrom===null &&
          served(shaft,p.floor) && p.y<=c.y && p.y>=c.y-23 && c.call!==p.floor && vulnerable(p) &&
          (p.y>=oldY-23 && p.y<=oldY || p.y===c.y-23)) {
        if (hurt(state,'crush',true)) state.mall.shake = 15;
      }
      for (const spy of state.mall.spies) {
        const y = floors[spy.floor];
        if (served(shaft,spy.floor) && near(spy.x,shaft.x,10) && y===c.y-23) {
          killSpy(state,spy,300);
          state.mall.shake = 15;
        }
      }
    }
    if (occupied) {
      p.y = c.y;
      if (floorAt(c.y)!==-1) p.floor = floorAt(c.y);
    }
    if (p.roof===index) {
      p.y = c.y-23;
      if (c.y<=floors[shaft.top] && c.y<oldY) {
        if (hurt(state,'crush',true)) state.mall.shake = 15;
      }
    }
    if (stoppedHere) {
      if (!p.air && !p.stairs && !p.death && p.ride===null && p.roof===null &&
          p.floor===c.call && near(p.x,shaft.x,19)) {
        p.x = shaft.x;
        p.ride = index;
        p.callWait = 0;
        announce(state,floorNames[p.floor]+' - '+floorAnnouncements[p.floor],105);
      }
      c.call = null;
    }
  }
}
const opening = (floor,x,radius=9) => shafts.findIndex(s=>served(s,floor) && near(x,s.x,radius));
const pit = (state,floor,x) => {
  const index = opening(floor,x);
  return index!==-1 && state.mall.cars[index].y>floors[floor] ? index : -1;
};

function interact(state,input) {
  const p = state.player;
  const {pressed,held} = input;
  const movement = horizontal(held);
  const index = opening(p.floor,p.x,18);
  if (index!==-1) {
    const shaft = shafts[index], c = state.mall.cars[index];
    if (pressed & (up|down) || (!movement && ++p.callWait===30 && c.y!==p.y)) {
      if (!c.direction && c.y===p.y) {
        p.ride = index;
        p.x = shaft.x;
        p.duck = false;
      } else safeCall(state,index,p.floor);
      return true;
    }
  } else p.callWait = 0;
  if (!(pressed & (up|down))) return false;
  const stairs = escalators.findIndex(e=>pressed & up && p.floor===e.bottom && near(p.x,e.bx,12) ||
    pressed & down && p.floor===e.top && near(p.x,e.tx,12));
  if (stairs!==-1) {
    p.stairs = {index:stairs,up:p.floor===escalators[stairs].bottom,age:0};
    p.duck = false;
    sound(state,'slide');
    return true;
  }
  if (p.floor===car.floor && near(p.x,car.x,23)) {
    handleExit(state);
    return true;
  }
  if (p.floor===booth.floor && near(p.x,booth.x,13)) {
    p.hidden = 300;
    p.x = booth.x;
    sound(state,'door');
    return true;
  }
  const kiosk = kiosks[p.floor];
  if (kiosk && near(p.x,kiosk,13) && !state.mall.kiosks[p.floor]) {
    state.mall.kiosks[p.floor] = 1200;
    state.kiosk = {shop:shortestPackage(state,p.floor,p.x)?.id,left:210};
    sound(state,'item');
    return true;
  }
  const shop = shops.find(s=>s.floor===p.floor && near(p.x,s.x,11) && isOpen(state,s.id));
  if (shop) {
    p.safe = {x:shop.x,floor:p.floor};
    beginTransition(state,shop.id);
    return true;
  }
  return false;
}

function leaveBooth(state) {
  if (state.photo) return;
  state.photo = true;
  state.inventory.push(words.booth);
  state.capture = {left:165};
  sound(state,'item');
}
const inWet = (state,floor,x) => {
  const patch = state.mall.janitor.patch;
  return floor===4 && patch && near(x,patch.x,24);
};
const standingSafe = (state,p) => opening(p.floor,p.x,22)===-1 && !inWet(state,p.floor,p.x);

function jump(state,move) {
  const p = state.player;
  p.kick = Boolean(move || p.slide);
  p.airDrift = move || p.slide || 0;
  p.vy = state.power.speed?.id==='sneakers'?-4.65:-3.9;
  p.air = true;
  p.duck = false;
  p.roof = null;
  sound(state,'jump');
}
function updateFall(state) {
  const p = state.player, before = p.y;
  p.y += p.vy;
  p.vy += .38;
  if (p.vy<0) return;
  if (p.fallFrom!==null) {
    const c = state.mall.cars[p.fallFrom.index];
    const limit = p.fallFrom.y+49;
    const roof = c.y-23;
    if (c.y<=limit && p.y>=roof && before<=roof+4 &&
        (floorAt(c.y)!==-1 || c.y>p.fallFrom.y)) {
      p.air = false;
      p.roof = p.fallFrom.index;
      p.fallFrom = null;
      p.kick = false;
      p.vy = 0;
      p.y = roof;
      sound(state,'land');
    } else if (p.y>limit) {
      hurt(state,'crush',true);
      state.mall.shake = 17;
    }
    return;
  }
  const ground = floors[p.floor];
  if (p.y>=ground) {
    p.y = ground;
    p.vy = 0;
    const index = pit(state,p.floor,p.x);
    if (index!==-1) startFall(p,index);
    else {
      p.air = false;
      p.kick = p.kick && Boolean(inWet(state,p.floor,p.x));
    }
  }
}
function startFall(p,index) {
  p.fallFrom = {index,y:floors[p.floor]};
  p.air = true;
  p.airDrift = 0;
  p.vy = .25;
}
function boardableCar(state,p) {
  const index = opening(p.floor,p.x,7);
  if (index===-1) return null;
  const c = state.mall.cars[index];
  return !c.direction && c.y===p.y ? index : null;
}
function fireMall(state) {
  const p = state.player, m = state.mall;
  const weapon = state.power.weapon?.id;
  const count = new Set(m.bullets.filter(s=>s.team==='player').map(s=>s.volley)).size;
  if (p.cooldown || count>=(weapon==='rapid'?4:2)) return;
  const volley = ++state.nextId;
  const height = p.duck ? 6 : 15;
  const angles = weapon==='spread' ? [0,-.48,.48] : [0];
  for (const vy of angles) m.bullets.push({team:'player',x:p.x+p.dir*9,y:p.y-height,vx:4*p.dir,vy,volley,floor:p.floor});
  p.cooldown = weapon==='rapid'?9:19;
  sound(state,'shot');
  const cop = m.cop;
  const delta = p.x-cop.x;
  if (p.floor===cop.floor && near(p.x,cop.x,128) && Math.sign(delta)===cop.dir && !cop.chase) {
    cop.chase = 600;
    bubble(state,'mall',cop.x,floors[cop.floor]-29,words.cop,115);
    sound(state,'whistle');
  }
}

export function updatePlayer(state,input) {
  const p = state.player, {held,pressed} = input;
  const move = horizontal(held);
  p.moving = false;
  if (p.death || p.frozen) return;
  if (p.hidden) {
    if (pressed & (up|down|left|right|b) || --p.hidden<=0) {
      p.hidden = 0;
      leaveBooth(state);
    }
    return;
  }
  if (p.stairs) {
    const ride = p.stairs, esc = escalators[ride.index], t = Math.min(1,++ride.age/54);
    const progress = ride.up?t:1-t;
    p.x = esc.bx+(esc.tx-esc.bx)*progress;
    p.y = floors[esc.bottom]-48*progress;
    p.dir = ride.up?1:-1;
    if (t===1) {
      p.floor = ride.up?esc.top:esc.bottom;
      p.stairs = null;
      p.safe = {x:p.x,floor:p.floor};
    }
    return;
  }
  if (p.ride!==null) {
    const i = p.ride, c = state.mall.cars[i];
    if (!c.direction && move) {
      p.x = shafts[i].x+move*12;
      p.dir = move;
      p.ride = null;
    } else return;
  }
  if (p.roof!==null) {
    const c = state.mall.cars[p.roof];
    const above = floorAt(c.y)-1;
    if (above>=0 && !c.direction && (move || pressed & b)) {
      p.floor = above;
      p.x += (move || p.dir)*12;
      p.roof = null;
      p.y = floors[above];
      if (pressed & b) jump(state,move);
    } else {
      if (held & a) fireMall(state);
      return;
    }
  }
  if (!p.air && !p.slide && interact(state,input)) return;
  if (p.air && p.fallFrom===null && (pressed & (up|down))) {
    const index = opening(p.floor,p.x,18);
    if (index!==-1 && state.mall.cars[index].y!==floors[p.floor]) safeCall(state,index,p.floor);
  }
  if (!p.air && pressed & b) jump(state,move);
  const wet = !p.air && inWet(state,p.floor,p.x);
  if (wet && !p.slide) {
    p.slide = move || p.dir;
    sound(state,'slide');
  } else if (!wet && !p.air) {
    p.slide = 0;
    p.kick = false;
  }
  p.duck = !p.air && !wet && Boolean(held & down);
  const dx = p.fallFrom!==null?0:p.air?(p.kick?p.airDrift:move):wet?p.slide:p.duck?0:move;
  if (dx) {
    p.dir = dx;
    p.moving = true;
    p.x = clamp(p.x+dx*(wet?1:speed(state)),10,WORLD.width-10);
    p.callWait = 0;
  }
  if (p.air) updateFall(state);
  else {
    const index = pit(state,p.floor,p.x);
    if (index!==-1 && state.mall.cars[index].call!==p.floor) startFall(p,index);
    const ready = boardableCar(state,p);
    if (ready!==null && dx) {
      p.ride = ready;
      p.x = shafts[ready].x;
    }
    if (standingSafe(state,p)) p.safe = {x:p.x,floor:p.floor};
  }
  if (held & a) fireMall(state);
}

function spawnSpy(state,x,floor) {
  const spy = {
    id:++state.nextId,x,floor,dir:random(state)<.5?-1:1,age:0,next:120,aim:0,low:false,duck:0,
    seen:[],dead:0,wait:0,goal:null
  };
  state.mall.spies.push(spy);
  return spy;
}

export function updateSpies(state) {
  const m = state.mall,p = state.player, d = difficulty(state.loop,state.alarm,state.blackFriday);
  if (state.elapsed>=state.spawnAt && m.spies.length<d.cap) {
    const options = shops.filter(s=>isOpen(state,s.id) && Math.abs(s.floor-p.floor)<=1 &&
      near(p.x,s.x,200) && !near(p.x,s.x,63) && m.spies.every(spy=>spy.floor!==s.floor || !near(spy.x,s.x,24)));
    if (options.length) {
      const s = pick(state,options);
      spawnSpy(state,s.x,s.floor);
      state.spawnAt = state.elapsed+d.spawn;
    } else state.spawnAt = state.elapsed+30;
  }
  m.spies = m.spies.filter(spy=>!spy.dead || --spy.dead>0);
  for (const spy of m.spies) {
    if (spy.dead) continue;
    spy.age++;
    if (spy.duck) spy.duck--;
    const delta = p.x-spy.x;
    const sees = vulnerable(p) && p.floor===spy.floor && Math.abs(delta)<=160 &&
      !lamps.some((l,i)=>m.lights[i].dark && l.floor===spy.floor && near(p.x,l.x,23));
    if (spy.aim) {
      if (--spy.aim===0) {
        if (sees) {
          m.bullets.push({team:'spy',x:spy.x+spy.dir*9,y:floors[spy.floor]-(spy.low?6:15),vx:spy.dir*2,vy:0,floor:spy.floor});
          sound(state,'foeShot');
        }
        spy.next = spy.age+d.shot-30;
      }
      continue;
    }
    if (sees && spy.age>=spy.next && Math.abs(delta)>15) {
      spy.aim = 30;
      spy.low = random(state)<.38;
      spy.dir = Math.sign(delta);
      continue;
    }
    if (!sees && !spy.goal && spy.age%150===0 && random(state)<.45) {
      const options = shafts.filter(s=>served(s,spy.floor) && near(s.x,spy.x,140));
      if (options.length) spy.goal = pick(state,options).x;
    }
    if (!sees && spy.goal!==null && near(spy.x,spy.goal,2)) {
      if (++spy.wait<155) continue;
      spy.wait = 0;
      spy.goal = null;
    }
    let dx = sees ? (Math.abs(delta)>40?Math.sign(delta):0) :
      spy.goal!==null?Math.sign(spy.goal-spy.x):spy.dir;
    if (!dx || spy.duck) continue;
    if (inWet(state,spy.floor,spy.x)) {
      spy.slide ||= spy.dir;
      dx = spy.slide;
    } else spy.slide = 0;
    const next = spy.x+dx*(spy.slide?1:.63*d.speed);
    if (next<12 || next>WORLD.width-12 || pit(state,spy.floor,next)!==-1) {
      spy.dir *= -1;
      spy.goal = null;
    } else {
      spy.x = next;
      spy.dir = dx;
    }
  }
}

function addCoins(state,i) {
  const f = fountains[i], count = 3+integer(state,3), golden = random(state)<.05;
  for (let j=0;j<count;j++) state.mall.coins.push({
    x:f.x,y:floors[f.floor]-12,floor:f.floor,vy:-2-random(state)*2,
    vx:(j-(count-1)/2)*.75+.12,bounces:0,left:660,gold:golden && j===0
  });
  state.mall.fountains[i] = 900;
  sound(state,'coin');
}
function playerBullet(state,shot) {
  const m = state.mall, {x,y,vx}=shot;
  const f = fountains.findIndex((f,i)=>!m.fountains[i] && near(x,f.x,14) && near(y,floors[f.floor]-13,10));
  if (f!==-1) {
    addCoins(state,f);
    return true;
  }
  const i = lamps.findIndex((l,i)=>!m.lights[i].down && near(x,l.x,5) &&
    y>=floors[l.floor]-43 && y<=floors[l.floor]-14);
  if (i!==-1) {
    const l = lamps[i];
    m.lights[i].down = true;
    m.falling.push({i,x:l.x,y:floors[l.floor]-18,dir:Math.sign(vx),vy:.6,roll:false});
    sound(state,'fall');
    return true;
  }
  for (const spy of m.spies) {
    if (spy.dead || !near(y,floors[spy.floor]-13,14) || !near(x,spy.x,32)) continue;
    if (!spy.seen.includes(shot.volley)) {
      spy.seen.push(shot.volley);
      if (spy.seen.length>24) spy.seen.shift();
      if (!spy.aim && random(state)<.10) spy.duck = 29;
    }
    if (near(x,spy.x,7) && y>=floors[spy.floor]-(spy.duck?9:23) && y<=floors[spy.floor]) {
      killSpy(state,spy);
      return true;
    }
  }
  return false;
}
function updateShots(state) {
  const m = state.mall,p = state.player;
  m.bullets = m.bullets.filter(shot=>{
    shot.x += shot.vx;
    shot.y += shot.vy;
    const {x,y} = shot;
    if (x<0 || x>WORLD.width || y<15 || y>WORLD.height || Math.abs(x-p.x)>272) return false;
    for (const walker of m.walkers) {
      if (near(x,walker.x,7) && y>=floors[3]-24 && y<=floors[3]) {
        if (shot.team==='player') {
          points(state,-200,'mall',walker.x,floors[3]-24);
          bubble(state,'mall',walker.x,floors[3]-27,words.walker);
          sound(state,'ping');
        }
        return false;
      }
    }
    if (near(x,m.cop.x,7) && y>=floors[m.cop.floor]-24 && y<=floors[m.cop.floor]) {
      if (shot.team==='player') sound(state,'ping');
      return false;
    }
    if (shot.team==='player') return !playerBullet(state,shot);
    if (vulnerable(p) && near(x,p.x,7) && y>=p.y-(p.duck?9:22) && y<=p.y) {
      hurt(state);
      return false;
    }
    return true;
  });
}
function updateLights(state) {
  const m = state.mall,p = state.player;
  for (const light of m.lights) if (light.dark) light.dark--;
  m.falling = m.falling.filter(obj=>{
    const l = lamps[obj.i], ground = floors[l.floor];
    if (obj.roll) obj.x += obj.dir*2.5;
    else {
      obj.y = Math.min(ground-4,obj.y+obj.vy);
      obj.vy += .38;
    }
    if (vulnerable(p) && near(obj.x,p.x,10) && obj.y>=p.y-(p.duck?10:25) && obj.y<=p.y+3) hurt(state);
    for (const spy of m.spies) if (spy.floor===l.floor && near(obj.x,spy.x,10) && obj.y>=ground-23) killSpy(state,spy,300);
    if (obj.y<ground-4) return true;
    if (l.floor===3 && !obj.roll) {
      obj.roll = true;
      m.shake = 13;
      sound(state,'land');
      return true;
    }
    if (obj.roll && obj.x>8 && obj.x<WORLD.width-8 && pit(state,l.floor,obj.x)===-1) return true;
    m.lights[obj.i].dark = 120;
    m.shake = 15;
    sound(state,'glass');
    return false;
  });
}
function updatePeople(state) {
  const m = state.mall,p = state.player;
  const j = m.janitor;
  if (j.patch && --j.patch.left===0) j.patch = null;
  j.phase = (j.phase+1)%540;
  if (j.phase<490) {
    j.x += j.dir*.46;
    if (j.x<236 || j.x>358) j.dir *= -1;
  }
  if (j.phase===510) j.patch = {x:clamp(j.x,236,358),left:600};
  for (const w of m.walkers) {
    w.x += w.dir*.88;
    if (w.x<=w.min || w.x>=w.max) w.dir *= -1;
    if (vulnerable(p) && p.floor===3 && !p.air && !p.slide && p.ride===null && near(w.x,p.x,12)) {
      const pushed = clamp(p.x+w.dir*.88,10,WORLD.width-10);
      if (pit(state,p.floor,pushed)===-1) p.x = pushed;
    }
  }
  const c = m.cop;
  if (c.chase>0) {
    c.chase--;
    if (vulnerable(p) && c.floor===p.floor) {
      c.dir = Math.sign(p.x-c.x) || c.dir;
      if (near(p.x,c.x,10) && near(p.y,floors[c.floor],14)) {
        c.chase = 0;
        p.frozen = 180;
        points(state,-500,'mall',p.x,p.y-25);
        announce(state,words.detained,125,'red');
      }
    }
  }
  const next = c.x+c.dir*(c.chase?1.29:.55);
  if (next<18 || next>WORLD.width-18 || pit(state,c.floor,next)!==-1) c.dir *= -1;
  else c.x = next;
}
function updateLoot(state) {
  const m = state.mall,p = state.player;
  m.drops = m.drops.filter(d=>{
    if (vulnerable(p) && p.floor===d.floor && near(p.x,d.x,10) && !p.air) {
      givePower(state,d.id,'mall',d.x,p.y-22);
      return false;
    }
    return --d.left>0;
  });
  m.coins = m.coins.filter(c=>{
    const ground = floors[c.floor]-4;
    c.x += c.vx;
    c.y += c.vy;
    c.vy += .26;
    if (c.y>=ground) {
      c.y = ground;
      c.vy = ++c.bounces<4?-Math.abs(c.vy)*.6:0;
      if (c.bounces>=4) c.vx = 0;
    }
    if (vulnerable(p) && near(p.x,c.x,10) && c.y>=p.y-24 && c.y<=p.y) {
      if (c.gold) {
        state.lives++;
        sound(state,'item');
      } else {
        points(state,50,'mall',c.x,c.y-12);
        sound(state,'coin');
      }
      return false;
    }
    return --c.left>0;
  });
}

export function tickMall(state,input) {
  const m = state.mall,p = state.player;
  updateEffects(m);
  if (m.shake) m.shake--;
  for (let i=0;i<m.fountains.length;i++) if (m.fountains[i]) m.fountains[i]--;
  for (let i=0;i<m.kiosks.length;i++) if (m.kiosks[i]) m.kiosks[i]--;
  updateElevators(state,input.held);
  updatePlayer(state,input);
  if (state.scene!=='mall' || state.transition) return;
  updatePeople(state);
  updateSpies(state);
  updateShots(state);
  updateLights(state);
  updateLoot(state);
  if (!vulnerable(p)) return;
  for (const spy of m.spies) if (!spy.dead && near(p.y,floors[spy.floor],15) && near(p.x,spy.x,12)) {
    if (p.kick || state.power.cinna) killSpy(state,spy,p.slide?300:100);
    else hurt(state);
  }
}

export function tickSchedule(state) {
  if (!state.alarm && state.elapsed>=difficulty(state.loop).alarm) {
    state.alarm = true;
    announce(state,words.alarm,165,'red');
    sound(state,'alarm');
  }
  if (state.elapsed>=state.paAt) {
    state.paAt = state.elapsed+3600;
    const index = (state.paIndex+1+integer(state,pa.length-1))%pa.length;
    state.paIndex = index;
    announce(state,pa[index],215);
    sound(state,'pa');
  }
}
