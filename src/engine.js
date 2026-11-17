import {floorAnnouncements,floorNames,words} from './copy.js';
import {floors} from './data.js';
import {buttons,konami,konamiStep,padMask} from './input.js';
import {tickMall,tickSchedule} from './mall.js';
import {announce,finishDeath,newLevel,respawn,setScene,sound,tickTimed} from './rules.js';
import {JINGLE_FRAME,SPLASH_FRAMES} from './splash/index.js';
import {tickStore,tickTransition} from './store.js';

export function createGame({seed=1986,debug=false,crt=true,muted=false,high=0}={}) {
  return {
    scene:debug?'title':'splash',age:0,frame:0,rng:seed>>>0,seed:seed>>>0,score:0,high,crt,muted,
    progress:0,blackFriday:false,loop:1,lives:3,continues:3,extraLife:false,inventory:[],
    visited:[],photo:false,toast:null,events:[],overlay:null,transition:null
  };
}
function startGame(state) {
  Object.assign(state,{score:0,loop:1,lives:3,continues:3,extraLife:false,inventory:[],visited:[],photo:false});
  newLevel(state);
}
function title(state,input) {
  for (const bit of input.order ?? Object.values(buttons).filter(bit=>input.pressed&bit)) {
    if (!(bit & padMask) || bit===buttons.start) continue;
    state.progress = konamiStep(state.progress,bit);
    if (state.progress===konami.length) {
      state.blackFriday = true;
      state.progress = 0;
      sound(state,'item');
    }
  }
  if (input.pressed & buttons.start) startGame(state);
}
function arrival(state,input) {
  const p = state.player;
  if (state.age<=58) {
    const t = state.age/58;
    p.x = 21+83*t;
    p.y = 38+32*t;
  } else {
    p.y = Math.min(floors[0],70+(state.age-58)*1.35);
    if (state.age===65) sound(state,'land');
    if (state.age===86) sound(state,'photo');
  }
  if (state.age>=89 && (state.age>=238 || input.pressed & padMask)) {
    p.x = 105;
    p.y = floors[0];
    setScene(state,'mall');
    announce(state, floorNames[0] + ' - ' + floorAnnouncements[0],85);
  }
}
function clear(state,input) {
  const times = [335,255,230];
  if (state.age<times[state.result.section] && !(input.pressed & buttons.start)) return;
  if (state.result.section<2) {
    state.result.section++;
    state.age = 0;
    sound(state,state.result.section===1?'paper':'photo');
  } else {
    state.loop++;
    newLevel(state);
  }
}
function continueGame(state,input) {
  if (input.pressed & buttons.start) {
    state.continues--;
    state.lives = 3;
    respawn(state,true);
    state.transition = null;
    setScene(state,state.room?'store':'mall');
    sound(state,'item');
  } else if (state.age>=540) {
    setScene(state,'over');
    sound(state,'gameover');
  } else if (state.age%60===0) sound(state,'tick');
}
function play(state,input) {
  const {start,select} = buttons;
  if (input.pressed & select && state.overlay!=='pause') {
    state.overlay = state.overlay==='map'?null:'map';
    sound(state,'pause');
    return;
  }
  if (input.pressed & start) {
    state.overlay = state.overlay?null:'pause';
    sound(state,'pause');
    return;
  }
  if (state.overlay) return;
  tickTimed(state);
  if (state.player.death && --state.player.death===0) {
    finishDeath(state);
    return;
  }
  state.elapsed++;
  tickSchedule(state);
  if (state.transition) tickTransition(state);
  else if (state.scene==='mall') tickMall(state,input);
  else tickStore(state,input);
}

export function step(previous,input={held:0,pressed:0}) {
  const state = structuredClone(previous);
  state.events = [];
  state.age++;
  state.frame++;
  if (state.toast && --state.toast.left===0) state.toast = null;
  if (input.pressed & buttons.crt) {
    state.crt = !state.crt;
    state.toast = {text:state.crt?'CRT ON':'CRT OFF',left:90};
  }
  if (input.pressed & buttons.mute) {
    state.muted = !state.muted;
    state.toast = {text:state.muted?'SOUND OFF':'SOUND ON',left:90};
  }
  switch (state.scene) {
    case 'splash':
      if (input.pressed & padMask || state.age>=SPLASH_FRAMES) setScene(state,'title');
      else if (state.age===JINGLE_FRAME) sound(state,'studio');
      break;
    case 'title': title(state,input); break;
    case 'arrival': arrival(state,input); break;
    case 'mall':
    case 'store': play(state,input); break;
    case 'clear': clear(state,input); break;
    case 'continue': continueGame(state,input); break;
    case 'over':
      if (state.age===1) sound(state,'pa');
      if (state.age<=106 && state.age%5===0) sound(state,'text');
      if (state.age>400 || state.age>180 && input.pressed & buttons.start) {
        state.blackFriday = false;
        state.progress = 0;
        setScene(state,'title');
      }
      break;
  }
  return state;
}

export function musicFor(state) {
  if (state.scene==='title') return 'title';
  if (state.scene==='store') return state.room.sideB?'sideB':state.room.id;
  if (state.scene==='mall' || state.scene==='arrival') {
    if (state.player.ride!==null || state.player.roof!==null) return 'elevator';
    return state.alarm?'alarm':'mall';
  }
  return null;
}
