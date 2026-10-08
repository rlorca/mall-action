// Adds an unreviewed card for this build to the gh-pages landing page, unless it is already there.
// Run inside the gh-pages checkout: node add-landing-card.mjs <publish-dir> <display name>
// reviews/build.mjs keeps unreviewed cards whose link matches "<publish-dir>/", so the card survives rebuilds.
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const [publishDir, displayName] = process.argv.slice(2);
if (!publishDir || !displayName) throw new Error('usage: add-landing-card.mjs <publish-dir> <display name>');
const id = publishDir.replace(/\./g, '-');
const file = new URL('index.html', pathToFileURL(process.cwd() + '/'));
const html = await readFile(file, 'utf8');

if (html.includes(`href="${publishDir}/"`)) {
  console.log(`landing already links ${publishDir}/`);
} else {
  const card = `  <section class="card" data-implementation="${id}" aria-labelledby="${id}-title">
    <h2 id="${id}-title"><span class="rank" aria-label="Not yet reviewed">--</span>${displayName}</h2>
    <p class="technology">Branch <code>${id.replace(/-(\d)/g, '-$1')}</code>. Not yet reviewed.</p>
    <div class="actions">
      <a class="btn play" href="${publishDir}/">Play</a>
      <a class="btn" href="https://github.com/rlorca/mall-action/tree/haiku-5-5">Source code</a>
    </div>
  </section>

`;
  if (!html.includes('  <footer>')) throw new Error('landing page has no footer to insert before');
  await writeFile(file, html.replace('  <footer>', `${card}  <footer>`));
  console.log(`added card for ${publishDir}/`);
}
