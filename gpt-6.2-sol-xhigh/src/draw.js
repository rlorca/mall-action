import {sprites} from './art.js';
import {floorNames,powerNames,words} from './copy.js';
import {byId,car,escalators,floors,shafts,shops} from './data.js';
import {storefront} from './displays.js';
import {city,drawMall,sky,wagon} from './draw-mall.js';
import {drawStore} from './draw-store.js';
import {textWidth} from './pixel.js';
import {drawSplash} from './splash/index.js';

const rainbow=['red','orange','yellow','mint','aqua','sky','lilac','pink'];
const digits = (score,size=6) => String(score).padStart(size,'0');
const mono = (p,text,x,y,ink='cream') => p.center(text,x,y,ink,1,true);
function edge(p,x,y,w,h,color='royal') {
  p.outline(x,y,w,h,color);
  for (const [dx,dy] of [[0,0],[w-2,0],[0,h-2],[w-2,h-2]]) p.rect(x+dx,y+dy,2,2,'ice');
}

function title(p,s) {
  sky(p,0,0,256,191);city(p,0,7,256,188,Math.floor(s.age/20));
  p.rect(0,187,256,4,'violet');p.rect(0,191,256,49,'ink');
  for (let i=0;i<5;i++) {
    const shift=Math.floor(s.age*.4);
    const x=i*84-(shift%84)+29;
    storefront(p,shops[(i+Math.floor(shift/84))%shops.length],x,232,s.age,{sale:s.blackFriday});
  }
  p.rect(0,232,256,8,'navy');p.rect(0,232,256,1,'pink');
  for (let x=0;x<256;x+=14) p.rect(x+2,235,8,1,'royal');
  p.rect(8,8,240,16,'ink');p.line(8,24,247,24,'royal');
  p.text(words.studio,15,13,'ice',1,true);
  p.right('HI '+digits(s.high),241,13,'yellow',1,true);
  p.rect(99,27,58,2,'sky');p.rect(120,30,16,1,'pink');
  for (const [label,y,scale] of [['MALL',42,5],['ACTION',82,5]]) {
    p.center(label,131,y+5,'black',scale);
    p.center(label,128,y+3,'burgundy',scale);
    p.center(label,128,y,'coral',scale);
    p.clip(0,y,256,14,()=>p.center(label,128,y,'yellow',scale));
    p.clip(0,y,256,4,()=>p.center(label,128,y,'cream',scale));
  }
  p.rect(38,124,180,17,'ink');
  p.line(39,124,216,124,'pink');p.line(39,140,216,140,'royal');
  p.center(words.subtitle,128,129,'ice');
  if (s.blackFriday) {
    p.rect(37,145,182,30,'black');
    p.center(words.blackFriday,128,148,s.age%15<8?'yellow':'pink');
    p.center(words.saleTitle,128,161,'cream',1,true);
  } else {
    p.rect(68,149,120,19,'plum');edge(p,68,149,120,19,'violet');
    if (s.age%64<48) p.center(words.start,128,155,'cream');
  }
  p.text(words.copyright,8,178,'cream',1,true);
  p.right(words.controlsShort,248,178,'ice',1,true);
  if (s.age%550>=470) {
    p.rect(0,178,256,9,'ink');mono(p,words.credits,128,178,'ice');
  }
}
function hud(p,s) {
  p.rect(0,0,256,16,'black');p.rect(0,15,256,1,'violet');
  p.text('SCORE',4,2,'sky',1,true);
  p.text(digits(s.score),4,8,'cream',1,true);
  p.rect(31,2,1,11,'slate');
  p.text('PKG '+s.packages+'/6',35,5,s.packages===6?'mint':'coral',1,true);
  p.rect(66,2,1,11,'slate');
  p.image(sprites.head,71,4);p.text('X'+s.lives,81,5,'cream',1,true);
  p.rect(97,2,1,11,'slate');
  const active=[s.power.weapon,s.power.speed,s.power.cinna].filter(Boolean);
  if (active.length) {
    const item=active[Math.floor(s.frame/110)%active.length];
    p.text(powerNames[item.id],102,2,'yellow',1,true);
    p.rect(102,10,55,3,'slate');p.rect(102,10,55*item.left/item.max,3,'aqua');
  } else if (s.alarm) {
    if (s.frame%24<15) p.text(words.alarmShort,102,5,'coral',1,true);
  } else {
    p.text('LOOP '+s.loop,102,5,'sky',1,true);
  }
  if (active.length && s.alarm && s.frame%24<15) p.text(words.alarmShort,161,5,'coral',1,true);
  if (s.power.armor) p.text('+',184,5,'ice',1,true);
  if (s.power.radar) p.text('!',190,5,'mint',1,true);
  p.rect(199,1,54,13,'navy');p.rect(201,3,50,9,'black');
  if (s.room && s.scene!=='mall') {
    const name=byId[s.room.id].name;
    p.clip(203,3,46,9,()=>{
      if (textWidth(name,1,true)<47) mono(p,name,226,5,'mint');
      else p.text(name+'   '+name,203-(Math.floor(s.frame/4)%((name.length+3)*4)),5,'mint',1,true);
    });
  } else mono(p,floorNames[s.player.floor],226,5,'mint');
}
function banner(p,lines,color='yellow') {
  const w=Math.min(250,Math.max(...lines.map(line=>textWidth(line,1,true)))+20);
  const x=Math.floor((256-w)/2);
  p.rect(x+2,21,w,lines.length*9+7,'black');
  p.rect(x,19,w,lines.length*9+7,'ink');p.outline(x,19,w,lines.length*9+7,color);
  lines.forEach((line,i)=>mono(p,line,128,25+i*9,color));
}
function directory(p,s) {
  p.rect(0,16,256,224,'night');
  p.rect(0,16,256,25,'navy');p.rect(0,41,256,1,'sky');
  p.center(words.directory,128,23,'ice',2,true);
  const x = worldX => Math.round(25+worldX/768*216);
  const y = floor => 57+floor*21;
  for (let f=0;f<floors.length;f++) {
    p.text(floorNames[f],8,y(f)-6,'cream',1,true);
    p.rect(25,y(f),217,1,'royal');
    for(let i=0;i<13;i++) p.rect(25+i*18,y(f)-3,1,4,'blue');
  }
  for (const e of escalators) {
    p.line(x(e.bx),y(e.bottom),x(e.tx),y(e.top),'aqua');
    p.line(x(e.bx)-2,y(e.bottom),x(e.tx)-2,y(e.top),'royal');
  }
  for (const [i,shaft] of shafts.entries()) {
    p.rect(x(shaft.x)-2,y(shaft.top)-6,5,21*(shaft.bottom-shaft.top)+8,'slate');
    p.rect(x(shaft.x),y(shaft.top)-4,1,21*(shaft.bottom-shaft.top)+6,'sky');
    p.center(shaft.id,x(shaft.x),y(shaft.top)-12,'ice',1,true);
    const c=s.mall.cars[i], cy=y(0)+(c.y-floors[0])*21/48;
    p.rect(x(shaft.x)-2,cy-3,5,4,'yellow');
  }
  for (const shop of shops) {
    const cleared=s.rooms[shop.id]?.cleared, ink=shop.role==='closed'?'slate':cleared?'grey':shop.role==='target'?'red':'sky';
    const shown=!s.room || s.room.id!==shop.id || s.frame%26<15;
    if (shown) {
      if (shop.role==='closed') p.outline(x(shop.x)-8,y(shop.floor)-7,16,7,ink);
      else p.rect(x(shop.x)-8,y(shop.floor)-7,16,7,ink);
    }
    if (s.power.radar && shop.role==='target' && !cleared) mono(p,'!',x(shop.x),y(shop.floor)-14,'yellow');
  }
  p.rect(x(car.x)-6,y(5)-5,13,4,'honey');p.rect(x(car.x)-4,y(5)-8,8,3,'honey');
  if (!s.room && s.frame%26<16) {
    const dX=x(s.player.x), dY=y(0)+(s.player.y-floors[0])*21/48;
    p.rect(dX-1,dY-7,3,8,'white');p.rect(dX-3,dY-5,7,3,'white');
  }
  p.rect(0,174,256,1,'royal');
  for (const [i,[label,ink]] of [['PACKAGE','red'],['CLEARED','grey'],['SUPPLY','sky'],['CLOSED','slate']].entries()) {
    const X=8+i*62;
    p.rect(X,182,6,5,ink);p.text(label,X+9,182,'cream',1,true);
  }
  p.text('A B C ELEVATORS',8,194,'ice',1,true);
  p.right(words.exit,248,194,'yellow',1,true);
  p.rect(0,204,256,36,'ink');
  p.text(words.inventory,8,209,'sky',1,true);
  const inventory=s.inventory.join(' / ') || words.empty;
  p.clip(8,219,241,6,()=>p.text(inventory,8-(inventory.length>59?Math.floor(s.frame/5)%(inventory.length*4+18):0),219,'cream',1,true));
  p.right('SHIFT TO CLOSE',248,231,'silver',1,true);
}
function miniDirectory(p,s) {
  const target=byId[s.kiosk.shop];
  p.rect(36,164,184,58,'black');edge(p,36,164,184,58,'teal');
  mono(p,words.kiosk,128,170,'ice');
  if (!target) {
    mono(p,'ALL PACKAGES FOUND',128,198,'mint');
    return;
  }
  for(let i=0;i<6;i++) p.rect(65,181+i*3,127,1,'royal');
  const X=65+target.x/768*127;
  p.rect(X-2,179+target.floor*3,5,5,'coral');
  mono(p,floorNames[target.floor]+' '+target.name,128,207,'yellow');
}
function photo(p,s) {
  p.rect(30,68,196,123,'black');edge(p,30,68,196,123,'pink');
  p.rect(31,69,194,21,'hotPink');p.center(words.booth,128,76,'white');
  for (let i=0;i<4;i++) {
    p.rect(42+i*44,103,40,64,'cream');p.rect(44+i*44,105,36,52,i%2?'blue':'purple');
    p.image(sprites[['agent-idle','agent-aim','agent-duck','agent-item'][i]],46+i*44,108,{scale:2,flip:i%2===1});
    mono(p,'0'+(i+1),62+i*44,160,'wine');
  }
  mono(p,'ADDED TO INVENTORY',128,178,'pink');
}
function spygram(p,post,age,complete) {
  p.alpha(.7,()=>p.rect(0,16,256,224,'black'));
  p.rect(44,31,168,180,'black');p.rect(40,28,168,180,'cream');
  p.rect(40,28,168,22,'hotPink');p.rect(40,28,168,2,'pink');
  p.text(words.gram,48,36,'white');
  p.right(complete?'MISSION':'ROOFTOP',200,37,'cream',1,true);
  p.clip(46,54,156,89,()=>{
    sky(p,46,54,156,80);city(p,46,55,156,133);
    p.rect(46,130,156,13,'navy');
    if (complete) wagon(p,168,135,age);
    else {
      p.line(46,79,144,112,'grey');p.rect(142,112,4,19,'silver');
    }
    p.image(sprites[complete?'agent-item':'agent-selfie'],80,66,{scale:3,flip:complete});
    if (complete) p.image(sprites.package,92,58,{scale:2});
    if (age%31<16) {
      p.rect(174,65,8,1,'cream');p.rect(177,62,1,7,'cream');
    }
  });
  p.text('♥ '+Math.min(complete?917:389,Math.max(1,Math.floor(age*(complete?11:5.9))))+' LIKES',47,149,'wine',1,true);
  post.slice(0,2).forEach((line,i)=>p.text(line,47,162+i*9,'ink'));
  p.rect(46,183,156,16,'peach');p.text(post[2],50,189,'wine',1,true);
}
function clear(p,s) {
  p.rect(0,0,256,240,'navy');
  p.rect(0,102,256,53,'ink');
  for (let i=0;i<7;i++) {
    p.rect(i*43+8,103,9,53,'blue');p.rect(i*43+10,134,7,7,'honey');
  }
  p.rect(0,151,256,2,'sky');p.rect(0,156,256,83,'night');
  for(let x=0;x<256;x+=22) p.rect(x,153,11,1,'royal');
  if (s.result.section===0) {
    const x=65+s.age*.64;
    wagon(p,x,151,s.age);
    const chase=18+s.age*.61;
    p.image(sprites['spy-walk'],chase-8,127,{frame:Math.floor(s.age/4)});
    p.rect(chase+5,133-(Math.floor(s.age/6)%3),4,5,'cream');
    p.center(words.tally,128,16,'yellow',2,true);
    p.rect(30,35,196,64,'ink');edge(p,30,35,196,64,'sky');
    const stats=[[words.packages,s.packages+'/6'],[words.time,digits(s.result.bonus,4)],[words.clear,'1000']];
    for (const [i,[label,value]] of stats.entries()) if (s.age>i*28) {
      p.text(label,42,45+i*15,'ice');p.right(value,214,45+i*15,'cream');
    }
    p.center('LOOP '+s.loop,128,175,'pink',2);
  } else if (s.result.section===1) {
    p.rect(25,16,206,198,'cream');p.rect(27,18,202,194,'peach');p.rect(29,20,198,190,'cream');
    p.center(words.newspaper,128,28,'ink',2,true);
    p.rect(34,44,188,2,'wine');p.rect(34,47,188,1,'brown');
    mono(p,words.edition+' / '+s.loop,128,53,'wine');
    for (const [i,line] of s.result.headline.entries()) p.center(line,128,64+i*11,'ink');
    p.clip(36,99,184,66,()=>{
      p.rect(36,99,184,66,'tan');
      p.rect(36,139,184,26,'brown');
      wagon(p,180,151,s.age);
      for(let i=0;i<6;i++) p.image(sprites.package,83+i*6,142-(i%3)*8);
      p.image(sprites['agent-item'],47,96,{scale:2});
    });
    for (let i=0;i<5;i++) {
      p.rect(36,171+i*6,82-(i%3)*7,1,'brown');p.rect(133,171+i*6,87-(i%2)*10,1,'brown');
    }
  } else spygram(p,s.result.post,s.age,true);
  mono(p,words.skip,128,223,'ice');
}
function continuing(p,s) {
  p.alpha(.8,()=>p.rect(0,0,256,240,'black'));
  p.rect(29,51,198,134,'night');edge(p,29,51,198,134,'violet');
  p.center(words.continuation,128,63,'cream',2);
  const remaining=Math.max(0,9-Math.floor(s.age/60));
  p.center(String(remaining),128,90,remaining<=3?'coral':'yellow',6);
  p.center(words.continues+': '+s.continues,128,144,'ice',1,true);
  if(s.age%45<32) mono(p,words.continuePrompt,128,165,'cream');
}
function gameOver(p,s) {
  const amount=Math.min(48,Math.floor(s.age*.6));
  for(let y=45;y<240;y+=48) {
    p.rect(0,y,256,amount,'slate');
    for(let j=0;j<amount;j+=4) {
      p.rect(0,y+j,256,1,'ink');p.rect(0,y+j+1,256,1,'grey');
    }
  }
  p.alpha(Math.min(.85,.32+s.age*.003),()=>p.rect(0,0,256,240,'black'));
  if (s.age<170) {
    const length=Math.floor(s.age/3);
    banner(p,words.closing.map((line,i)=>line.slice(0,Math.max(0,length-(i?words.closing[0].length:0)))),'coral');
  } else {
    p.center(words.gameOver,128,88,'coral',3);
    p.center('SCORE '+digits(s.score),128,127,'cream');
    p.center('HIGH  '+digits(s.high),128,144,'yellow');
    if (s.age%60<44) mono(p,words.start,128,175,'silver');
  }
}

