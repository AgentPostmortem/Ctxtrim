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

test("scan finds trimmable bloat and keeps source", () => {
  const s = scanRepo(repo);
  assert.ok(s.totals.trimTokens > 0);
  assert.ok(s.totals.wastePct > 50, `expected mostly-junk fixture, got ${s.totals.wastePct}%`);
  // the three bloat files are flagged
  const trimmed = new Set(s.files.filter((f) => f.trim).map((f) => f.rel));
  assert.ok(trimmed.has("package-lock.json"));
  assert.ok(trimmed.has("data/seed.json"));
  assert.ok([...trimmed].some((p) => p.startsWith("dist/")));
  // real source is NOT trimmed
  const src = s.files.find((f) => f.rel === "src/index.js");
  assert.equal(src.trim, false);
  // patterns collapse the build dir
  assert.ok(s.patterns.includes("dist/"));
  assert.ok(s.patterns.includes("package-lock.json"));
});

test("ignore block is idempotent (managed block replaced, user lines kept)", () => {
  const patterns = ["dist/", "package-lock.json"];
  const first = merge("# my own rule\n*.log\n", patterns);
  assert.ok(first.includes("# my own rule"));
  assert.ok(first.includes(block(patterns)));
  // re-running with new patterns replaces only the managed block, keeps user lines once
  const second = merge(first, ["dist/", "coverage/"]);
  assert.ok(second.includes("# my own rule"));
  assert.ok(second.includes("coverage/"));
  assert.equal((second.match(/ctxtrim \(managed\)/g) || []).length, 2); // one start, one end
  assert.ok(!second.includes("package-lock.json"), "old managed pattern should be gone");
});

test("clean repo (only source) reports nothing to trim", () => {
  // scanning the src subdir alone = only source
  const s = scanRepo(join(repo, "src"));
  assert.equal(s.totals.trimTokens, 0);
});
