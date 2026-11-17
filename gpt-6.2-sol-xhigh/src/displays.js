import {words} from './copy.js';

function tv(p,x,y,c,frame,off=false) {
  p.rect(x,y,11,8,'ink');
  p.rect(x+1,y+1,9,6,'grey');
  p.rect(x+2,y+2,6,4,off?'slate':c);
  p.rect(x+8,y+2,1,2,'cream');
  if (!off) for (let i=0;i<6;i++) p.rect(x+2+(i*7+frame*3)%6,y+2+(i*5+frame)%4,1,1,i%2?'white':'blue');
}
function shirt(p,x,y,c) {
  p.rect(x+2,y,5,7,c);p.rect(x,y+1,9,3,c);p.rect(x+3,y,3,1,'cream');
  p.rect(x+3,y+4,3,1,'ink');
}
function rocket(p,x,y) {
  p.rect(x+3,y,1,1,'cream');p.rect(x+2,y+1,3,7,'cream');p.rect(x+3,y+3,1,2,'ice');
  p.rect(x+1,y+6,5,2,'red');p.rect(x+2,y+8,3,2,'orange');p.rect(x+3,y+10,1,2,'yellow');
}
function mannequin(p,x,y,c) {
  p.rect(x+3,y,3,3,'peach');p.rect(x+2,y+4,5,5,c);p.rect(x+1,y+5,7,1,c);
  p.rect(x+2,y+9,2,4,'tan');p.rect(x+5,y+9,2,4,'tan');p.rect(x+1,y+13,8,1,'ink');
}
function lava(p,x,y,frame) {
  p.rect(x+2,y,5,2,'lilac');p.rect(x+1,y+3,7,9,'hotPink');
  p.rect(x+2,y+3,5,8,'wine');p.rect(x+3,y+3+frame,3,3,'pink');
  p.rect(x+2+frame,y+8,2,2,'coral');p.rect(x,y+12,9,2,'violet');
}
function orb(p,x,y,frame,color='lilac') {
  p.rect(x+3,y,7,11,'purple');p.rect(x+1,y+2,11,7,'violet');p.rect(x+3,y+2,7,7,color);
  p.line(x+6,y+6,x+2+frame*3,y+2,'white');p.line(x+6,y+6,x+10,y+8,'white');
  p.rect(x+4,y+10,5,2,'grey');p.rect(x+2,y+12,9,2,'ink');
}

