import test from 'node:test';
import assert from 'node:assert/strict';
import {booth,car,escalators,floors,kiosks,lamps,shafts} from '../src/data.js';
import {buttons} from '../src/input.js';
import {killSpy,updateSpies} from '../src/mall.js';
import {difficulty,hurt} from '../src/rules.js';
import {frame,frames,game,position} from './support.js';

const {up,down,left,right,a,b,start}=buttons;
const width=shaft=>shafts[shaft].x;
const liveSpy = (x,floor,extra={}) => ({
  id:45,x,floor,dir:-1,age:0,next:120,aim:0,low:false,duck:0,seen:[],dead:0,wait:0,goal:null,...extra
});

test('walk at one pixel a frame, jump twenty pixels, land and preserve jump-kick momentum',()=>{
  let s=position(game(),0,38);
  s=frames(s,10,right);
  assert.equal(s.player.x,48);
  s=frame(s,right|b);
  assert.equal(s.player.kick,true);
  let apex=s.player.y;
  for(let i=0;i<24;i++){
    s=frame(s);
    apex=Math.min(apex,s.player.y);
  }
  assert.ok(floors[0]-apex>=19 && floors[0]-apex<=23);
  assert.equal(s.player.y,floors[0]);
  assert.equal(s.player.air,false);
  assert.ok(s.player.x>=67);
});

test('manual car glides when released and dings once, including when held at shaft end',()=>{
  let s=position(game(),0,width(0)-12);
  s=frame(s,down);
  assert.equal(s.player.ride,0);
  s=frames(s,17,down);
  assert.equal(s.mall.cars[0].y,floors[0]+17);
  let stops=0;
  for(let i=0;i<52;i++) {
    s=frame(s);
    stops+=s.events.filter(e=>e.name==='ding').length;
  }
  assert.equal(s.mall.cars[0].y,floors[1]);
  assert.equal(stops,1);
  stops=0;
  for(let i=0;i<180;i++) {
    s=frame(s,down,0);
    stops+=s.events.filter(e=>e.name==='ding').length;
  }
  assert.equal(s.mall.cars[0].y,floors[3]);
  assert.equal(stops,1);
  s=frame(s,right);
  assert.equal(s.player.floor,3);
  assert.equal(s.player.ride,null);
});

test('all floors are served and connected, including both escalators and parking via B',()=>{
  let s=position(game(),0,width(0)-12);
  s=frame(s,down);
  for(let i=1;i<=3;i++){
    s=frames(s,47,down);
    s=frame(s);
    assert.equal(s.player.y,floors[i]);
    assert.equal(s.player.ride,0);
  }
  const e=escalators[1];
  s=position(s,e.top,e.tx);
  s=frames(frame(s,down),54);
  assert.equal(s.player.floor,4);
  s=position(s,4,width(1)-14);
  s=frame(s,down);
  s=frames(s,160);
  assert.equal(s.player.ride,1);
  s=frames(s,48,down);
  assert.equal(s.player.floor,5);
  const other=escalators[0];
  s=position(s,other.bottom,other.bx);
  s=frames(frame(s,up),54);
  assert.equal(s.player.floor,other.top);
});

test('empty opening or nearby wait calls a car, boards safely, and holds the automatic car',()=>{
  let s=position(game(),2,width(0)-13);
  s=frames(s,30);
  assert.equal(s.mall.cars[0].call,2);
  s=frames(s,98);
  assert.equal(s.player.ride,0);
  assert.equal(s.player.death,0);
  s=position(s,1,width(2)-13);
  s=frames(frame(s,down),100);
  assert.equal(s.player.ride,2);
  const y=s.mall.cars[2].y;
  s=frames(s,250);
  assert.equal(s.mall.cars[2].y,y);
  s=frames(frame(s,right),129);
  assert.notEqual(s.mall.cars[2].y,y);
});

test('a one-floor pit fall lands on the car roof and a deeper fall kills',()=>{
  let safe=position(game(),0,width(0)-11);
  safe.mall.cars[0].y=floors[1];
  safe=frames(safe,8,right);
  safe=frames(safe,25);
  assert.equal(safe.player.roof,0);
  assert.equal(safe.player.y,floors[1]-23);
  safe=frame(safe,right);
  assert.equal(safe.player.roof,null);
  assert.equal(safe.player.floor,0);
  let fatal=position(game(),0,width(0)-11);
  fatal.mall.cars[0].y=floors[2];
  fatal=frames(frames(fatal,8,right),25);
  assert.ok(fatal.player.death>0 || fatal.lives===2);
});