function gallery(p,frame) {
  p.rect(0,0,256,240,'night');
  p.center('SPRITE GALLERY',128,5,'ice');
  for (const [index,[name,asset]] of Object.entries(sprites).entries()) {
    const x=3+(index%6)*42,y=18+Math.floor(index/6)*36;
    p.rect(x,y,39,33,'navy');
    p.image(asset,x+19-asset[0].width/2,y+14-asset[0].height/2,{frame:Math.floor(frame/7),flip:frame%110>=55});
    mono(p,name.replace('agent-','A ').replace('guard-','G ').replace('room-','R ').replace('spy-','S ').slice(0,9),x+19,y+26,'ice');
  }
}

export function drawGame(p,s,{showGallery=false}={}) {
  p.rect(0,0,256,240,'black');
  if (showGallery) gallery(p,s.frame);
  else if (s.scene==='splash') drawSplash(p,s.age,words.studio,words.presents,rainbow);
  else if (s.scene==='title') title(p,s);
  else if (s.scene==='clear') clear(p,s);
  else {
    if (s.room) drawStore(p,s);
    else drawMall(p,s);
    hud(p,s);
    if (s.banner) banner(p,s.banner.lines,s.banner.color);
    if (s.kiosk) miniDirectory(p,s);
    if (s.capture) photo(p,s);
    if (s.scene==='arrival') {
      if (s.age>=89) spygram(p,s.post,s.age-89,false);
      else if (s.age>=85) p.alpha((89-s.age)*.22,()=>p.rect(0,16,256,224,'white'));
    }
    if (s.scene==='continue') continuing(p,s);
    if (s.scene==='over') gameOver(p,s);
    if (s.overlay==='map') directory(p,s);
    if (s.overlay==='pause') {
      p.alpha(.76,()=>p.rect(0,16,256,224,'black'));
      if (s.frame%54<40) p.center(words.pause,128,102,'yellow',3);
      mono(p,words.resume,128,143,'ice');
    }
    if (s.transition) {
      const strength=1-Math.abs(s.transition.left-12)/12;
      p.alpha(strength,()=>p.rect(0,16,256,224,'black'));
    }
  }
  if (s.toast) {
    const width=textWidth(s.toast.text,1,true)+14;
    p.rect(248-width,218,width,13,'black');p.outline(248-width,218,width,13,'aqua');
    mono(p,s.toast.text,248-width/2,222,'ice');
  }
}