export function display(p,id,side,x,y,frame) {
  y+=1;
  switch (id) {
    case 'fashion':
      if (!side) {
        mannequin(p,x+2,y+1,'pink');mannequin(p,x+14,y+1,'teal');
      } else {
        p.rect(x+1,y+3,23,1,'tan');p.rect(x+2,y+3,1,12,'brown');p.rect(x+22,y+3,1,12,'brown');
        shirt(p,x+2,y+6,'orange');shirt(p,x+8,y+6,'sky');shirt(p,x+14,y+6,'pink');
      }
      break;
    case 'radio':
      if (!side) {
        tv(p,x+7,y+0,'ice',frame);tv(p,x+1,y+7,'ice',frame+1);tv(p,x+13,y+7,'aqua',frame+2);
      } else for (let i=0;i<3;i++) {
        const k=x+3+i*7;
        p.rect(k+3,y+1+i,1,5,'silver');p.rect(k,y+5+i,5,8,'slate');p.rect(k+1,y+6+i,3,2,'mint');
        p.rect(k+1,y+9+i,3,1,'ink');p.rect(k+3,y+11+i,1,1,'orange');
      }
      break;
    case 'crook':
      if (!side) {
        p.rect(x+6,y+1,9,10,'bark');p.rect(x+8,y+2,6,8,'brown');
        p.rect(x+4,y+8,17,5,'brown');p.rect(x+14,y+9,7,5,'tan');
        p.rect(x+6,y+13,12,2,'ink');p.rect(x+5,y+8,2,2,'coral');
      } else {
        p.rect(x+3,y+9,7,6,'grey');p.rect(x+14,y+7,7,8,'grey');
        p.rect(x+4,y+4,5,5,'ice');p.rect(x+15,y+2,5,5,'pink');
        p.rect(x+5,y+4+frame,3,1,'white');p.rect(x+16+frame,y+3,1,2,'cream');
      }
      break;
    case 'games':
      if (!side) {
        p.rect(x+1,y+10,15,4,'grey');p.rect(x+3,y+6,12,4,'silver');p.rect(x+6,y+7,5,1,'ink');
        for(let i=0;i<3;i++) {p.rect(x+17+i*2,y+6+i,3,7,'plum');p.rect(x+17+i*2,y+7+i,2,2,'pink');}
      } else {
        p.rect(x+1,y,10,15,'royal');rocket(p,x+3,y+1);p.rect(x+1,y+13,10,2,'ice');
        tv(p,x+13,y+7,'pink',frame);
      }
      break;
    case 'toys':
      if (!side) for (let i=0;i<2;i++) {
        const k=x+1+i*12;
        p.rect(k+3,y+2,7,3,'bark');p.rect(k+2,y+4,9,2,'brown');p.rect(k+3,y+6,7,4,'tan');
        p.rect(k+4,y+7,1,1,'ink');p.rect(k+8,y+7,1,1,'ink');p.rect(k+6,y+8,1,1,'bark');
        p.rect(k+2,y+10,9,4,'brown');p.rect(k+4,y+10,5,4,'tan');
      } else {
        p.rect(x+2,y+5,8,7,'sky');p.rect(x+3,y+2,6,5,'silver');p.rect(x+4+frame,y+3,2,1,'red');
        p.rect(x+1,y+7,2,5,'grey');p.rect(x+9,y+7,2,5,'grey');p.rect(x+2,y+12,2,2,'silver');
        p.rect(x+8,y+12,2,2,'silver');rocket(p,x+16,y+2);
      }
      break;
    case 'video':
      if (!side) {
        p.rect(x+3,y+2,19,12,'grey');words.forLease.split(' ').forEach((line,i)=>p.center(line,x+12,y+3+i*6,'ink',1,true));
      } else {
        p.rect(x+7,y+1,12,14,'royal');p.center('VHS',x+13,y+4,'silver',1,true);p.rect(x+10,y+11,6,1,'grey');
      }
      break;
    case 'gifts':
      if (!side) {lava(p,x+3,y+1,frame);lava(p,x+14,y+2,(frame+1)%3);}
      else orb(p,x+6,y+1,frame);
      break;
    case 'music':
      if (!side) {
        for (let i=0;i<3;i++) {
          p.rect(x+1+i*6,y+10,5,4,'silver');p.rect(x+2+i*6,y+11,3,2,'ink');
        }
        p.rect(x+12,y+1,11,9,'ink');p.rect(x+14,y+1,7,9,'slate');
        p.rect(x+16,y+4,3,3,'red');p.rect(x+17,y+5,1,1,'cream');
      } else {
        p.rect(x+7,y+3,10,4,'silver');p.rect(x+8,y+4,8,4,'navy');
        p.rect(x+1,y+6,22,8,'grey');p.rect(x+2,y+7,6,6,'ink');p.rect(x+16,y+7,6,6,'ink');
        p.rect(x+3,y+8,4,4,frame%2?'silver':'slate');p.rect(x+17,y+8,4,4,frame%2?'silver':'slate');
        p.rect(x+10,y+9,4,3,'ice');p.rect(x+9,y+7,6,1,'cream');
      }
      break;
    case 'sharper':
      if (!side) {
        const ox=x+3+frame*3;
        p.rect(ox,y+9,12,4,'ink');p.rect(ox+1,y+8,10,4,'silver');p.rect(ox+3,y+7,6,3,'grey');p.rect(ox+7,y+9,2,1,'mint');
      } else orb(p,x+6,y+1,frame,'aqua');
      break;
    case 'food':
      if (!side) {
        p.rect(x+3,y+5,18,9,'aqua');p.rect(x+4,y+7,16,7,'yellow');p.rect(x+4,y+4,16,2,'cream');
        p.rect(x+12,y+1+frame,1,9,'grey');p.rect(x+9,y+1+frame,7,1,'red');
        p.rect(x+6,y+8,4,2,'white');p.rect(x+19,y+10,3,2,'brown');
      } else for(let i=0;i<3;i++) {
        p.line(x+3+i*7,y+14,x+6+i*7,y+3,'tan');p.rect(x+3+i*7,y+3,5,8,'orange');p.rect(x+4+i*7,y+3,2,2,'honey');
      }
      break;
    case 'circuit':
      tv(p,x+1,y+7,'grey',frame,true);tv(p,x+13,y+7,'grey',frame,true);
      for(let j=0;j<6;j+=2) p.rect(x,y+j,25,1,j%4?'slate':'grey');
      break;
    case 'sports':
      if (!side) for(let i=0;i<3;i++) {
        const by=y+3+i*4;p.rect(x+1,by+2,23,1,'brown');
        for(let j=0;j<2;j++) {
          p.rect(x+3+j*11,by-1,4,2,i%2?'ice':'coral');p.rect(x+3+j*11,by+1,8,1,'cream');
        }
      } else {
        shirt(p,x+13,y+1,'violet');
        p.rect(x+1,y+8,8,5,'orange');p.rect(x+2,y+7,6,7,'orange');
        p.rect(x+1,y+10,8,1,'brown');p.rect(x+5,y+7,1,7,'brown');
      }
      break;
    case 'books':
      if (!side) for(let i=0;i<8;i++) {
        p.rect(x+1+i*3,y+4+(i%3),2,9-(i%3),['tan','grey','plum'][i%3]);
      } else {
        p.rect(x+1,y+2,23,12,'brown');p.center('CLOSING',x+12,y+3,'cream',1,true);p.center('SALE',x+12,y+9,'cream',1,true);
      }
      break;
  }
}

