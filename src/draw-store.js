import {sprites} from './art.js';
import {byId,clamp,rooms,tilePixel} from './data.js';
import {words} from './copy.js';
import {display} from './displays.js';
import {drawBubbles,drawParticles} from './draw-mall.js';
import {nearbyFixture} from './store.js';

const themes = {
  fashion:['plum','purple','violet','pink','wine','peach'],
  electronics:['night','navy','blue','ice','royal','aqua'],
  toys:['blue','royal','teal','mint','purple','coral'],
  food:['bark','brown','tan','honey','wine','coral'],
  sports:['darkGreen','pine','teal','mint','blue','peach'],
  music:['plum','wine','hotPink','pink','navy','aqua'],
  gadgets:['navy','blue','royal','ice','plum','violet'],
  novelty:['black','night','purple','lilac','wine','pink'],
  games:['night','navy','royal','pink','plum','mint']
};

function tileFloor(p,x,y,theme,colors) {
  const [base,second,trim,accent]=colors;
  const phase=(x+y)%2, X=x*16,Y=y*16;
  p.rect(X,Y,16,16,phase?base:second);
  if (theme==='fashion' || theme==='games') p.rect(X+1,Y+1,14,14,phase?second:base);
  else if (theme==='food' || theme==='sports') {
    p.rect(X,Y+1,16,1,trim);p.rect(X+(y%2)*8,Y+1,1,15,trim);
  } else if (theme==='music' || theme==='novelty') {
    p.rect(X+6,Y+6,4,4,trim);p.rect(X+7,Y+7,2,2,phase?accent:second);
  } else if (theme==='toys') {
    p.rect(X+(y%3)*3,Y+13,6,1,trim);p.rect(X+1,Y+2,1,4,second);
  } else {
    p.rect(X,Y,16,1,trim);p.rect(X,Y+1,1,15,trim);
    if (phase) p.rect(X+11,Y+12,3,1,base);
  }
}
function tileWall(p,x,y,room,colors) {
  const [,second,trim,accent]=colors, X=x*16,Y=y*16;
  const edge=y===0 || y===room.height-1;
  p.rect(X,Y,16,16,'ink');p.rect(X+(edge?0:2),Y+2,edge?16:12,11,second);
  p.rect(X,Y+2,16,1,trim);p.rect(X+1,Y+12,14,1,trim);
  if (edge) {
    p.rect(X+2,Y+6,12,3,'black');p.rect(X+3,Y+7,10,1,trim);
    if(x%3===0) p.rect(X+3,Y+7,3,1,accent);
  } else p.rect(X+4,Y+4,1,7,accent);
}
function tileFixture(p,id,x,y,kind,open,colors,frame) {
  const [,second,trim,accent,side,highlight]=colors;
  p.rect(x+1,y+4,15,12,'ink');
  p.rect(x+1,y+1,14,13,side);p.rect(x+1,y+1,14,1,accent);
  if (kind==='F') {
    p.rect(x+2,y+3,12,10,open?'ink':'wine');
    p.rect(x+2,y+3,12,1,'pink');
    for(let i=3;i<14;i+=3) p.rect(x+i,y+4,1,open?3:8,'hotPink');
    p.rect(x+5,y+13,7,1,'tan');
  } else if (kind==='d') {
    p.clip(x+2,y+2,12,12,()=>display(p,id,0,x+1,y-1,frame));
    p.rect(x+2,y+12,12,2,trim);
  } else if (kind==='c') {
    p.rect(x+1,y+2,14,7,trim);p.rect(x+2,y+3,12,1,accent);
    p.rect(x+3,y+9,10,1,highlight);p.rect(x+2,y+13,12,1,second);
  } else if (open) {
    p.rect(x+3,y+3,10,7,'ink');p.rect(x+4,y+4,8,2,second);
    p.rect(x+4,y+8,3,2,highlight);p.rect(x+10,y+6,2,4,trim);
    p.rect(x+5,y+11,5,1,highlight);
  } else {
    p.rect(x+2,y+3,12,8,trim);
    if (kind==='t') {
      p.rect(x+3,y+5,3,4,highlight);p.rect(x+7,y+4,5,5,accent);
      p.rect(x+8,y+6,1,1,'ink');p.rect(x+3,y+10,10,1,'ink');
    } else {
      p.rect(x+3,y+4,10,3,second);
      p.rect(x+3,y+8,10,2,second);
      p.rect(x+4,y+5,2,1,accent);p.rect(x+9,y+5,3,1,highlight);p.rect(x+7,y+8,5,2,accent);
    }
    p.rect(x+2,y+12,12,1,highlight);
  }
}
function roomFigure(p,entity,prefix,frame) {
  const dir=entity.dy<0?'up':entity.dy>0?'down':'side';
  p.image(sprites[prefix+'-'+dir],entity.x-8,entity.y-10,{frame,flip:entity.dx<0});
}

