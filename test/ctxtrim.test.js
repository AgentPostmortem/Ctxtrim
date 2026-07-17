import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scanRepo, estimateTokens } from "../src/scan.js";
import { classify } from "../src/classify.js";
import { merge, block } from "../src/ignore.js";

const repo = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "sample-repo");

test("token estimate is ~chars/4", () => {
  assert.equal(estimateTokens("aaaaaaaa"), 2); // 8 chars
  assert.equal(estimateTokens(""), 0);
});

test("classify buckets files correctly", () => {
  assert.equal(classify("package-lock.json", {}).category, "lockfile");
  assert.equal(classify("node_modules/x/index.js", {}).category, "vendored");
  assert.equal(classify("dist/app.js", {}).category, "build");
  assert.equal(classify("app.min.js", {}).category, "minified");
  assert.equal(classify("data/x.csv", {}).category, "data");
  assert.equal(classify("logo.png", {}).binary, true);
  assert.equal(classify("src/index.js", { tokens: 50 }).category, "source");
  assert.equal(classify("src/index.js", { tokens: 50 }).trim, false);
  // big json flagged as data
  assert.equal(classify("big.json", { tokens: 9000, maxTokens: 2000 }).category, "data");
});

