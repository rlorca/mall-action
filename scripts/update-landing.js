import { readFile, writeFile } from "node:fs/promises";
const path = process.argv[2];
if (!path) throw Error("Usage: node scripts/update-landing.js site/index.html");
let html = await readFile(path, "utf8");
const start = "<!-- BEGIN GPT-6 ASTRA -->",
  end = "<!-- END GPT-6 ASTRA -->";
const card = `${start}
  <section class="card" data-implementation="gpt-6-astra" aria-labelledby="gpt-6-astra-title">
    <h2 id="gpt-6-astra-title">GPT-6 Astra</h2>
    <p class="technology">JavaScript, source-generated pixel art, WebGL CRT and synthesized Web Audio. Branch <code>gpt-6-astra</code>.</p>
    <p class="written">Written <time datetime="2026-10-09">9 Oct 2026</time>. Awaiting independent review.</p>
    <div class="actions"><a class="btn play" href="gpt-6.astra/">Play</a> <a class="btn" href="https://github.com/rlorca/mall-action/tree/gpt-6-astra">Source code</a></div>
  </section>
${end}`;
if (html.includes(start)) {
  html =
    html.slice(0, html.indexOf(start)) +
    card +
    html.slice(html.indexOf(end) + end.length);
} else {
  if (!html.includes("</main>"))
    throw Error("Landing page has no main element; refusing to overwrite it");
  html = html.replace("</main>", card + "\n</main>");
}
await writeFile(path, html);
