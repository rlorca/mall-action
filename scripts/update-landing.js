// Publication metadata only. Other implementations' links and files are preserved.
import { readFileSync, writeFileSync } from "node:fs";
const file = process.argv[2],
  label = "GPT-6.1 Sol",
  href = "gpt-6.1-sol/";
let html = readFileSync(file, "utf8");
if (!html.includes(href)) {
  const item = `<li><a href="${href}">${label} — play MALL ACTION</a></li>`;
  if (html.includes("</ul>")) html = html.replace("</ul>", `${item}\n</ul>`);
  else
    html = html.replace(
      "</body>",
      `<nav aria-label="GPT-6.1 Sol benchmark"><a href="${href}">${label} — play MALL ACTION</a></nav>\n</body>`,
    );
  writeFileSync(file, html);
}
