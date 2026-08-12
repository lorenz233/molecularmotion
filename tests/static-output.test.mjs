import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build creates a GitHub Pages entry point", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /<script type="module"[^>]+src="(?:\/molecularmotion)?\/assets\//);
});
