import {sprites} from './art.js';
import {booth,car,clamp,escalators,floorAt,floors,fountains,kiosks,lamps,shafts,shops,WORLD} from './data.js';
import {floorNames,words} from './copy.js';
import {storefront} from './displays.js';
import {textWidth} from './pixel.js';

const stripes = [
  ['plum','purple','violet'],['wine','burgundy','peach'],['navy','blue','aqua'],
  ['plum','purple','pink'],['darkGreen','pine','mint'],['navy','royal','sky']
];
const visible = (x,cam,margin=46) => x>=cam-margin && x<=cam+256+margin;
const skyline = ['night','plum','wine'];

export function sky(p,x,y,w,h) {
  const bands=['black','night','navy','blue','plum','purple','wine'];
  for (let i=0;i<h;i+=4) p.rect(x,y+i,w,Math.min(4,h-i),bands[Math.floor(i/h*bands.length)]);
}
export function city(p,x,y,w,base,frame=0) {
  for (let i=0;i<52;i++) {
    const sx=x+(i*47+13)%w, sy=y+(i*19+11)%Math.max(12,base-y-12);
    p.rect(sx,sy,i%10===0?2:1,1,i%7===0?'cream':i%2?'royal':'violet');
  }
  for (let i=0;i<Math.ceil(w/13);i++) {
    const sx=x+i*13, h=6+(i*37+8)%22;
    p.rect(sx,base-h,10+i%4,h,skyline[i%3]);
    if (i%3===0) p.rect(sx+5,base-h-3,1,4,skyline[i%3]);
    for (let j=3;j<h-2;j+=4) if ((i+j)%4!==1) p.rect(sx+2+(j%3)*2,base-h+j,1,1,(i+frame)%7?'royal':'peach');
  }
}

export function wagon(p,x,y,age=0) {
  p.rect(x-26,y-5,52,4,'black');
  p.rect(x-27,y-12,52,7,'wine');p.rect(x-25,y-15,49,8,'orange');
  p.rect(x-19,y-19,25,5,'orange');p.rect(x-17,y-18,11,4,'ice');p.rect(x-4,y-18,11,4,'sky');
  p.line(x+7,y-19,x+18,y-13,'peach');p.rect(x+9,y-16,11,3,'blue');
  p.rect(x-25,y-12,47,5,'bark');p.rect(x-24,y-11,45,1,'tan');p.rect(x-23,y-9,43,1,'brown');
  p.rect(x-27,y-13,3,4,'red');p.rect(x+23,y-12,3,3,age%20<10?'white':'yellow');
  p.rect(x-29,y-7,5,2,'silver');p.rect(x+21,y-7,7,2,'silver');
  for (const dx of [-16,15]) {
    p.rect(x+dx-3,y-8,7,7,'black');p.rect(x+dx-4,y-6,9,4,'black');p.rect(x+dx-1,y-6,3,3,'silver');p.rect(x+dx,y-5,1,1,'slate');
  }
}

