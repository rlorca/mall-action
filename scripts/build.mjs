import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync} from 'node:fs';
execFileSync(process.env.CARGO || 'cargo',['build','--release','--target','wasm32-unknown-unknown'],{stdio:'inherit'});
mkdirSync('dist',{recursive:true});
for(const f of ['index.html','browser.js','audio.js']) copyFileSync(f,`dist/${f}`);
copyFileSync('target/wasm32-unknown-unknown/release/mall_action.wasm','dist/mall_action.wasm');
