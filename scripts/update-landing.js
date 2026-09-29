import {readFile,writeFile} from 'node:fs/promises';
const path=process.argv[2];
let html=await readFile(path,'utf8');
if(!html.includes('gpt-6.sol/')){
 const card=`\n  <section class="card">\n    <h2>GPT-6 Sol</h2>\n    <p>JavaScript Canvas 2D and Web Audio. Branch <code>gpt-6-sol</code>.</p>\n    <div class="actions">\n      <a class="btn play" href="gpt-6.sol/">Play</a>\n      <a class="btn" href="https://github.com/rlorca/mall-action/tree/gpt-6-sol">Source code</a>\n    </div>\n  </section>\n`;
 html=html.replace('  <footer>',card+'\n  <footer>');
 await writeFile(path,html);
}