export function storefront(p,shop,x,y,age,{cleared=false,sale=false}={}) {
  const shut=shop.role==='closed', power=shop.role==='power';
  const accent=shut?'grey':cleared?'grey':power?'ice':'coral';
  const casing=shut?'slate':power?'blue':'wine';
  p.rect(x-40,y-41,80,41,'ink');
  p.rect(x-39,y-40,78,40,casing);
  p.rect(x-37,y-39,74,10,'ink');
  p.rect(x-36,y-38,72,1,accent);
  p.rect(x-38,y-28,76,2,accent);
  p.center(shop.name,x,y-35,accent,1,true);
  p.rect(x-38,y-25,75,24,'ink');
  for (const side of [0,1]) {
    const sx=x+(side?11:-36);
    p.rect(sx,y-23,25,19,shut?'slate':power?'navy':'plum');
    p.rect(sx,y-23,25,1,power?'sky':'violet');
    display(p,shop.id,side,sx,y-21,Math.floor(age/13)%3);
    p.rect(sx,y-5,25,2,casing);
    p.rect(sx+1,y-22,1,4,'silver');
    p.line(sx+1,y-18,sx+4,y-21,'grey');
    if (cleared || shut) p.alpha(cleared?.66:.34,()=>p.rect(sx,y-23,25,18,'black'));
  }
  p.rect(x-9,y-25,18,25,accent);
  const door=cleared?'slate':power?'royal':Math.floor(age/18)%2?'red':'burgundy';
  p.rect(x-8,y-24,16,24,shut?'grey':door);
  if (shut) for (let i=0;i<22;i+=3) p.rect(x-8,y-24+i,16,1,'slate');
  else {
    p.rect(x-5,y-21,10,11,cleared?'ink':power?'blue':'wine');
    p.rect(x-4,y-20,8,1,accent);
    p.rect(x+3,y-8,3,2,'cream');
  }
  if (sale && !shut) {
    p.rect(x+6,y-15,29,9,'yellow');p.center(words.sale,x+20,y-13,'wine',1,true);
  }
  p.rect(x-40,y-1,80,1,accent);
}
