import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
execFileSync(process.env.CARGO || 'cargo',['build','--release','--target','wasm32-unknown-unknown'],{stdio:'inherit'});
const wasm=readFileSync('target/wasm32-unknown-unknown/release/mall_action.wasm');
const files=['browser.js','audio.js','score.js','synth.js','synth-worklet.js'];
const sources=Object.fromEntries(files.map(f=>[f,readFileSync(f,'utf8')]));
const html=readFileSync('index.html','utf8');
const digest=createHash('sha256').update(wasm).update(html);for(const source of Object.values(sources))digest.update(source);
const hash=digest.digest('hex').slice(0,12);
rmSync('dist',{recursive:true,force:true});mkdirSync('dist',{recursive:true});
writeFileSync(`dist/mall_action.${hash}.wasm`,wasm);
for(const [name,source]of Object.entries(sources)){
 let output=source;for(const file of [...files,'mall_action.wasm']){const dot=file.lastIndexOf('.');output=output.replaceAll('./'+file,'./'+file.slice(0,dot)+'.'+hash+file.slice(dot));}
 const dot=name.lastIndexOf('.');writeFileSync('dist/'+name.slice(0,dot)+'.'+hash+name.slice(dot),output);
}
writeFileSync('dist/index.html',html.replace('./browser.js',`./browser.${hash}.js`));
console.log(`Static build: dist/ (${hash})`);
