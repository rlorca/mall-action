import test from 'node:test';
import assert from 'node:assert/strict';
import {car,escalators,floors,rooms,shafts,shops,tilePixel} from '../src/data.js';
import {buttons} from '../src/input.js';
import {blocked,nearbyFixture} from '../src/store.js';
import {frame,game} from './support.js';

const {up,down,left,right,a,b,start}=buttons;
const gridMoves=[
  {dx:0,dy:-1,key:up},{dx:0,dy:1,key:down},{dx:-1,dy:0,key:left},{dx:1,dy:0,key:right}
];

function pathTo(room,x,y,goal) {
  const seen=new Set();
  const queue=[{x,y,path:[]}];
  for (let i=0;i<queue.length;i++) {
    const at=queue[i], key=at.x+','+at.y;
    if (seen.has(key) || blocked(room,at.x,at.y)) continue;
    seen.add(key);
    if (goal(at.x,at.y)) return at.path;
    for (const move of gridMoves) {
      const x=at.x+move.dx,y=at.y+move.dy;
      queue.push({x,y,path:[...at.path,{x,y,key:move.key}]});
    }
  }
  throw new Error('A seeded shop objective is unreachable');
}

test('seed 1986 can collect all six packages and unlock loop two by playing pad inputs',()=>{
  let s=game(1986);
  function next(held=0,pressed=0) {
    s=frame(s,held,pressed);
    if (s.scene==='continue') s=frame(s,start);
    assert.notEqual(s.scene,'over','run exhausted its continues');
  }
  function ready() {
    while (s.player.death || s.player.frozen || s.transition) next();
  }
  function stroll(x) {
    for(let i=0;i<1800;i++) {
      ready();
      const p=s.player;
      if (Math.abs(p.x-x)<2 && !p.air) return;
      const movement=x>p.x?right:left;
      const elevator=shafts.findIndex(shaft=>p.floor>=shaft.top && p.floor<=shaft.bottom &&
        Math.abs(shaft.x-p.x)<15 && Math.abs(shaft.x-x)<=Math.abs(p.x-x) &&
        Math.sign(shaft.x-p.x)===Math.sign(x-p.x));
      if (elevator!==-1 && s.mall.cars[elevator].y>floors[p.floor] && p.ride===null && !p.air) {
        next(up,up);
        const floor=p.floor;
        for(let j=0;j<260 && s.player.ride===null && !s.player.death && s.player.floor===floor;j++)next();
      } else next(movement|a);
    }
    assert.fail('could not reach mall x='+x+' on floor '+s.player.floor);
  }
  function elevator(index,to) {
    const shaft=shafts[index], current=s.player.floor;
    if (current===to && s.player.ride===null) return;
    if (s.player.ride!==index) {
      stroll(shaft.x+(s.player.x>shaft.x?12:-12));
      const move=to>current?down:up;
      next(move,move);
      for(let i=0;i<260 && s.player.ride!==index;i++)next();
    }
    assert.equal(s.player.ride,index);
    const move=to>current?down:up;
    for (let i=0;i<240 && Math.abs(s.mall.cars[index].y-floors[to])>1;i++) next(move);
    for(let i=0;i<3;i++)next();
    assert.equal(s.player.floor,to);
  }
  function walkTile(step,attack) {
    let {x,y}=s.room;
    const tx=tilePixel(step.x),ty=tilePixel(step.y);
    for (let i=0;i<35;i++) {
      if (s.player.death || s.scene!=='store') return false;
      if (Math.abs(x-tx)<1 && Math.abs(y-ty)<1) return true;
      const horizontal=step.key===left || step.key===right;
      const moveX=horizontal?Math.abs(ty-y)<1:Math.abs(tx-x)>=1;
      const key=moveX?(tx>x?right:left):(ty>y?down:up);
      next(key|(attack?a:0));
      ({x,y}=s.room??{});
    }
    return false;
  }
  function visit(id) {
    const shop=shops.find(shop=>shop.id===id), room=rooms[id];
    stroll(shop.x);
    next(up,up);
    ready();
    assert.equal(s.room?.id,id);
    while(s.room.visit)next();
    const index=s.rooms[id].contents.indexOf('package'), f=room.fixtures[index];
    for(let attempt=0;attempt<7 && !s.rooms[id].cleared;attempt++) {
      ready();
      const path=pathTo(room,Math.floor(s.room.x/16),Math.floor(s.room.y/16),
        (x,y)=>Math.abs(x-f.x)+Math.abs(y-f.y)===1);
      if (!path.every(step=>walkTile(step,true))) continue;
      const tx=tilePixel(f.x), ty=tilePixel(f.y);
      const direction=Math.abs(tx-s.room.x)>Math.abs(ty-s.room.y)?(tx>s.room.x?right:left):(ty>s.room.y?down:up);
      next(direction);
      next(direction);
      assert.equal(nearbyFixture(s)?.index,index,shop.id);
      next(b,b);
      for(let i=0;i<47;i++)next();
    }
    assert.ok(s.rooms[id].cleared,id+' package');
    if (id==='fashion') assert.equal(s.lives,3,'the first package is reachable without losing a life');
    for(let attempt=0;attempt<5 && s.scene==='store';attempt++) {
      ready();
      const path=pathTo(room,Math.floor(s.room.x/16),Math.floor(s.room.y/16),
        (x,y)=>x===room.door.x && y===room.door.y-1);
      if (!path.every(step=>walkTile(step,true))) continue;
      for(let i=0;i<30 && !s.transition && !s.player.death;i++)next(down|a);
      ready();
    }
    assert.equal(s.scene,'mall',id+' exit');
  }

  elevator(0,1);
  visit('fashion');
  visit('radio');
  elevator(0,2);
  visit('toys');
  elevator(0,3);
  visit('music');
  visit('food');
  const stair=escalators[1];
  stroll(stair.tx);
  next(down,down);
  while (s.player.stairs) next();
  assert.equal(s.player.floor,4);
  visit('sports');
  assert.equal(s.packages,6);
  elevator(1,5);
  stroll(car.x);
  next(up,up);
  assert.equal(s.scene,'clear');
  for(let i=0;i<3;i++)next(start,start);
  assert.equal(s.loop,2);
  assert.equal(s.scene,'arrival');
});