function shaftBack(p,shaft,y,floor) {
  p.rect(shaft.x-12,y-42,24,42,'slate');
  p.rect(shaft.x-9,y-43,18,43,'black');
  p.rect(shaft.x-5,y-47,1,47,'grey');
  p.rect(shaft.x+4,y-47,1,47,'grey');
  p.rect(shaft.x-13,y-31,3,29,'royal');p.rect(shaft.x+10,y-31,3,29,'royal');
  p.rect(shaft.x-14,y-36,28,5,'ink');p.center(shaft.id+' '+floorNames[floor],shaft.x,y-36,'ice',1,true);
}
function drawCar(p,shaft,c,age) {
  const x=shaft.x,y=c.y;
  p.rect(x-10,y-25,20,25,'grey');
  p.rect(x-9,y-23,18,21,'navy');
  p.rect(x-8,y-22,16,2,'aqua');
  p.rect(x-8,y-20,16,17,c.direction?'slate':'ink');
  p.rect(x-8,y-23,16,1,'silver');
  p.rect(x-10,y-3,20,3,'black');
  p.rect(x-8,y-2,16,1,'ice');
  if (c.direction) {
    p.rect(x-1,y-20,1,17,'grey');p.rect(x-6,y-20,1,15,'navy');p.rect(x+5,y-20,1,15,'navy');
  } else {
    p.rect(x-5,y-17,10,2,'plum');p.rect(x-5,y-15,10,11,'night');p.rect(x-5,y-5,10,2,'royal');
  }
  p.rect(x+7,y-15,1,3,age%20<10?'mint':'teal');
}
function escalator(p,e,age) {
  const low=floors[e.bottom], high=floors[e.top];
  p.line(e.bx-5,low-5,e.tx+7,high-5,'ink');
  p.line(e.bx-5,low-3,e.tx+7,high-3,'royal');
  p.line(e.bx-3,low-1,e.tx+4,high-1,'ice');
  p.line(e.bx-3,low-12,e.tx+5,high-12,'grey');
  p.line(e.bx-1,low-13,e.tx+3,high-13,'sky');
  for (let j=-5;j<=5;j++) {
    const t=(j+5)*.1,x=e.bx+(e.tx-e.bx)*t,y=low-48*t;
    p.rect(x,y-10,1,8,'sky');
  }
  for (let j=1;j<9;j++) {
    const t=(j+Math.floor(age/5)%5/5)/10;
    p.rect(e.bx+(e.tx-e.bx)*t,low-2-t*48,3,1,'cream');
  }
  p.rect(e.bx-8,low-2,14,2,'silver');
  p.rect(e.tx-6,high-2,14,2,'silver');
}
function fountain(p,x,y,age,cool) {
  p.rect(x-13,y-6,26,6,'night');p.rect(x-14,y-7,28,3,'sky');
  p.rect(x-10,y-7,20,2,'aqua');p.rect(x-3,y-15,6,9,'royal');
  p.rect(x-5,y-16,10,2,'ice');
  for (let j=0;j<6;j++) {
    const frame=(age+j*7)%26;
    const dir=j%2?1:-1;
    p.rect(x+dir*(2+frame*.4),y-17-frame*.53+frame*frame*.038,1,2,cool?'sky':'ice');
  }
}
function plant(p,x,y) {
  p.rect(x-4,y-6,8,6,'bark');p.rect(x-5,y-8,10,3,'tan');p.rect(x-1,y-19,2,12,'green');
  p.rect(x-4,y-20,3,5,'pine');p.rect(x,y-22,3,5,'mint');p.rect(x+2,y-17,5,3,'green');p.rect(x-6,y-14,6,3,'green');
}
function bench(p,x,y) {
  p.rect(x-10,y-10,20,2,'brown');p.rect(x-9,y-13,18,2,'tan');
  p.rect(x-11,y-6,22,3,'brown');p.rect(x-8,y-4,2,4,'grey');p.rect(x+6,y-4,2,4,'grey');
}
function directoryKiosk(p,x,y,age) {
  p.rect(x-6,y-24,12,24,'ink');p.rect(x-5,y-23,10,23,'teal');p.rect(x-4,y-21,8,11,'mint');
  p.rect(x-3,y-20,6,9,'navy');p.center('I',x,y-18,age%60<43?'mint':'teal',1,true);
  p.rect(x-6,y-7,12,2,'silver');p.rect(x-8,y-2,16,2,'slate');
}
function photoBooth(p,x,y,age) {
  p.rect(x-12,y-32,24,32,'ink');p.rect(x-11,y-31,22,9,'pink');
  p.center('PHOTO',x,y-29,'ink',1,true);
  p.rect(x-10,y-22,13,22,'wine');
  for (let j=-10;j<3;j+=4) p.rect(x+j,y-22,2,19,'hotPink');
  p.rect(x+4,y-22,6,22,'violet');p.rect(x+5,y-17,4,6,'ink');
  p.rect(x+6,y-16,2,2,age%50<24?'cream':'pink');
}
function light(p,x,y,disco,age) {
  p.rect(x,y-46,1,disco?23:27,'silver');
  if (disco) {
    y+=13;
    p.rect(x-4,y-36,9,9,'violet');p.rect(x-3,y-37,7,11,'royal');
    for (let i=-3;i<4;i+=2) for (let j=-35;j<-26;j+=3) {
      p.rect(x+i,y+j,1,1,[(age>>2)%3===0?'white':'ice','pink','sky'][(i+j+99)%3]);
    }
    if (age%32<16) {
      p.rect(x+8,y-31,3,1,'pink');p.rect(x-7,y-34,1,2,'ice');
    }
  } else {
    y+=15;
    p.rect(x-4,y-35,9,2,'tan');p.rect(x-6,y-33,13,3,'yellow');p.rect(x-4,y-30,9,2,'cream');
    p.rect(x-9,y-24,1,2,'orange');p.rect(x+9,y-24,1,2,'orange');
  }
}
function mallDecor(p,f,y,cam,state) {
  const m=state.mall;
  if (kiosks[f] && visible(kiosks[f],cam)) directoryKiosk(p,kiosks[f],y,state.frame);
  if (f===2) photoBooth(p,booth.x,y,state.frame);
  for (const [i,fountainData] of fountains.entries()) if (fountainData.floor===f && visible(fountainData.x,cam)) {
    fountain(p,fountainData.x,y,state.frame,m.fountains[i]);
  }
  for (const [i,l] of lamps.entries()) if (l.floor===f && visible(l.x,cam) && !m.lights[i].down) light(p,l.x,y,f===3,state.frame);
  if (f===5) {
    for(let x=46;x<WORLD.width;x+=101) {
      p.rect(x,y-42,11,42,'blue');p.rect(x,y-42,3,42,'royal');
      p.rect(x,y-13,12,5,'honey');p.rect(x,y-8,12,3,'ink');
      p.rect(x+25,y-2,9,1,'sky');
    }
    p.rect(car.x-30,y-39,61,11,'ink');p.center('GETAWAY',car.x,y-36,'ice',1,true);
    wagon(p,car.x,y,state.frame);
  } else {
    for (const x of [92,365,570,746]) if (visible(x,cam) && !shops.some(s=>s.floor===f&&Math.abs(s.x-x)<48) &&
        !escalators.some(e=>(e.top===f || e.bottom===f) && x>e.bx-18 && x<e.tx+18)) {
      if ((x+f)%3===0) bench(p,x,y);
      else plant(p,x,y);
    }
  }
}
function roof(p) {
  const y=floors[0];
  p.rect(0,0,25,49,'ink');p.rect(0,0,2,49,'blue');p.rect(22,0,3,49,'navy');
  for (let j=4;j<42;j+=6) for (let i=3;i<22;i+=6) p.rect(i,j,2,3,(i+j)%5?'royal':'honey');
  p.rect(18,29,11,3,'silver');p.line(24,30,107,62,'grey');p.line(24,31,107,63,'ink');
  p.rect(104,59,5,19,'royal');p.rect(104,59,2,17,'silver');p.rect(102,60,8,2,'ice');
  for (let x=182;x<768;x+=84) {
    p.rect(x,69,58,9,'navy');p.rect(x,68,58,2,'royal');
    for (let i=0;i<7;i++) p.rect(x+3+i*8,72,5,2,'grey');
  }
  p.rect(254,48,76,20,'black');p.outline(254,48,76,20,'violet');p.center('MALL',292,53,'pink',2,true);
  p.rect(412,51,31,27,'blue');p.rect(412,51,31,2,'sky');p.rect(417,57,20,21,'navy');
}
function mallBackdrop(p,state,camX,camY) {
  const m=state.mall;
  sky(p,0,0,WORLD.width,floors[0]);city(p,0,0,WORLD.width,floors[0],0);
  p.rect(0,floors[0],WORLD.width,WORLD.height-floors[0],'ink');
  roof(p);
  for (const [f,y] of floors.entries()) {
    if (y<camY-5 || y>camY+269) continue;
    const [base,beam,lightColor]=stripes[f];
    if (f) {
      p.rect(0,y-42,WORLD.width,42,base);
      for(let x=Math.floor(camX/32)*32;x<camX+275;x+=32) {
        p.rect(x,y-42,1,32,beam);
        p.rect(x+1,y-23,31,1,beam);
        p.rect(x+1,y-4,31,1,beam);
        if (f!==5 && (x/32)%3===1) {
          p.rect(x+9,y-35,13,21,'ink');p.rect(x+10,y-34,11,19,beam);
          p.rect(x+12,y-32,7,1,lightColor);p.rect(x+12,y-28,6,7,base);
        }
      }
    }
    p.rect(0,y,WORLD.width,4,beam);
    p.rect(0,y,WORLD.width,1,lightColor);
    p.rect(0,y+4,WORLD.width,2,'ink');
    for(let x=Math.floor(camX/16)*16;x<camX+272;x+=16) p.rect(x,y+2,11,1,base);
    for (const [i,shaft] of shafts.entries()) if (f>=shaft.top && f<=shaft.bottom && visible(shaft.x,camX)) {
      shaftBack(p,shaft,y,f);
      const c=m.cars[i];
      p.rect(shaft.x-9,y,18,5,c.y<y?'grey':'black');
      if (c.y<y) for(let j=-7;j<9;j+=3) p.rect(shaft.x+j,y+1,1,3,'ink');
    }
    for (const s of shops) if (s.floor===f && visible(s.x,camX)) {
      storefront(p,s,s.x,y,state.frame,{cleared:state.rooms[s.id]?.cleared,sale:state.blackFriday});
    }
    mallDecor(p,f,y,camX,state);
    const patch=m.janitor.patch;
    if (f===4 && patch) {
      p.rect(patch.x-24,y-2,48,2,'teal');p.rect(patch.x-23,y-1,45,1,'sky');
      p.rect(patch.x-4,y-14,10,10,'honey');p.rect(patch.x-3,y-13,8,8,'yellow');
      p.center('!',patch.x+1,y-12,'ink',1,true);
    }
  }
  for (const e of escalators) escalator(p,e,state.frame);
  for (const [i,shaft] of shafts.entries()) if (visible(shaft.x,camX)) drawCar(p,shaft,m.cars[i],state.frame);
}
function figure(p,asset,x,y,frame,dir) {
  p.image(sprites[asset],x-8,y-24,{frame,flip:dir<0});
}
export function drawBubbles(p,list,offsetX=0,offsetY=0,minimumY=19) {
  for (const effect of list) {
    const w=textWidth(effect.text,1,true)+8;
    const x=clamp(Math.round(effect.x-offsetX-w/2),2,254-w);
    const y=clamp(Math.round(effect.y-offsetY-14),minimumY,214);
    if (effect.x-offsetX<0 || effect.x-offsetX>256 || effect.y-offsetY<0 || effect.y-offsetY>241) continue;
    p.rect(x+1,y+1,w,11,'black');p.rect(x,y,w,10,'cream');
    p.text(effect.text,x+4,y+2,'ink',1,true);
    p.rect(clamp(effect.x-offsetX,x+3,x+w-6),y+10,4,2,'cream');
  }
}
export function drawParticles(p,list) {
  for (const fx of list) {
    if (fx.text) p.center(fx.text,fx.x,fx.y-(45-fx.left)*.26,'yellow',1,true);
    else for (let i=0;i<5;i++) {
      const age=38-fx.left;
      const dx=(i-2)*age*.14, dy=-age*.21+(i%3)*3;
      p.rect(fx.x+dx,fx.y+dy,Math.max(1,4-age*.08),3,i%2?'grey':'lilac');
    }
  }
}

