import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/scan.js";
import { jsonReport, textReport } from "../src/report.js";

const cli = fileURLToPath(new URL("../bin/ctxtrim.js", import.meta.url));

function fixture(t) {
  const dir = fs.mkdtempSync(join(tmpdir(), "ctxtrim-links-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, "repo");
  fs.mkdirSync(root);
  return { dir, root };
}

function recordReads(t, run) {
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
  try { result = run(); }
  finally { t.mock.restoreAll(); syncBuiltinESMExports(); }
  return { reads, result };
}

test("aliases and link chains count a target once under its real name and category", (t) => {
  const { root } = fixture(t);
  fs.mkdirSync(join(root, "src"));
  fs.writeFileSync(join(root, "src", "real.js"), "x".repeat(400));
  fs.writeFileSync(join(root, "pixel.png"), "binary content");
  fs.symlinkSync("src/real.js", join(root, "a-alias.png"));
  fs.symlinkSync("a-alias.png", join(root, "b-chain.js"));
  fs.symlinkSync("pixel.png", join(root, "c-image.js"));
  const { reads, result } = recordReads(t, () => scanRepo(root));

  assert.deepEqual(result.files.map((f) => f.rel).sort(), ["pixel.png", "src/real.js"]);
  assert.equal(result.totals.totalTokens, 100);
  assert.equal(result.totals.textFiles, 1);
  assert.equal(result.files.find((f) => f.rel === "src/real.js").category, "source");
  assert.deepEqual(result.patterns, ["pixel.png"]);
  assert.deepEqual(reads, [join(root, "src", "real.js")]);
  assert.deepEqual(result.warnings, []);
});

test("aliases cannot bypass git exclusion or double-count grouped build and vendor files", (t) => {
  const { root } = fixture(t);
  for (const dir of [".git", "dist", "node_modules"]) {
    fs.mkdirSync(join(root, dir));
    fs.writeFileSync(join(root, dir, "file.js"), "x".repeat(400));
    fs.symlinkSync(`${dir}/file.js`, join(root, `${dir}-alias.js`));
  }
  fs.writeFileSync(join(root, "source.js"), "x".repeat(40));
  fs.symlinkSync("../source.js", join(root, "dist", "source-alias.js"));
  const { reads, result } = recordReads(t, () => scanRepo(root));

  assert.deepEqual(result.files.map((f) => f.rel).sort(), ["dist", "node_modules", "source.js"]);
  assert.equal(result.totals.totalTokens, 210);
  assert.equal(result.totals.trimTokens, 200);
  assert.deepEqual(result.patterns, ["dist/", "node_modules/"]);
  assert.deepEqual(reads, [join(root, "source.js")]);
});

test("broken links and symlink loops produce warnings without file entries", (t) => {
  const { root } = fixture(t);
  fs.symlinkSync("missing.js", join(root, "broken.js"));
  fs.symlinkSync("loop.js", join(root, "loop.js"));
  const result = scanRepo(root);

  assert.equal(result.totals.files, 0);
  assert.equal(result.totals.totalTokens, 0);
  assert.deepEqual(result.warnings.map((w) => w.path).sort(), ["broken.js", "loop.js"]);
  for (const warning of result.warnings) assert.match(warning.reason, /cannot resolve symlink/);
});

test("outside-root files and directories are warned about and never read", (t) => {
  const { dir, root } = fixture(t);
  // A shared prefix must not be confused with containment.
  const outside = join(dir, "repo-other");
  fs.mkdirSync(outside);
  fs.writeFileSync(join(outside, "small.js"), "x".repeat(8000));
  fs.writeFileSync(join(outside, "large.js"), "");
  fs.truncateSync(join(outside, "large.js"), 5_000_001);
  fs.symlinkSync("../repo-other/small.js", join(root, "outside.js"));
  fs.symlinkSync(join(outside, "large.js"), join(root, "large.js"));
  fs.symlinkSync(outside, join(root, "outside-dir"), "dir");
  const { reads, result } = recordReads(t, () => scanRepo(root));

  assert.deepEqual(reads, []);
  assert.deepEqual(result.files, []);
  assert.equal(result.totals.totalTokens, 0);
  assert.deepEqual(result.warnings.map((w) => w.path).sort(), ["large.js", "outside-dir", "outside.js"]);
  for (const warning of result.warnings) assert.equal(warning.reason, "symlink target is outside the scan root");
});

test("directory aliases and links to the root are not traversed", (t) => {
  const { root } = fixture(t);
  fs.mkdirSync(join(root, "src"));
  fs.writeFileSync(join(root, "src", "real.js"), "x".repeat(400));
  fs.symlinkSync("src", join(root, "alias-dir"), "dir");
  fs.symlinkSync("..", join(root, "src", "parent"), "dir");
  fs.symlinkSync(".", join(root, "self"), "dir");
  const result = scanRepo(root);

  assert.deepEqual(result.files.map((f) => f.rel), ["src/real.js"]);
  assert.equal(result.totals.totalTokens, 100);
  assert.deepEqual(result.warnings, []);
});

test("broken and outside links in grouped directories also produce warnings", (t) => {
  const { dir, root } = fixture(t);
  fs.mkdirSync(join(root, "dist", "nested"), { recursive: true });
  fs.writeFileSync(join(root, "dist", "real.js"), "x".repeat(400));
  fs.writeFileSync(join(dir, "outside.js"), "x".repeat(8000));
  fs.symlinkSync("missing.js", join(root, "dist", "nested", "broken.js"));
  fs.symlinkSync("../../../outside.js", join(root, "dist", "nested", "outside.js"));
  const { reads, result } = recordReads(t, () => scanRepo(root));

  assert.deepEqual(reads, []);
  assert.equal(result.totals.totalTokens, 100);
  assert.deepEqual(result.warnings.map((w) => w.path).sort(), ["dist/nested/broken.js", "dist/nested/outside.js"]);
});

test("relative and symlinked scan roots use the resolved root boundary", (t) => {
  const { dir, root } = fixture(t);
  fs.writeFileSync(join(root, "real.js"), "x".repeat(400));
  fs.symlinkSync("real.js", join(root, "alias.js"));
  fs.symlinkSync("missing.js", join(root, "broken.js"));
  fs.symlinkSync("repo", join(dir, "root-link"), "dir");
  for (const target of ["repo", "./repo/../repo", "root-link"]) {
    const proc = spawnSync(process.execPath, [cli, target, "--format", "json"], { cwd: dir, encoding: "utf8" });
    assert.equal(proc.status, 0, proc.stderr);
    const report = JSON.parse(proc.stdout);
    assert.equal(report.root, target);
    assert.equal(report.totals.files, 1);
    assert.equal(report.totals.totalTokens, 100);
    assert.deepEqual(report.warnings.map((w) => w.path), ["broken.js"]);
  }
});

test("text and JSON reports retain warnings for lean and trimmable scans", (t) => {
  const { root } = fixture(t);
  fs.symlinkSync("missing.js", join(root, "broken.js"));
  for (const trimmable of [false, true]) {
    if (trimmable) fs.writeFileSync(join(root, "package-lock.json"), "{}\n");
    const scan = scanRepo(root);
    const options = { price: 3, top: 0, wrote: null };
    const text = textReport(scan, options);
    assert.match(text, /Warnings/);
    assert.match(text, /broken\.js/);
    assert.match(text, /cannot resolve symlink/);
    assert.deepEqual(JSON.parse(jsonReport(scan, options)).warnings, scan.warnings);
  }
});

test("CLI write mode uses canonical ignore patterns and still reports skipped links", (t) => {
  const { dir } = fixture(t);
  for (const format of ["text", "json"]) {
    const root = join(dir, format);
    fs.mkdirSync(root);
    fs.writeFileSync(join(root, "data.csv"), "x".repeat(400));
    fs.symlinkSync("data.csv", join(root, "alias.js"));
    fs.symlinkSync("missing.js", join(root, "broken.js"));
    const proc = spawnSync(process.execPath, [cli, root, "--write", "--targets", "generic", "--format", format], { encoding: "utf8" });
    assert.equal(proc.status, 0, proc.stderr);
    assert.equal(proc.stderr, "");
    assert.match(proc.stdout, /broken\.js/);
    const ignores = fs.readFileSync(join(root, ".aiignore"), "utf8");
    assert.match(ignores, /data\.csv/);
    assert.doesNotMatch(ignores, /alias\.js|broken\.js/);
    if (format === "json") {
      const report = JSON.parse(proc.stdout);
      assert.equal(report.totals.totalTokens, 100);
      assert.deepEqual(report.patterns, ["data.csv"]);
      assert.equal(report.warnings.length, 1);
    }
  }
});
