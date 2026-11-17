import test from 'node:test';
import assert from 'node:assert/strict';
import {sprites} from '../src/art.js';
import {createClock,FRAME_MS,MAX_CATCHUP} from '../src/clock.js';
import {arrivalPosts,clearPosts,elevatorLines,floorAnnouncements,gifts,headlines,lastWords,pa,visits,words} from '../src/copy.js';
import {floors,powers,rooms,shafts,shops,tilePixel} from '../src/data.js';
import {createGame,step} from '../src/engine.js';
import {buttons,createInput,konami,mapKey} from '../src/input.js';
import {palette,sprite,textWidth} from '../src/pixel.js';
import {nextRandom,random} from '../src/random.js';
import {difficulty,givePower,points} from '../src/rules.js';
import {FLICKER_FRAMES,SPLASH_FRAMES,splashFrame} from '../src/splash/index.js';
import {blocked} from '../src/store.js';
import {fitViewport} from '../src/video.js';
import {frame,frames,game} from './support.js';

test('clock advances at 60 Hz, draws independently, caps catch-up and resets',()=>{
  let tick=0,render=0;
  const clock=createClock(()=>tick++,()=>render++);
  assert.equal(clock.frame(100),0);
  assert.equal(clock.frame(100+FRAME_MS/2),0);
  assert.equal(clock.frame(100+FRAME_MS),1);
  assert.equal(clock.frame(3000),MAX_CATCHUP);
  assert.equal(tick,6);
  assert.equal(render,4);
  clock.reset();
  assert.equal(clock.frame(4000),0);
  assert.deepEqual(fitViewport(1000,780),{width:768,height:720,x:116,y:30});
});

test('input matches letters, falls back to physical keys, and releases the originally bound button',()=>{
  assert.equal(mapKey({key:'y',code:'KeyZ'}),buttons.a);
  assert.equal(mapKey({key:'z',code:'KeyY'}),buttons.a);
  assert.equal(mapKey({key:'a',code:'KeyQ'}),buttons.left);
  assert.equal(mapKey({key:'q',code:'KeyA'}),buttons.left);
  assert.equal(mapKey({key:'A',code:'KeyQ'}),buttons.left);
  assert.equal(mapKey({key:' ',code:'Space'}),buttons.b);
  const input=createInput();
  input.keyDown({key:'z',code:'KeyW'});
  assert.equal(input.next().pressed,buttons.a);
  input.keyUp({key:'w',code:'KeyW'});
  assert.equal(input.next().held,0);
});

test('input preserves repeated fast taps and merges controller and keyboard ownership',()=>{
  const input=createInput();
  const tap={key:'x',code:'KeyX'};
  input.keyDown(tap);input.keyUp(tap);input.keyDown(tap);input.keyUp(tap);
  assert.deepEqual(Array.from({length:4},()=>input.next().pressed),[buttons.b,0,buttons.b,0]);
  input.keyDown(tap);
  input.gamepads([{connected:true,axes:[0,0],buttons:[{}, {pressed:true}]}]);
  assert.equal(input.next().held,buttons.b);
  input.keyUp(tap);
  assert.equal(input.next().held,buttons.b);
  input.gamepads([]);
  assert.equal(input.next().held,0);
  input.keyDown(tap);
  input.clear();
  assert.equal(input.next().held,0);
});

test('seeded randomness repeats and stepping never mutates its input state',()=>{
  assert.equal(nextRandom(1),270369);
  const x={rng:707},y={rng:707};
  assert.deepEqual(Array.from({length:40},()=>random(x)),Array.from({length:40},()=>random(y)));
  const original=game(),snapshot=structuredClone(original);
  assert.deepEqual(frames(original,400),frames(game(),400));
  assert.deepEqual(original,snapshot);
  assert.notDeepEqual(game(1).rooms,game(2).rooms);
});

test('sprite dimensions, transparent pixels, palette, and animation frame indices',()=>{
  for (const [name,frames] of Object.entries(sprites)) for (const image of frames) {
    const {width,height,pixels,colors}=image;
    if (/^(agent|spy|janitor|walker|cop)/.test(name)) assert.deepEqual([width,height],[16,24],name);
    if (/^(room|guard|bot|clerk)/.test(name)) assert.deepEqual([width,height],[16,16],name);
    assert.ok(colors.length<=3);
    assert.ok(colors.every(c=>Object.hasOwn(palette,c)));
    assert.equal(pixels.length,width*height);
    assert.ok(pixels.some(ink=>ink>0));
    assert.ok(pixels.includes(0));
    assert.ok(pixels.every(ink=>ink<=colors.length));
  }
  assert.equal(sprites['agent-walk'].length,4);
  assert.notDeepEqual(sprites['agent-walk'][0].pixels,sprites['agent-walk'][1].pixels);
  assert.throws(()=>sprite(2,2,['cream','red','ice','aqua'],()=>{}),/palette/);
});

