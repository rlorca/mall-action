import {byId,floors,foodPowers,rooms,shops,shafts,lamps,fountains,powers,kiosks} from './data.js';
import {arrivalPosts,clearPosts,headlines,powerNames,words} from './copy.js';
import {integer,pick,random} from './random.js';

export const difficulty = (loop,alarm=false,blackFriday=false) => ({
  speed:Math.min(1.85,1+.1*(loop-1)) * (alarm?1.25:1),
  shot:Math.max(60,Math.round(150 * .85**(loop-1))),
  spawn:Math.max(65,Math.round(275 * .85**(loop-1) * (alarm?.65:1) * (blackFriday?.5:1))),
  cap:blackFriday?8:4,
  alarm:Math.max(45,150-20*(loop-1))*60
});

export function newLevel(state) {
  state.elapsed = 0;
  state.packages = 0;
  state.alarm = false;
  state.escaped = false;
  state.paIndex = -1;
  state.paAt = 3600;
  state.spawnAt = state.blackFriday ? 150 : 300;
  state.nextId = 0;
  state.power = {};
  state.banner = null;
  state.overlay = null;
  state.capture = null;
  state.pickup = null;
  state.room = null;
  state.transition = null;
  state.kiosk = null;
  state.post = pick(state,arrivalPosts);
  state.rooms = {};
  for (const shop of shops) if (shop.layout) {
    const fixtures = rooms[shop.id].fixtures;
    const packageIndex = shop.role === 'target' ? integer(state,fixtures.length) : -1;
    state.rooms[shop.id] = {
      cleared:false, opened:[], contents:fixtures.map((_,i) => {
        if (i === packageIndex) return 'package';
        const selection = shop.id==='food' ? [...foodPowers,...foodPowers,...powers] : powers;
        if (state.blackFriday || random(state) < (shop.role === 'power' ? .54 : .24)) return pick(state,selection);
        if (shop.role === 'target' && random(state) < .20) return 'trap';
        return 'empty';
      })
    };
  }
  state.player = {
    x:105,y:floors[0],floor:0,dir:1,vy:0,air:false,kick:false,duck:false,
    ride:null,roof:null,stairs:null,fallFrom:null,death:0,invulnerable:0,
    frozen:0,hidden:0,cooldown:0,slide:0,callWait:0,safe:{x:105,floor:0}
  };
  state.mall = {
    cars:shafts.map((shaft,i)=>({
      y:floors[i===0?0:i===1?1:0], direction:0, target:null, call:null, wait:120
    })),
    spies:[], bullets:[], falling:[], drops:[], coins:[], particles:[], bubbles:[],
    lights:lamps.map(()=>({down:false,dark:0})), fountains:fountains.map(()=>0),
    kiosks:kiosks.map(()=>0),
    janitor:{x:314,dir:1,phase:0,patch:null},
    walkers:[{x:87,dir:1,min:22,max:131},{x:455,dir:-1,min:422,max:486}],
    cop:{x:594,floor:1+integer(state,4),dir:-1,chase:0},
    shake:0
  };
  setScene(state,'arrival');
  sound(state,'zip');
}

export function setScene(state,scene) {
  state.scene = scene;
  state.age = 0;
}
export function sound(state,name) {
  state.events.push({type:'sound',name});
}
export function announce(state,text,duration=100,color='yellow') {
  state.banner = {lines:Array.isArray(text)?text:[text],left:duration,color};
}

export function bubble(state,where,x,y,text,left=85) {
  state[where].bubbles.push({x,y,text,left});
}
export function points(state,delta,where,x,y) {
  const before = state.score;
  state.score = Math.max(0,state.score+delta);
  state.high = Math.max(state.high,state.score);
  if (before<20000 && state.score>=20000 && !state.extraLife) {
    state.extraLife = true;
    state.lives++;
    sound(state,'item');
  }
  if (where) state[where].particles.push({x,y,text:(delta>0?'+':'')+delta,left:45});
}
export const protection = state => Boolean(state.power.cinna || state.player.invulnerable);
export function hurt(state,kind='hurt',force=false) {
  const p = state.player;
  if (p.death || (!force && protection(state))) return false;
  if (!force && state.power.armor) {
    delete state.power.armor;
    p.invulnerable = 38;
    sound(state,'ping');
    return false;
  }
  p.death = 35;
  p.kick = false;
  sound(state,kind==='hurt'?'death':kind);
  return true;
}