export function drawStore(p,state) {
  const r=state.room, shop=byId[r.id], room=rooms[r.id], data=state.rooms[r.id];
  const theme=themes[shop.theme], frame=Math.floor(state.frame/8), baseY=36;
  const camX=Math.round(clamp(r.x-128,0,Math.max(0,room.width*16-256)));
  const camY=Math.round(clamp(r.y-90,0,Math.max(0,room.height*16-176)));
  p.rect(0,16,256,224,'night');
  p.rect(0,17,256,17,theme[1]);
  p.rect(0,17,256,1,theme[3]);p.rect(0,33,256,1,theme[2]);
  p.text('FLOOR '+['R','4F','3F','2F','1F','P'][shop.floor],7,23,theme[3],1,true);
  p.center(shop.name,128,22,'cream');
  p.right(shop.role==='target'?'TARGET':'SUPPLY',249,23,theme[3],1,true);
  p.clip(0,baseY,256,176,()=>{
    p.ctx.save();
    p.ctx.translate(-camX,baseY-camY);
    for (const [y,row] of room.layout.entries()) for (const [x,type] of [...row].entries()) {
      if (x*16<camX-16 || x*16>camX+256 || y*16<camY-16 || y*16>camY+176) continue;
      if (type==='#') tileWall(p,x,y,room,theme);
      else tileFloor(p,x,y,shop.theme,theme);
      if ('ftFcd'.includes(type)) {
        const index=room.fixtures.findIndex(f=>f.x===x&&f.y===y);
        tileFixture(p,r.id,x*16,y*16,type,data.opened.includes(index),theme,frame%3);
        if (state.power.radar && index>=0 && !data.opened.includes(index) && data.contents[index]==='package' && state.frame%30<20)
          p.center('!',tilePixel(x),y*16-3,'yellow');
      }
      if (type==='e') {
        p.rect(x*16,y*16,16,15,'black');p.rect(x*16+1,y*16+1,14,2,'mint');
        p.center('V',tilePixel(x),y*16+6,'mint',1,true);
      }
      if (type==='b') {
        p.rect(x*16+1,y*16+1,14,14,'plum');p.outline(x*16+1,y*16+1,14,14,'pink');
        p.center('B',tilePixel(x),y*16+6,r.sideB?'white':'pink',1,true);
      }
      if (type==='j' && r.gift && !r.cave) {
        p.rect(x*16+2,y*16+6,12,8,'violet');p.rect(x*16+3,y*16+6,10,2,'pink');
        p.image(sprites.package,x*16+2,y*16-3-(frame%2));
      }
    }
    for (const toy of r.toys) if (!toy.phase) p.image(sprites.toy,toy.x-4,toy.y-4,{frame,flip:toy.dx<0});
    for (const g of r.guards) {
      if (g.dead) {
        p.rect(g.x-6,g.y+2,12,3,'ink');p.rect(g.x-3,g.y,6,3,'grey');
      } else if (g.kind==='bot') p.image(sprites.bot,g.x-8,g.y-9,{frame});
      else roomFigure(p,g,'guard',g.stun||g.aim||r.visit?0:frame);
      if (g.aim || g.stun) p.center(g.aim?'!':'*',g.x,g.y-16,g.aim?'coral':'yellow',1,true);
    }
    if (r.gift) {
      p.image(sprites.clerk,128,14,{frame});
      for (const x of [86,154]) p.clip(x,15,15,15,()=>display(p,'radio',0,x-3,15,frame%3));
    }
    const player=state.player;
    if (player.death) p.image(sprites['agent-dead'],r.x-8,r.y-19);
    else if (!player.invulnerable || state.frame%8<5) {
      if (state.power.cinna && state.frame%6<3) p.rect(r.x-6,r.y-9,12,13,'yellow');
      roomFigure(p,r,'room',r.moving?frame:0);
      if (state.pickup) p.image(sprites.package,r.x-6,r.y-20);
    }
    for (const s of r.bullets) {
      p.rect(s.x-1,s.y-1,s.kind==='shoe'?4:3,3,s.team==='player'?'yellow':'coral');
      p.rect(s.x,s.y,1,1,'white');
    }
    drawParticles(p,r.particles);
    p.ctx.restore();
  });
  drawBubbles(p,r.bubbles,camX,camY-baseY,38);
  if (r.cave) {
    const printed=Math.floor((165-r.cave)/3);
    p.rect(15,133,226,54,'ink');p.outline(15,133,226,54,'cream');
    p.text(words.clerk[0].slice(0,printed),24,144,'cream');
    p.text(words.clerk[1].slice(0,Math.max(0,printed-words.clerk[0].length)),24,158,'cream');
  }
  p.rect(0,212,256,28,'ink');
  p.rect(0,212,256,1,theme[3]);
  p.text(shop.name,8,222,theme[3],1,true);
  if (r.search) {
    p.center(words.searching,176,217,'yellow',1,true);
    p.rect(104,227,144,6,'slate');
    p.rect(105,228,142*(1-r.search.left/r.search.total),4,'yellow');
  } else if (nearbyFixture(state)) {
    p.right(words.search,248,221,'yellow');
  } else {
    p.right('EXIT AT BOTTOM',248,222,'silver',1,true);
  }
}