test('all room templates are bounded and every fixture is accessible by a walkable route',()=>{
  assert.equal(shops.length,13);
  let total=0;
  for (const shop of shops) if (shop.layout) {
    const room=rooms[shop.id];
    assert.deepEqual([room.width,room.height],[16,11]);
    assert.deepEqual(room.door,{x:8,y:10});
    assert.ok(room.guards.length>=1 && room.guards.length<=3);
    const seen=new Set(),queue=[room.door];
    while(queue.length) {
      const {x,y}=queue.pop(),key=x+','+y;
      if (seen.has(key) || blocked(room,x,y)) continue;
      seen.add(key);
      queue.push({x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1});
    }
    for (const f of room.fixtures) assert.ok([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>
      seen.has((f.x+dx)+','+(f.y+dy))),shop.id+' '+f.x+','+f.y);
    for (const pos of [room.bonus,room.pedestal,...room.guards].filter(Boolean)) assert.ok(seen.has(pos.x+','+pos.y));
    total++;
  }
  assert.equal(total,10);
});

test('each seed puts one package in each target and supply shops hold only powers or nothing',()=>{
  for (let seed=0;seed<30;seed++) {
    const s=game(seed);
    for (const shop of shops) if (shop.layout) {
      const contents=s.rooms[shop.id].contents;
      assert.equal(contents.filter(item=>item==='package').length,shop.role==='target'?1:0);
      if (shop.role==='power') assert.ok(contents.every(item=>item==='empty' || powers.includes(item)));
    }
  }
});

test('Konami with extra leading Up presses enables Black Friday setup',()=>{
  let s=createGame({debug:true});
  for (const key of [buttons.up,buttons.up,...konami]) s=frame(s,key);
  assert.equal(s.blackFriday,true);
  s=frame(s,buttons.start);
  for (const r of Object.values(s.rooms)) assert.ok(r.contents.every(item=>item==='package'||powers.includes(item)));
  assert.equal(difficulty(1,false,true).cap,8);
  assert.ok(difficulty(1,false,true).spawn<=difficulty(1).spawn/2+1);
});

test('scoring floors at zero and grants the 20,000 point life once',()=>{
  const s=game();
  points(s,-200);
  assert.equal(s.score,0);
  points(s,19950);points(s,50);
  assert.equal(s.lives,4);
  points(s,-500);points(s,500);
  assert.equal(s.lives,4);
  assert.equal(s.high,20000);
});

test('later loops and alarm adjust combat with caps',()=>{
  const first=difficulty(1),second=difficulty(2),late=difficulty(80,true);
  assert.ok(second.speed>first.speed && second.shot<first.shot && second.spawn<first.spawn);
  assert.equal(first.alarm,9000);
  assert.equal(second.alarm,7800);
  assert.equal(late.shot,60);
  assert.equal(late.alarm,2700);
  assert.equal(difficulty(1,true).speed,1.25);
});

test('pause, map, and continue suspend elapsed and power timers',()=>{
  let s=game();
  for(const item of ['rapid','spread','armor','sneakers','orange','radar','cinna'])givePower(s,item);
  assert.equal(s.power.weapon.id,'spread');
  assert.equal(s.power.speed.id,'orange');
  assert.equal(s.power.speed.left,720);
  assert.equal(s.power.armor,true);
  assert.equal(s.power.radar,true);
  s=frame(s,buttons.select);
  assert.equal(s.overlay,'map');
  s=frames(s,100);
  assert.equal(s.elapsed,0);
  assert.equal(s.power.cinna.left,360);
  s=frame(s,buttons.select);
  s=frame(s,buttons.start);
  assert.equal(s.overlay,'pause');
  s=frames(s,100);
  assert.equal(s.power.cinna.left,360);
  s=frame(s,buttons.start);
  s=frames(s,360);
  assert.equal(s.power.cinna,undefined);
  assert.equal(s.power.weapon.left,840);
});

test('splash multiplexes adjacent letters, settles, then presents and ends',()=>{
  assert.notEqual(splashFrame(0).visible(0),splashFrame(0).visible(1));
  assert.notEqual(splashFrame(0).visible(1),splashFrame(1).visible(1));
  assert.equal(splashFrame(FLICKER_FRAMES-1).solid,false);
  assert.equal(splashFrame(FLICKER_FRAMES).visible(1),true);
  assert.equal(splashFrame(105).presents,true);
  assert.equal(frames(createGame(),SPLASH_FRAMES).scene,'title');
  assert.equal(frame(createGame(),buttons.a).scene,'title');
});

test('copy fits bubbles, signs, photo cards, headlines and PA banners',()=>{
  for (const line of [...Object.values(visits).flat(),...lastWords,...elevatorLines,words.cop,words.occupied,words.walker]) assert.ok(line.length<=28,line);
  for (const entry of [...arrivalPosts,...clearPosts]) {
    assert.equal(entry.length,3);
    for (const line of entry) assert.ok(line.length<=21,line);
  }
  for (const line of headlines.flat()) assert.ok(line.length<=26,line);
  for (const line of [...pa.flat(),...floorAnnouncements,...gifts.map(g=>words.gift+g)]) assert.ok(textWidth(line,1,true)<=225,line);
  for (const shop of shops) assert.ok(textWidth(shop.name,1,true)<=74,shop.name);
});