test('descending car crushes spies and the player; rising into the shaft cap crushes a roof rider',()=>{
  let s=position(game(),1,width(0));
  Object.assign(s.mall.cars[0],{y:floors[1]+22,direction:1,target:floors[2]});
  s.mall.spies=[liveSpy(width(0),1)];
  s=frame(s);
  assert.ok(s.player.death);
  assert.ok(s.mall.spies[0].dead>0);
  assert.equal(s.score,300);
  s=position(game(),0,width(0));
  s.player.roof=0;
  Object.assign(s.mall.cars[0],{y:floors[0]+1,direction:-1,target:floors[0]});
  s=frame(s);
  assert.ok(s.player.death);
});

test('spies telegraph for thirty frames and wait until at least two seconds to shoot',()=>{
  let s=position(game(),1,320);
  s.spawnAt=100000;
  const spy=liveSpy(355,1);
  s.mall.spies=[spy];
  s=frames(s,119);
  assert.equal(s.mall.spies[0].aim,0);
  s=frame(s);
  assert.equal(s.mall.spies[0].aim,30);
  s=frames(s,29);
  assert.equal(s.mall.spies[0].aim,1);
  assert.ok(!s.mall.bullets.some(b=>b.team==='spy'));
  s=frame(s);
  assert.ok(s.events.some(e=>e.name==='foeShot'));
});

test('dodge occurs about ten percent of volleys, with one decision per volley',()=>{
  let dodges=0;
  const base=game(1986);
  for(let i=1;i<=350;i++){
    let s=position(structuredClone(base),1,350);
    s.rng=Math.imul(i,0x9e3779b1)>>>0;
    s.mall.spies=[liveSpy(330,1)];
    s.mall.bullets=[
      {team:'player',x:368,y:111,vx:-4,vy:0,volley:6,floor:1},
      {team:'player',x:367,y:111,vx:-4,vy:0,volley:6,floor:1}
    ];
    s=frames(s,4);
    if (s.mall.spies[0].duck) dodges++;
    assert.equal(s.mall.spies[0].seen.length,1);
  }
  assert.ok(dodges>=23 && dodges<=47,dodges);
});

test('ducking avoids high shots but takes a low hit and armour absorbs a hit',()=>{
  let s=position(game(),1,321);
  s.mall.bullets=[{team:'spy',x:309,y:111,vx:2,vy:0,floor:1}];
  s=frames(s,12,down);
  assert.equal(s.player.death,0);
  s.power.armor=true;
  s.mall.bullets=[{team:'spy',x:309,y:120,vx:2,vy:0,floor:1}];
  s=frames(s,8,down);
  assert.equal(s.power.armor,undefined);
  assert.ok(s.player.invulnerable);
});

test('standing shot drops a lamp and a 2F disco ball rolls before reaching a pit',()=>{
  let s=position(game(),1,186);
  const index=lamps.findIndex(l=>l.floor===1);
  s=frames(frame(s,a),3);
  assert.equal(s.mall.lights[index].down,true);
  assert.ok(s.mall.falling.length);
  s=frames(s,35);
  assert.ok(s.mall.lights[index].dark);
  s=position(game(),3,438);
  s.mall.walkers[1].x=430;
  s=frames(frame(s,a),33);
  assert.ok(s.mall.falling.some(ball=>ball.roll));
});

test('wet patch preserves direction and jump-kicking; mop stays away from shafts',()=>{
  let s=position(game(),4,277);
  s.mall.janitor.patch={x:300,left:200};
  s=frames(s,10,right);
  assert.equal(s.player.slide,1);
  const x=s.player.x;
  s=frames(s,10,left);
  assert.equal(s.player.x,x+10);
  s=frames(frame(s,b),22);
  assert.equal(s.player.kick,true);
  s=frames(s,520);
  const patch=s.mall.janitor.patch;
  assert.ok(patch && shafts.every(shaft=>Math.abs(shaft.x-patch.x)>33));
});

