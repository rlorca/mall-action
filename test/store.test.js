import test from 'node:test';
import assert from 'node:assert/strict';
import {rooms,shops,tilePixel} from '../src/data.js';
import {buttons} from '../src/input.js';
import {givePower} from '../src/rules.js';
import {enterStore,nearbyFixture} from '../src/store.js';
import {frame,frames,game,position,store} from './support.js';

const {a,b,up,down,left,right,select}=buttons;
function atFixture(s,index,dy=15) {
  const fixture=rooms[s.room.id].fixtures[index];
  Object.assign(s.room,{x:tilePixel(fixture.x),y:tilePixel(fixture.y)+dy,dx:1,dy:0});
}
function search(s) {
  return frames(frame(s,b),45);
}
function exit(s) {
  const door=rooms[s.room.id].door;
  Object.assign(s.room,{x:tilePixel(door.x),y:tilePixel(door.y)+1});
  s=frame(s,down);
  return frames(s,24);
}

test('touch at a gap recognizes a sideways fixture, single-tap searches, and faces it',()=>{
  let s=store(game(),'fashion');
  const index=s.rooms.fashion.contents.indexOf('package');
  s.room.guards=[];
  atFixture(s,index,16);
  assert.equal(nearbyFixture(s).index,index);
  s=frame(s,b);
  assert.equal(s.room.search.index,index);
  assert.deepEqual([s.room.dx,s.room.dy],[0,-1]);
  s=frames(s,45);
  assert.equal(s.packages,1);
  assert.equal(s.score,500);
  assert.equal(s.room.search,null);
  assert.equal(s.rooms.fashion.cleared,true);
});

test('fresh different direction or shooting cancels; holding direction or B can finish one search',()=>{
  let s=store(game(),'fashion');
  s.room.guards=[];
  atFixture(s,2);
  s=frame(s,b|up);
  s=frames(s,10,b|up);
  assert.ok(s.room.search);
  s=frame(s,right,right);
  assert.equal(s.room.search,null);
  assert.equal(s.rooms.fashion.opened.length,0);
  atFixture(s,2);
  s=frame(s,b);
  s=frame(s,a);
  assert.equal(s.room.search,null);
  s=frame(s,b);
  s=frames(s,80,b);
  assert.equal(s.rooms.fashion.opened.length,1);
});

test('open fixtures persist on re-entry, guards return, and cleared target doors stay closed',()=>{
  let s=position(game(),1,56);
  s=frame(s,up);
  s=frames(s,24+115);
  assert.equal(s.scene,'store');
  const contents=s.rooms.fashion.contents,index=2;
  const old=contents.indexOf('package');
  contents[old]='empty';
  contents[4]='package';
  atFixture(s,index);
  s.room.guards=[];
  s=search(s);
  assert.deepEqual(s.rooms.fashion.opened,[index]);
  assert.equal(s.packages,0);
  s=exit(s);
  assert.equal(s.scene,'mall');
  s=frames(frame(s,up),24);
  assert.equal(s.scene,'store');
  assert.ok(s.room.guards.length);
  assert.deepEqual(s.rooms.fashion.opened,[index]);
  atFixture(s,4);
  s.room.guards=[];
  s=search(s);
  assert.equal(s.packages,1);
  s=exit(s);
  s=frame(s,up);
  assert.equal(s.transition,null);
});

test('power timers tick in stores, pause on directory, and Sneakers shortens searches',()=>{
  let s=store(game(),'fashion');
  s.room.guards=[];
  givePower(s,'sneakers');
  givePower(s,'armor');
  atFixture(s,2);
  s=frame(s,b);
  assert.equal(s.room.search.total,30);
  assert.equal(s.power.speed.left,1199);
  s=frame(s,select);
  s=frames(s,80);
  assert.equal(s.room.search.left,30);
  assert.equal(s.power.speed.left,1199);
  s=frame(s,select);
  s=frames(s,30);
  assert.equal(s.packages,1);
  assert.equal(s.power.armor,true);
});

