import {createGame,step} from './rules.js';
import {Input} from './input.js';
import {fixedStepper} from './loop.js';
import {render,drawCRT,gallery} from './render.js';
import {AudioEngine} from './audio.js';
const canvas=document.getElementById('game'),crtCanvas=document.getElementById('crt');
const ctx=canvas.getContext('2d'),crt=crtCanvas.getContext('2d');
if(!ctx||!crt){document.getElementById('unsupported').hidden=false;document.getElementById('stage').hidden=true;throw Error('Canvas 2D unavailable')}
const params=new URLSearchParams(location.search),debug=params.get('debug')==='1',galleryMode=params.get('gallery')==='1';
let state=createGame(params.has('seed')?Number(params.get('seed')):Date.now(),debug),crtOn=localStorage.getItem('mall-action-crt')!=='off',toast='',toastFrames=0;
const audio=new AudioEngine();
function special(key){audio.start();if(key==='c'){crtOn=!crtOn;localStorage.setItem('mall-action-crt',crtOn?'on':'off');toast=crtOn?'CRT ON':'CRT OFF'}else{toast=audio.toggle()?'SOUND OFF':'SOUND ON'}toastFrames=100}
const input=new Input(special);
window.addEventListener('pointerdown',()=>audio.start(),{passive:true});
function update(){const pad=input.frame();if(Object.values(pad.pressed).some(Boolean))audio.start();if(!galleryMode){state=step(state,pad);for(const e of state.events)audio.event(e);audio.music(state)}else state.frame++;if(toastFrames>0)toastFrames--}
function paint(){if(galleryMode)gallery(ctx,state.frame);else render(ctx,state,{toast:toastFrames?toast:''});drawCRT(crt,crtOn,state.frame)}
const tick=fixedStepper(update,paint);function frame(t){tick(t);requestAnimationFrame(frame)}requestAnimationFrame(frame);
function resize(){const scale=Math.max(1,Math.floor(Math.min(innerWidth/256,innerHeight/240)));document.getElementById('stage').style.setProperty('--scale',scale)}addEventListener('resize',resize);resize();
if(debug)window.mallAction={get state(){return state},set state(v){state=v},step(n=1,buttons={}){for(let i=0;i<n;i++){const held=Array.isArray(buttons)?Object.fromEntries(buttons.map(b=>[b,true])):buttons;state=step(state,{held,pressed:i===0?held:{}})}paint();return state},get crt(){return crtOn}};
