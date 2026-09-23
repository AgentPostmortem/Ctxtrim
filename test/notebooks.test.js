import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../src/classify.js";
import { scanRepo } from "../src/scan.js";

test("notebooks are data trim candidates below the large-data threshold", () => {
  for (const name of ["analysis.ipynb", "analysis.IPYNB"]) {
    const result = classify(name, { tokens: 1510, maxTokens: 2000 });
    assert.equal(result.category, "data", name);
    assert.equal(result.trim, true, name);
    assert.equal(result.binary, false, name);
  }
  assert.equal(classify("analysis.py", { tokens: 1510 }).trim, false);
});

test("scan accounts for output-heavy notebooks and suggests their ignore pattern", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-notebook-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const notebook = {
    cells: [{ cell_type: "code", execution_count: 1, metadata: {}, source: ["print('x')"],
      outputs: [{ output_type: "stream", name: "stdout", text: ["x".repeat(6000)] }] }],
    metadata: {}, nbformat: 4, nbformat_minor: 5,
  };
  writeFileSync(join(root, "analysis.ipynb"), JSON.stringify(notebook));
  writeFileSync(join(root, "analysis.py"), "print('x')\n");
  const result = scanRepo(root);
  const file = result.files.find((entry) => entry.rel === "analysis.ipynb");
  assert.ok(file.tokens > 1500 && file.tokens < 2000);
  assert.equal(file.category, "data");
  assert.equal(file.trim, true);
  assert.equal(result.totals.trimTokens, file.tokens);
  assert.deepEqual(result.patterns, ["analysis.ipynb"]);
  assert.equal(result.files.find((entry) => entry.rel === "analysis.py").trim, false);
});
