import {sprite} from './pixel.js';

function person(paint,enemy,pose,frame) {
  let r = paint;
  if (pose==='dead') {
    r(1,19,12,3,1); r(3,17,8,4,2); r(12,17,3,4,3); r(10,17,3,1,1);
    return;
  }
  if (pose==='duck') r = (x,y,w,h,c)=>paint(x,y+7,w,h>3?h-1:h,c);
  if (enemy) {
    r(5,1,6,4,1); r(3,4,11,2,1); r(6,6,6,4,3); r(8,6,5,1,1); r(6,8,2,2,2);
  } else {
    r(5,1,7,2,1); r(4,3,10,3,1); r(5,6,8,4,3); r(5,5,3,4,1); r(11,6,1,1,1);
  }
  r(4,10,8,2,2); r(3,12,10,7,2); r(5,18,7,2,2);
  if (enemy) {r(8,11,2,4,3); r(9,11,1,3,1);}
  else {r(3,12,2,5,1); r(9,12,1,7,3); r(10,11,3,1,3); r(5,16,7,1,1);}
  if (pose==='aim') {r(10,12,4,3,2); r(13,12,2,2,3); r(14,12,2,1,1);}
  if (pose==='zip') {r(3,2,2,10,2);r(2,1,2,3,3);r(13,1,2,12,2);r(13,0,2,3,3);}
  if (pose==='selfie') {
    r(10,12,4,2,2);r(12,8,2,5,2);r(12,7,2,2,3);
    r(13,2,3,6,1);r(14,3,1,2,3);
  }
  if (pose==='item') {r(3,5,2,8,2);r(13,5,2,7,2);r(3,3,2,3,3);r(13,3,2,3,3);}
  if (pose==='kick') {
    r(6,19,4,3,1);r(10,17,4,3,1);r(13,16,3,3,1);r(4,20,3,2,1);
  } else if (pose==='duck') {paint(4,21,9,3,1);paint(11,22,4,2,1);}
  else {
    const offset=pose==='walk'?[0,2,0,1][frame]:0;
    r(5-offset,19,3,4,1); r(9+offset,19,3,4,1);
    r(4-offset,22,4,2,1); r(9+offset,22,4,2,1);
    if (pose==='walk') {r(2+offset,13,2,5,2);r(2+offset,17,2,2,3);}
  }
}
function mallCharacter(enemy,pose) {
  const colors=enemy?['ink','grey','tan']:['ink','red','peach'];
  return Array.from({length:pose==='walk'?4:1},(_,i)=>sprite(16,24,colors,r=>person(r,enemy,pose,i)));
}
function storeCharacter(color,dir,frame,enemy) {
  return sprite(16,16,['ink',color,'peach'],r=>{
    const step=frame%2;
    r(4,1,8,2,1);r(3,3,10,3,1);
    if (enemy) {r(2,4,12,2,1);r(4,1,8,4,1);}
    r(4,6,8,3,dir==='up'?1:3);
    if (dir!=='up') {
      r(dir==='side'?9:5,6,dir==='side'?3:6,1,1);
      if (enemy) r(4,6,8,1,1);
    }
    r(3,9,10,5,2);r(2,10+step,2,3,dir==='up'?2:3);r(12,11-step,2,3,dir==='up'?2:3);
    r(5,13,2,3-step,1);r(9,13,2,2+step,1);
    if (dir!=='up') r(8,9,1,4,3);
  });
}
const bot = Array.from({length:3},(_,i)=>sprite(16,16,['ink','sky','coral'],r=>{
  r(5,1,6,1,1);r(7,0,2,2,3);r(3,3,10,9,1);r(4,3,8,6,2);
  r(5,5,6,2,1);r(6+i,5,2,1,3);r(5,10,6,4,2);r(2,10,2,4,2);r(12,10,2,4,2);
  r(3,13,10,2,1);r(5,14,2,1,3);r(9,14,2,1,3);
}));
const npc = (colors,type) => Array.from({length:4},(_,i)=>sprite(16,24,colors,r=>{
  const step=i%3;
  r(5,2,7,7,3); r(4,1,7,3,1);
  if (type==='cop') {r(2,1,11,4,1);r(5,0,6,5,2);r(10,4,4,2,1);}
  if (type==='janitor') {r(3,2,10,3,2);r(5,0,6,4,2);}
  r(5,9,7,10,2);r(4,11,3,6,2);r(10,11,3,4,3);r(7,10,1,5,3);
  if (type==='cop') {r(5,19,8,3,1);r(7,21,6,2,1);r(10,12,1,9,1);r(10,12,5,1,3);r(9+step,22,2,1,3);}
  else {r(5-step,18,3,5,1);r(9+step,18,3,5,1);r(4-step,22,4,2,1);r(9+step,22,4,2,1);}
  if (type==='janitor') {r(13,11,1,11,3);r(11,21,5,2,3);}
}));
const object = (w,h,colors,paint,n=1) => Array.from({length:n},(_,i)=>sprite(w,h,colors,r=>paint(r,i)));

export const sprites = {
  ...Object.fromEntries(['idle','walk','duck','aim','dead','zip','kick','item','selfie'].map(p=>['agent-'+p,mallCharacter(false,p)])),
  ...Object.fromEntries(['idle','walk','duck','aim','dead'].map(p=>['spy-'+p,mallCharacter(true,p)])),
  ...Object.fromEntries(['up','down','side'].flatMap(dir=>[false,true].map(enemy=>[
    (enemy?'guard-':'room-')+dir,Array.from({length:4},(_,i)=>storeCharacter(enemy?'grey':'red',dir,i,enemy))
  ]))),
  bot,
  janitor:npc(['ink','teal','peach'],'janitor'),
  walker:npc(['ink','lilac','peach'],'walker'),
  cop:npc(['ink','sky','peach'],'cop'),
  clerk:object(16,16,['ink','purple','cream'],(r,i)=>{
    r(5,1,7,3,3);r(4,4,9,4,3);r(5,6,3,1,1);r(10,6,2,1,1);r(3,9,11,5,2);r(5,8,7,3,3);r(7,10,3,2,3);r(4,14,9,2,1);
  },2),
  toy:object(8,8,['ink','mint','pink'],(r,i)=>{
    r(1,2,6,5,1);r(2,1,4,2,2);r(2,3,4,3,2);r(3,3,2,1,3);r(i%2?0:2,6,3,2,3);r(i%2?5:3,6,3,2,3);
  },4),
  coin:object(8,8,['brown','honey','yellow'],(r,i)=>{
    const w=[6,4,2,4][i], x=(8-w)/2;
    r(x,2,w,5,1);r(x,1,w,5,2);r(x+1,2,1,3,3);
  },4),
  package:object(12,10,['brown','orange','cream'],r=>{
    r(0,2,12,8,1);r(1,1,10,7,2);r(4,1,3,8,3);r(6,5,4,2,3);
  }),
  head:object(8,8,['ink','red','peach'],r=>{
    r(2,0,5,3,1);r(2,2,5,4,3);r(2,2,2,2,1);r(5,3,1,1,1);r(1,6,7,2,2);
  }),
  flash:object(12,12,['yellow','cream','orange'],(r,i)=>{
    r(4,1,3,9,1);r(1,4,9,3,1);r(4,4,3,3,2);r(8,i%2?7:2,2,2,3);r(2,8,2,2,3);
  },3)
};
