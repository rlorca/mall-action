// Real-time Chromium/CDP playtest. Start Vite on :4173 and Chromium with
// --remote-debugging-port=9222, then run `node scripts/browser-playtest.mjs`.
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.MALL_URL || "http://127.0.0.1:4173";
const targets = await fetch("http://127.0.0.1:9222/json").then((r) => r.json());
const target = targets.find((item) => item.type === "page");
if (!target) throw new Error("No Chromium page target");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id) { const handler = pending.get(message.id); if (handler) { pending.delete(message.id); message.error ? handler.reject(message.error) : handler.resolve(message.result); } }
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") errors.push(message.params.entry.text);
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(JSON.stringify(message.params.args));
};
function send(method, params = {}) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); ws.send(JSON.stringify({ id: next, method, params })); }); }
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function evaluate(expression) { const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; }
async function key(key, code = key, ms = 70) {
  const virtualKey = key === "Enter" ? 13 : key === "Shift" ? 16 : key.startsWith("Arrow") ? { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39 }[key] : key.toUpperCase().charCodeAt(0);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: virtualKey });
  await wait(ms); await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: virtualKey });
}
async function shot(name) {
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(`screenshots/${name}.png`, Buffer.from(result.data, "base64"));
}
async function assert(expression, label) { const value = await evaluate(expression); if (!value) throw new Error(`Playtest assertion failed: ${label}`); console.log(`PASS ${label}`); }

await mkdir("screenshots", { recursive: true });
await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 960, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${base}/?seed=42` }); await wait(500); await shot("splash");
await send("Page.navigate", { url: `${base}/?debug=1&seed=42` }); await wait(1200);
await assert("!!globalThis.mallAction", "debug context available");
await assert("document.querySelector('#crt').classList.contains('off') === false", "CRT is on by default");
await shot("title");
await key("c", "KeyC"); await assert("document.querySelector('#crt').classList.contains('off')", "C toggles CRT off");
await key("c", "KeyC"); await assert("!document.querySelector('#crt').classList.contains('off')", "C restores CRT");
await key("m", "KeyM"); await assert("mallAction.audio.muted", "M mutes audio"); await key("m", "KeyM");
await key("Enter", "Enter"); await wait(1100); await shot("arrival");
await wait(1600); await shot("spygram");
await wait(2700); await assert("mallAction.state.screen === 'mall'", "splash/title/arrival reaches mall in real time");

// Elevator A: board and drive from R to 4F using actual key events.
await evaluate("Object.assign(mallAction.state.player,{x:690,floor:'R',y:32,riding:null}); mallAction.state.elevators[0].y=56; mallAction.state.elevators[0].moving=false");
await key("ArrowDown", "ArrowDown"); await wait(150); await assert("mallAction.state.player.riding === 'A'", "board elevator");
await key("ArrowDown", "ArrowDown", 1050); await wait(250); await assert("mallAction.state.player.floor === '4F'", "ride elevator to 4F");
await key("ArrowRight", "ArrowRight"); await wait(150);

// Escalator from 3F to 4F.
await evaluate("Object.assign(mallAction.state.player,{x:442,floor:'3F',y:128,riding:null,escalator:null,grounded:true})");
await key("ArrowUp", "ArrowUp"); await wait(1450); await assert("mallAction.state.player.floor === '4F' && !mallAction.state.player.escalator", "ride escalator");

// Shoot a spy and then a lamp in real time.
await evaluate("Object.assign(mallAction.state.player,{x:90,floor:'4F',y:80,grounded:true,ducking:false}); mallAction.state.spies=[]; mallAction.game.spawnSpy('4F',122); mallAction.state.spies[0].cooldown=999");
await key("z", "KeyZ"); await wait(500); await assert("mallAction.state.score >= 100", "shoot spy");
await key("z", "KeyZ"); await wait(400); await assert("mallAction.state.lamps.some(l => l.floor === '4F' && l.state !== 'hanging')", "shoot hanging lamp");
await shot("mall");

// Enter Forever 12, search its package, and leave through the door.
await evaluate("Object.assign(mallAction.state.player,{x:66,floor:'4F',y:80,grounded:true,riding:null}); mallAction.state.spies=[]; mallAction.state.enemyBullets=[]");
await key("ArrowUp", "ArrowUp"); await wait(350); await assert("mallAction.state.currentStore === 'forever' && mallAction.state.screen === 'store'", "enter store");
await evaluate("const r=mallAction.state.stores.forever,f=r.fixtures.find(f=>f.content==='package');f.isFitting=false;r.guards=[];r.lineTime=0;Object.assign(mallAction.state.player,{x:f.x+16,y:f.y,freeze:0});");
await shot("store");
await key("x", "KeyX"); await wait(1000); await assert("mallAction.state.packages === 1", "single-tap search finds package");
await evaluate("Object.assign(mallAction.state.player,{x:122,y:158});"); await key("ArrowDown", "ArrowDown"); await wait(250); await assert("mallAction.state.screen === 'mall'", "leave store");

await key("Shift", "ShiftLeft"); await wait(200); await assert("mallAction.state.screen === 'map'", "open directory"); await shot("map"); await key("Shift", "ShiftLeft");
await key("Enter", "Enter"); await wait(150); await assert("mallAction.state.screen === 'pause'", "pause overlay"); await key("Enter", "Enter");

// Exit, tally, newspaper and completion post.
await evaluate("Object.assign(mallAction.state,{packages:6,screen:'mall'});Object.assign(mallAction.state.player,{x:384,floor:'P',y:272,riding:null,grounded:true});");
await key("ArrowUp", "ArrowUp"); await wait(300); await assert("mallAction.state.screen === 'clear'", "six packages trigger level clear"); await shot("level-clear");
await key("Enter", "Enter"); await wait(200); await shot("newspaper"); await key("Enter", "Enter"); await wait(200); await assert("mallAction.state.clear.phase === 'post'", "mission-complete SPYGRAM");

// Continue and game-over paths.
await evaluate("mallAction.game.startLevel(1);Object.assign(mallAction.state,{screen:'mall',lives:1,continues:3});mallAction.game.killPlayer('TEST');");
await wait(200); await assert("mallAction.state.screen === 'continue'", "continue screen"); await shot("continue"); await key("Enter", "Enter"); await wait(200); await assert("mallAction.state.lives === 3 && mallAction.state.continues === 2", "continue grants three lives");
await evaluate("Object.assign(mallAction.state,{lives:1,continues:0,screen:'mall',invulnerability:0});mallAction.game.killPlayer('TEST');"); await wait(3600); await shot("game-over");
await assert("mallAction.state.screen === 'gameover'", "game-over screen");
await send("Page.navigate", { url: `${base}/?gallery=1&seed=42` }); await wait(400);
await assert("document.querySelector('canvas') && location.search.includes('gallery=1')", "sprite gallery opens"); await shot("gallery");

console.log(JSON.stringify({ errors, screenshots: 12 }, null, 2));
ws.close();
if (errors.length) process.exitCode = 1;