export function givePower(state,key,where,x,y) {
  if (key==='life') state.lives++;
  else if (key==='armor' || key==='pretzel') state.power.armor = true;
  else if (key==='radar') state.power.radar = true;
  else if (key==='rapid' || key==='spread') state.power.weapon = {id:key,left:1200,max:1200};
  else if (key==='sneakers' || key==='orange') {
    const max = key==='sneakers'?1200:720;
    state.power.speed = {id:key,left:max,max};
  } else if (key==='cinna') state.power.cinna = {id:key,left:360,max:360};
  points(state,50,where,x,y);
  announce(state,powerNames[key],100);
  state.pickup = {id:key,left:32};
  sound(state,'power');
}

export function awardPackage(state,id,x,y) {
  if (state.rooms[id].cleared) return;
  state.rooms[id].cleared = true;
  state.packages++;
  points(state,500,'room',x,y);
  announce(state,words.found+' '+state.packages+'/6',120,'green');
  state.pickup = {id:'package',left:46};
  sound(state,'package');
}
export function handleExit(state) {
  if (state.packages!==6) {
    announce(state,words.locked+': '+(6-state.packages));
    sound(state,'buzzer');
    return false;
  }
  if (state.escaped) return false;
  state.escaped = true;
  state.result = {
    seconds:Math.floor(state.elapsed/60),
    bonus:Math.max(0,300-Math.floor(state.elapsed/60))*10,
    headline:pick(state,headlines),
    post:pick(state,clearPosts),
    section:0
  };
  points(state,1000 + state.result.bonus);
  setScene(state,'clear');
  sound(state,'clear');
  return true;
}
export const isOpen = (state,id) => byId[id].role!=='closed' && !state.rooms[id].cleared;
export const speed = state => state.power.speed?.id==='sneakers'?1.65:state.power.speed?1.5:1;
export const shortestPackage = (state,floor,x) => shops.filter(s=>s.role==='target'&&!state.rooms[s.id].cleared)
  .sort((a,b)=>Math.abs(a.x-x)+Math.abs(a.floor-floor)*115-Math.abs(b.x-x)-Math.abs(b.floor-floor)*115)[0];

export function respawn(state, continued=false) {
  const p = state.player;
  Object.assign(p,{
    x:p.safe.x,y:floors[p.safe.floor],floor:p.safe.floor,air:false,vy:0,
    kick:false,duck:false,ride:null,roof:null,stairs:null,fallFrom:null,
    frozen:0,hidden:0,death:0,invulnerable:120,cooldown:0,slide:0,callWait:0
  });
  state.mall.spies = [];
  state.mall.bullets = [];
  state.mall.falling = [];
  state.pickup = null;
  state.power = !continued && state.power.radar ? {radar:true} : {};
  if (state.room) {
    const r = state.room;
    Object.assign(r,{x:r.safe.x,y:r.safe.y,search:null,stun:0,bullets:[],guards:[],toys:[],grace:90});
  }
}
export function finishDeath(state) {
  state.lives--;
  if (state.lives>0) {
    respawn(state);
  } else {
    setScene(state,state.continues>0?'continue':'over');
    state.overlay = null;
    sound(state,state.continues>0?'tick':'gameover');
  }
}
export function tickTimed(state) {
  for (const tag of ['weapon','speed','cinna']) {
    if (state.power[tag] && --state.power[tag].left<=0) delete state.power[tag];
  }
  for (const tag of ['banner','capture','pickup','kiosk']) {
    if (state[tag] && --state[tag].left<=0) state[tag] = null;
  }
  for (const tag of ['frozen','invulnerable','cooldown']) {
    if (state.player[tag]>0) state.player[tag]--;
  }
}

export function updateEffects(entity) {
  for (const type of ['particles','bubbles']) entity[type] = entity[type].filter(effect=>--effect.left>0);
}
