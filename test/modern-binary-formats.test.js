import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, classifyPath } from "../src/classify.js";
import { scanRepo } from "../src/scan.js";

const extensions = ["avif", "heic", "heif", "apng", "webm", "ogg", "flac", "m4a"];

test("modern image, video and audio formats are binary regardless of case", () => {
  for (const extension of extensions) {
    for (const ext of [extension, extension.toUpperCase()]) {
      const name = `media/asset.${ext}`;
      const result = classify(name, { tokens: 100 });
      assert.equal(result.category, "binary", name);
      assert.equal(result.trim, true, name);
      assert.equal(result.binary, true, name);
      assert.deepEqual(classifyPath(name), result);
    }
  }
  assert.equal(classify("src/audio.js", { tokens: 100 }).trim, false);
});

test("scan never reads modern binary media or counts it as text tokens", (t) => {
  const root = fs.mkdtempSync(join(tmpdir(), "ctxtrim-modern-media-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const names = extensions.map((ext) => `asset.${ext}`);
  for (const name of names) fs.writeFileSync(join(root, name), Buffer.from([0xff, 0x00, 0xfe]));
  // Exercise both the full-read and partial-read paths if classification regresses.
  fs.truncateSync(join(root, "asset.webm"), 5_000_001);
  fs.writeFileSync(join(root, "source.js"), "export const value = 1;\n");
  const reads = [];
  for (const method of ["readFileSync", "openSync"]) {
    const original = fs[method];
    t.mock.method(fs, method, (...args) => {
      reads.push(String(args[0]));
      return original(...args);
    });
  }
  syncBuiltinESMExports();
  let result;
  try { result = scanRepo(root); }
  finally { t.mock.restoreAll(); syncBuiltinESMExports(); }

  for (const name of names) {
    assert.equal(reads.includes(join(root, name)), false, name);
    const file = result.files.find((entry) => entry.rel === name);
    assert.equal(file.category, "binary", name);
    assert.equal(file.tokens, 0, name);
    assert.equal(file.trim, true, name);
    assert.ok(result.patterns.includes(name));
  }
  assert.equal(result.totals.textFiles, 1);
  assert.equal(result.totals.totalTokens, result.files.find((file) => file.rel === "source.js").tokens);
});
