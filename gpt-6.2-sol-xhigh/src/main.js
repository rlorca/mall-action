import {createSound} from './audio.js';
import {createClock} from './clock.js';
import {H,W} from './data.js';
import {drawGame} from './draw.js';
import {createGame,musicFor,step} from './engine.js';
import {createInput,mask} from './input.js';
import {makePixel} from './pixel.js';
import {createVideo} from './video.js';

const params=new URLSearchParams(window.location.search);
const debug=params.get('debug')==='1';
const gallery=params.get('gallery')==='1';
const seed=Number(params.get('seed')??1986);
const output=document.querySelector('#game');
const source=document.createElement('canvas');
source.width=W;source.height=H;
let context, video;
try {
  context=source.getContext('2d',{alpha:false});
  video=context&&createVideo(output,source);
} catch {
  video=null;
}

function option(name,value) {
  try {return localStorage.getItem('mall-action:'+name)??value;} catch {return value;}
}
function save(name,value) {
  try {localStorage.setItem('mall-action:'+name,value);} catch {}
}

if (video) run();
else {
  output.hidden=true;
  document.querySelector('#failure').hidden=false;
}

function run() {
  context.imageSmoothingEnabled=false;
  const pixels=makePixel(context), input=createInput(), audio=createSound();
  let state=createGame({
    seed:Number.isFinite(seed)?seed:1986,debug,crt:option('crt','on')==='on',muted:option('sound','on')==='off'
  });
  let effects=[],suspended=false,debugHeld=0,paintedFrame=-1;

  function simulate(pad,{unlock=true}={}) {
    if (unlock && !audio.active() && pad.pressed) audio.unlock();
    const last=state;
    state=step(state,pad);
    if (state.crt!==last.crt) save('crt',state.crt?'on':'off');
    if (state.muted!==last.muted) save('sound',state.muted?'off':'on');
    effects.push(...state.events);
  }
  function draw() {
    if (paintedFrame!==state.frame) {
      drawGame(pixels,state,{showGallery:gallery});
      video.present(state.crt,state.frame);
      paintedFrame=state.frame;
    }
    audio.update(state,gallery?null:musicFor(state),effects);
    effects=[];
  }
  const clock=createClock(()=>{if (!suspended) simulate(input.next());},draw);
  const resize=()=>video.resize(window.innerWidth,window.innerHeight);

  window.addEventListener('resize',resize);
  window.addEventListener('keydown',event=>{
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (input.keyDown(event)) event.preventDefault();
    if (event.isTrusted) audio.unlock();
  });
  window.addEventListener('keyup',event=>{if (input.keyUp(event)) event.preventDefault();});
  window.addEventListener('pointerdown',()=>audio.unlock());
  window.addEventListener('blur',()=>input.clear());
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) input.clear();
    clock.reset();
  });
  function raf(now) {
    if (!suspended) {
      try {input.gamepads(navigator.getGamepads?.()??[]);} catch {}
    }
    clock.frame(now);
    requestAnimationFrame(raf);
  }
  if (debug) {
    const controller = {
      get state() {return state;},
      get context() {return state;},
      suspend(value=true) {
        suspended=value;
        debugHeld=0;
        effects=[];
        input.clear();
        clock.reset();
      },
      step(frames=1,held=0) {
        const next=mask(held);
        for (let i=0;i<frames;i++) {
          simulate({held:next,pressed:next & ~debugHeld},{unlock:false});
          debugHeld=next;
        }
        paintedFrame=-1;
        draw();
        return state;
      }
    };
    window.__mallAction=controller;
    window.stepGame=(frames,held)=>controller.step(frames,held);
  }
  resize();
  draw();
  requestAnimationFrame(raf);
}
