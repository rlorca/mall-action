import {floors} from '../src/data.js';
import {createGame,step} from '../src/engine.js';
import {buttons} from '../src/input.js';
import {enterStore} from '../src/store.js';

export function frame(state,held=0,pressed=held) {
  return step(state,{held,pressed});
}
export function frames(state,count,held=0,pressed=0) {
  for (let i=0;i<count;i++) state=frame(state,held,i===0?pressed:0);
  return state;
}
export function game(seed=1986) {
  const s=frames(frame(createGame({seed,debug:true}),buttons.start),238);
  s.elapsed=0;
  return s;
}
export function position(s,floor,x) {
  Object.assign(s.player,{floor,x,y:floors[floor],ride:null,roof:null,air:false,stairs:null,
    fallFrom:null,kick:false,vy:0,safe:{floor,x}});
  return s;
}
export function store(s,id) {
  enterStore(s,id);
  s.scene='store';
  s.room.visit=0;
  return s;
}
