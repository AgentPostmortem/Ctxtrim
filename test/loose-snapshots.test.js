import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/classify.js";
import { scanRepo } from "../src/scan.js";

test("loose snapshot files are generated trim candidates", () => {
  for (const name of ["a.snap", "nested/result.SNAP"]) {
    const result = classify(name, { tokens: 10, sample: "expected output" });
    assert.equal(result.category, "generated", name);
    assert.equal(result.trim, true, name);
    assert.equal(result.binary, false, name);
  }
  assert.equal(classify("test/__snapshots__/a.snap", {}).category, "build");
  assert.equal(classify("src/snapshot.js", { tokens: 10 }).trim, false);
});

test("scan includes loose snapshots in token totals and ignore patterns", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-loose-snap-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "test"));
  writeFileSync(join(root, "test", "result.snap"), "expected output\n".repeat(20));
  writeFileSync(join(root, "source.js"), "export const value = 1;\n");
  const result = scanRepo(root);
  const snapshot = result.files.find((file) => file.rel === "test/result.snap");
  assert.equal(snapshot.category, "generated");
  assert.ok(snapshot.tokens > 0);
  assert.equal(result.totals.trimTokens, snapshot.tokens);
  assert.deepEqual(result.patterns, ["test/result.snap"]);
});