export function drawMall(p,state) {
  const m=state.mall, agent=state.player;
  const camX=Math.round(clamp(agent.x-122,0,WORLD.width-256));
  const camY=Math.round(clamp(agent.y-151,0,WORLD.height-224));
  const shake=m.shake ? [0,-2,2,0,1,-1][state.frame%6] : 0;
  const offsetY=camY-16;
  p.ctx.save();
  p.ctx.translate(-camX+shake,-offsetY);
  mallBackdrop(p,state,camX,camY);
  for (const [i,l] of lamps.entries()) if (m.lights[i].dark) {
    p.alpha(.4,()=>p.rect(l.x-23,floors[l.floor]-39,46,39,'black'));
  }
  for (const f of m.falling) {
    if (lamps[f.i].floor===3) {
      p.rect(f.x-3,f.y-3,7,7,'violet');p.rect(f.x-4,f.y-1,9,3,'sky');
      p.rect(f.x-1,f.y-2,3,3,state.frame%6<3?'white':'pink');
      p.rect(f.x+2,f.y+1,1,1,'ice');
    }
    else {
      p.rect(f.x-5,f.y-3,11,4,'honey');p.rect(f.x-3,f.y,7,2,'cream');
    }
  }
  for (const c of m.coins) p.image(sprites.coin,c.x-4,c.y-6,{frame:Math.floor(state.frame/5),scale:c.gold?2:1});
  for (const d of m.drops) {
    p.rect(d.x-5,floors[d.floor]-11,11,10,'violet');
    p.center(d.id==='life'?'1':'+',d.x,floors[d.floor]-9,'cream',1,true);
  }
  const tick=Math.floor(state.frame/6);
  figure(p,'janitor',m.janitor.x,floors[4],m.janitor.phase<490?tick:2,m.janitor.dir);
  for (const w of m.walkers) figure(p,'walker',w.x,floors[3],tick,w.dir);
  figure(p,'cop',m.cop.x,floors[m.cop.floor],tick,m.cop.dir);
  for (const spy of m.spies) {
    const pose=spy.dead?'dead':spy.duck?'duck':spy.aim?'aim':'walk';
    if (spy.aim && spy.aim%10<5) p.rect(spy.x+spy.dir*10,floors[spy.floor]-(spy.low?6:15),2,1,'red');
    figure(p,'spy-'+pose,spy.x,floors[spy.floor],tick,spy.dir);
    if (spy.aim) p.center('!',spy.x,floors[spy.floor]-31,'coral',1,true);
  }
  if (!agent.hidden && (!agent.invulnerable || state.frame%8<5)) {
    const pose=agent.death?'dead':state.scene==='arrival'&&state.age<=58?'zip':
      agent.duck || state.scene==='arrival'&&state.age>63&&state.age<77?'duck':
      state.pickup?'item':agent.kick?'kick':agent.cooldown>14?'aim':agent.moving||agent.stairs?'walk':'idle';
    if (state.power.cinna && state.frame%6<3) p.alpha(.75,()=>p.rect(agent.x-7,agent.y-25,14,25,'yellow'));
    figure(p,'agent-'+pose,agent.x,agent.y,tick,agent.dir);
    if (state.pickup) p.image(sprites.package,agent.x-6,agent.y-31);
  }
  for (const b of m.bullets) {
    p.rect(b.x-2,b.y,5,2,b.team==='player'?'yellow':'coral');
    p.rect(b.x+(b.vx>0?1:-2),b.y,2,1,'white');
  }
  drawParticles(p,m.particles);
  p.ctx.restore();
  drawBubbles(p,m.bubbles,camX-shake,offsetY);
}