test('walkers block shots and charge points without dying',()=>{
  let s=position(game(),3,32);
  s.score=400;
  s.mall.walkers[0].x=53;
  s=frames(frame(s,a),10);
  assert.equal(s.score,200);
  assert.equal(s.mall.walkers.length,2);
  assert.ok(s.mall.bubbles.some(b=>b.text==='HEY!'));
});

test('the cop notices gunfire, detains with score penalty, and clears freeze on death',()=>{
  let s=position(game(),1,335);
  s.score=800;
  s.mall.cop={x:385,floor:1,dir:-1,chase:0};
  s=frame(s,a);
  assert.ok(s.events.some(e=>e.name==='whistle'));
  s=frames(s,42);
  assert.ok(s.player.frozen>0);
  assert.equal(s.score,300);
  assert.equal(s.lives,3);
  hurt(s,'crush',true);
  s=frames(s,35);
  assert.equal(s.player.frozen,0);
  assert.equal(s.lives,2);
  assert.equal(s.mall.bullets.length,0);
});

test('kiosks reveal the nearest target and cool down, photo booth hides and adds the strip once',()=>{
  let s=position(game(),1,kiosks[1]);
  s=frame(s,up);
  assert.equal(s.kiosk.shop,'radio');
  const remaining=s.kiosk.left;
  s=frame(s,up);
  assert.equal(s.kiosk.left,remaining-1);
  s=position(s,booth.floor,booth.x);
  s=frame(s,up);
  assert.equal(s.player.hidden,300);
  s=frame(s,left);
  assert.deepEqual(s.inventory,['PHOTO STRIP']);
  s=frame(s,up);
  s=frames(s,300);
  assert.equal(s.player.hidden,0);
  assert.equal(s.inventory.length,1);
});

test('exit requires six packages, clears once, and starts a harder second loop',()=>{
  let s=position(game(),car.floor,car.x);
  s=frame(s,up);
  assert.ok(s.events.some(e=>e.name==='buzzer'));
  assert.equal(s.scene,'mall');
  s.packages=6;
  s=frame(s,up);
  assert.equal(s.scene,'clear');
  assert.equal(s.score,4000);
  s=frames(s,30,up);
  assert.equal(s.score,4000);
  for(let i=0;i<3;i++)s=frame(s,start);
  assert.equal(s.loop,2);
  assert.equal(s.scene,'arrival');
  assert.equal(s.packages,0);
  assert.ok(difficulty(s.loop).shot<difficulty(1).shot);
});

test('three continues grant three lives and preserve score, loop, and packages',()=>{
  let s=position(game(),3,256);
  Object.assign(s,{score:1600,loop:2,packages:3});
  for(let i=3;i>0;i--){
    s.power={radar:true,armor:true};
    s.lives=1;
    s.player.death=1;
    s=frame(s);
    assert.equal(s.scene,'continue');
    assert.equal(s.continues,i);
    s=frames(s,60);
    assert.ok(s.events.some(e=>e.name==='tick'));
    s=frame(s,start);
    assert.equal(s.lives,3);
    assert.equal(s.score,1600);
    assert.equal(s.packages,3);
    assert.equal(s.loop,2);
    assert.equal(s.player.x,256);
    assert.deepEqual(s.power,{});
  }
  s.lives=1;
  s.player.death=1;
  s=frame(s);
  assert.equal(s.scene,'over');
  s=frames(s,401);
  assert.equal(s.scene,'title');
});

test('PA announcements vary, alarm activates, and death preserves Radar only',()=>{
  let s=game();
  s.elapsed=3599;
  s=frame(s);
  const pa=s.paIndex;
  assert.ok(s.events.some(e=>e.name==='pa'));
  s.elapsed=7199;
  s=frame(s);
  assert.notEqual(pa,s.paIndex);
  s.elapsed=8999;
  s=frame(s);
  assert.equal(s.alarm,true);
  assert.ok(s.events.some(e=>e.name==='alarm'));
  s.power={radar:true,speed:{id:'orange',left:720},armor:true};
  s.player.death=1;
  s=frame(s);
  assert.deepEqual(s.power,{radar:true});
  assert.ok(s.player.invulnerable>0);
});
