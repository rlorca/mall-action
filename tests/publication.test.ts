import { expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

it("publishes a visible game card beside GPT-6, removing the legacy footer link", () => {
  const dir = mkdtempSync(join(tmpdir(), "mall-landing-"));
  try {
    const file = join(dir, "index.html");
    const peer =
      '<section class="card"><h2>GPT-6 Sol</h2><a href="gpt-6.sol/">Play</a></section>';
    const other =
      '<section class="card"><h2>Other game</h2><a href="other/">Play</a></section>';
    writeFileSync(
      file,
      `<body><main>${peer}${other}<footer>Existing footer</footer></main><nav aria-label="GPT-6.1 Sol benchmark"><a href="gpt-6.1-sol/">Old link</a></nav></body>`,
    );
    execFileSync(process.execPath, ["scripts/update-landing.js", file]);
    const first = readFileSync(file, "utf8");
    expect(first).toContain(peer);
    expect(first).toContain(other);
    expect(first).toContain("Existing footer");
    expect(first).not.toContain("Old link");
    expect(first).not.toContain("<nav");
    expect(first).toContain("<h2>GPT-6.1 Sol</h2>");
    expect(first).toContain('class="btn play" href="gpt-6.1-sol/"');
    expect(first.indexOf("<h2>GPT-6.1 Sol")).toBeGreaterThan(
      first.indexOf(peer),
    );
    expect(first.indexOf("<h2>GPT-6.1 Sol")).toBeLessThan(first.indexOf(other));
    execFileSync(process.execPath, ["scripts/update-landing.js", file]);
    expect(readFileSync(file, "utf8")).toBe(first);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