test('an occupied fitting room throws a shoe and never opens its cache',()=>{
  let s=store(game(),'fashion');
  s.room.guards=[];
  atFixture(s,0);
  s.rng=1;
  s=search(s);
  assert.equal(s.rooms.fashion.opened.length,0);
  assert.ok(s.room.guards.length);
  assert.ok(s.room.bubbles.some(b=>b.text==='OCCUPIED!!'));
  assert.ok(s.room.bullets.some(b=>b.kind==='shoe'));
});

test('KGB Toys shelf releases three walkers which can stun and trigger a trap',()=>{
  let s=store(game(),'toys');
  const first=rooms.toys.fixtures[0];
  atFixture(s,0,15);
  s.room.dy=-1;s.room.dx=0;
  s.rooms.toys.contents[0]='trap';
  s.room.guards[0].x=tilePixel(first.x);
  s.room.guards[0].y=tilePixel(first.y)+8;
  s=frames(frame(s,a),4);
  assert.equal(s.room.toys.length,3);
  s=frames(s,15);
  assert.ok(s.rooms.toys.opened.includes(0));
  assert.ok(s.room.guards.some(g=>g.stun>0));
});

test('Sam Baddy booth selects the bonus track until stepping away',()=>{
  let s=store(game(),'music');
  const {x,y}=rooms.music.bonus;
  Object.assign(s.room,{x:tilePixel(x),y:tilePixel(y)});
  s=frame(s);
  assert.equal(s.room.sideB,true);
  assert.ok(s.banner.lines[0].includes('SIDE B'));
  s=frames(s,13,down);
  assert.equal(s.room.sideB,false);
});

test('GameStonk freezes during its once-per-game scene and awards a useless inventory item',()=>{
  let s=store(game(),'games');
  assert.ok(s.room.cave>100);
  const {x,y}=s.room;
  const item=s.room.gift;
  s=frames(s,90,up);
  assert.deepEqual([s.room.x,s.room.y],[x,y]);
  s=frames(s,75);
  const j=rooms.games.pedestal;
  Object.assign(s.room,{x:tilePixel(j.x),y:tilePixel(j.y)});
  s=frame(s);
  assert.deepEqual(s.inventory,[item]);
  assert.equal(s.score,1);
  assert.equal(s.room.gift,null);
  enterStore(s,'games');
  assert.equal(s.room.cave,0);
  assert.equal(s.room.gift,null);
});

test('guard grace prevents immediate shots and a bot needs three hits',()=>{
  let s=store(game(),'radio');
  const bot=s.room.guards.find(g=>g.kind==='bot');
  Object.assign(bot,{x:136,y:136,tx:8,ty:8,stun:100});
  s.room.guards=[bot];
  Object.assign(s.room,{x:136,y:151,dx:0,dy:-1});
  s=frames(s,45,a);
  assert.ok(s.room.guards[0].dead);
  assert.equal(s.score,100);
  assert.equal(s.player.death,0);
});

test('any seeded target can be searched and delivered as part of the same loop',()=>{
  let s=game(1986);
  for (const shop of shops.filter(shop=>shop.role==='target')) {
    s=position(s,shop.floor,shop.x);
    s=frame(s,up);
    s=frames(s,145);
    assert.equal(s.room.id,shop.id);
    s.room.guards=[];
    const packageIndex=s.rooms[shop.id].contents.indexOf('package');
    atFixture(s,packageIndex);
    for(let i=0;i<7 && !s.rooms[shop.id].cleared;i++) s=search(s);
    assert.ok(s.rooms[shop.id].cleared,shop.id);
    s=exit(s);
  }
  assert.equal(s.packages,6);
  s=position(s,5,586);
  s=frame(s,up);
  assert.equal(s.scene,'clear');
  assert.ok(s.score>=4000);
});
