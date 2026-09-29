// Update only this implementation's metadata; preserve every other game card.
import { readFileSync, writeFileSync } from "node:fs";
const file = process.argv[2];
let html = readFileSync(file, "utf8");
const href = "gpt-6.1-sol/";
// Remove the original fallback link and any existing card so republishing is idempotent.
html = html.replace(
  /\s*<nav aria-label="GPT-6\.1 Sol benchmark">[\s\S]*?<\/nav>/g,
  "",
);
html = html.replace(
  /\s*<section\b[^>]*class="card"[^>]*>[\s\S]*?<\/section>/g,
  (card) => (card.includes(`href="${href}"`) ? "" : card),
);
const card = `

  <section class="card">
    <h2>GPT-6.1 Sol</h2>
    <p>TypeScript + Vite, Canvas 2D &amp; WebGL CRT shader, Web Audio synth. Branch <code>gpt-6-1-sol</code>.</p>
    <div class="actions">
      <a class="btn play" href="${href}">Play</a>
      <a class="btn" href="https://github.com/rlorca/mall-action/tree/gpt-6-1-sol">Source code</a>
    </div>
  </section>`;
const peer = [
  ...html.matchAll(/<section\b[^>]*class="card"[^>]*>[\s\S]*?<\/section>/g),
].find((match) => match[0].includes('href="gpt-6.sol/"'));
if (peer) {
  const end = peer.index + peer[0].length;
  html = html.slice(0, end) + card + html.slice(end);
} else if (html.includes("<footer>")) {
  html = html.replace("<footer>", card + "\n\n  <footer>");
} else {
  throw new Error(
    "Landing page has no game-card insertion point; refusing to append a hidden link.",
  );
}
writeFileSync(file, html);
