import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { scanRepo } from "../src/scan.js";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-existing-ignore-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "dist"), { recursive: true });
  mkdirSync(join(root, "logs", "keep"), { recursive: true });
  mkdirSync(join(root, "nested", "cache"), { recursive: true });
  writeFileSync(join(root, "dist", "bundle.js"), "x".repeat(20_000));
  writeFileSync(join(root, "logs", "debug.log"), "y".repeat(20_000));
  writeFileSync(join(root, "logs", "keep", "important.log"), "z".repeat(20_000));
  writeFileSync(join(root, "nested", "cache", "data.json"), "q".repeat(20_000));
  writeFileSync(join(root, "src.js"), "export const value = 1;\n");
  return root;
}

test("scan excludes paths already covered by supported root ignore files", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, ".gitignore"), "dist/\n");
  writeFileSync(join(root, ".cursorignore"), "nested/cache/**\n");
  writeFileSync(join(root, ".claudeignore"), "*.log\n");

  const result = scanRepo(root);
  const paths = result.files.map((file) => file.rel);

  assert.ok(!paths.some((path) => path === "dist" || path.startsWith("dist/")));
  assert.ok(!paths.some((path) => path.endsWith(".log")));
  assert.ok(!paths.includes("nested/cache/data.json"));
  assert.ok(paths.includes("src.js"));
  assert.equal(result.patterns.includes("dist/"), false);
});

test("negation and nested path patterns follow gitignore ordering", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, ".gitignore"), "logs/*\n!logs/keep/\nnested/cache/*.json\n");

  const result = scanRepo(root);
  const paths = result.files.map((file) => file.rel);

  assert.ok(!paths.includes("logs/debug.log"));
  assert.ok(paths.includes("logs/keep/important.log"));
  assert.ok(!paths.includes("nested/cache/data.json"));
});

test("directory-only and rooted patterns distinguish files, directories, and nested names", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-ignore-specificity-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "nested", "cache"), { recursive: true });
  mkdirSync(join(root, "cache-dir"), { recursive: true });
  writeFileSync(join(root, "cache"), "root file");
  writeFileSync(join(root, "cache-dir", "data.json"), "ignored");
  writeFileSync(join(root, "root-only.json"), "ignored");
  writeFileSync(join(root, "nested", "root-only.json"), "kept");
  writeFileSync(join(root, "nested", "cache", "data.json"), "kept");
  writeFileSync(join(root, ".gitignore"), "/cache/\ncache-dir/\n/root-only.json\n");

  const paths = scanRepo(root).files.map((file) => file.rel);
  assert.ok(paths.includes("cache"), "a directory-only rule must not hide a regular file");
  assert.ok(!paths.some((path) => path.startsWith("cache-dir")));
  assert.ok(!paths.includes("root-only.json"));
  assert.ok(paths.includes("nested/root-only.json"));
  assert.ok(paths.includes("nested/cache/data.json"));
});

test("globstars, character classes, and escaped prefixes and spaces are supported", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-ignore-globs-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "artifacts", "deep"), { recursive: true });
  for (const path of ["artifacts/deep/a.tmp", "artifacts/deep/c.tmp", "!literal", "#literal", "with space"]) {
    writeFileSync(join(root, path), "ignored");
  }
  writeFileSync(join(root, "artifacts", "deep", "b.tmp"), "kept");
  writeFileSync(join(root, ".gitignore"), "artifacts/**/[ac].tmp\n\\!literal\n\\#literal\nwith\\ space\n");

  const paths = scanRepo(root).files.map((file) => file.rel);
  assert.ok(!paths.includes("artifacts/deep/a.tmp"));
  assert.ok(!paths.includes("artifacts/deep/c.tmp"));
  assert.ok(paths.includes("artifacts/deep/b.tmp"));
  assert.ok(!paths.includes("!literal"));
  assert.ok(!paths.includes("#literal"));
  assert.ok(!paths.includes("with space"));
});

test("embedded double stars, POSIX classes, and malformed classes follow gitignore behavior", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-ignore-classes-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "ab"), { recursive: true });
  for (const path of ["ab/cd", "abcd", "file1.txt", "filea.txt", "filez.txt"]) {
    writeFileSync(join(root, path), "content");
  }
  writeFileSync(
    join(root, ".gitignore"),
    "ab**cd\nfile[[:digit:]].txt\nfile[z-a].txt\n",
  );

  const paths = scanRepo(root).files.map((file) => file.rel);
  assert.ok(paths.includes("ab/cd"), "embedded ** must not cross a path separator");
  assert.ok(!paths.includes("abcd"));
  assert.ok(!paths.includes("file1.txt"));
  assert.ok(paths.includes("filea.txt"));
  assert.ok(paths.includes("filez.txt"), "a malformed range must not crash or overmatch");
});

test("ignore files are combined as an independent union", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-ignore-union-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, "secret.log"), "ignored");
  writeFileSync(join(root, ".gitignore"), "*.log\n");
  writeFileSync(join(root, ".cursorignore"), "!secret.log\n");

  assert.ok(!scanRepo(root).files.some((file) => file.rel === "secret.log"));
});

test("a child cannot be re-included while its parent directory remains ignored", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-ignore-parent-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "dist", "keep.js"), "still ignored");
  writeFileSync(join(root, ".gitignore"), "dist/\n!dist/keep.js\n");

  assert.ok(!scanRepo(root).files.some((file) => file.rel === "dist/keep.js"));
});

test("a generated cursor ignore makes the second scan report less recoverable waste", (t) => {
  const root = fixture(t);
  const first = scanRepo(root);
  writeFileSync(join(root, ".cursorignore"), `${first.patterns.join("\n")}\n`);
  const second = scanRepo(root);

  assert.ok(first.totals.trimTokens > 0);
  assert.ok(second.totals.trimTokens < first.totals.trimTokens);
  assert.ok(second.totals.wastePct < first.totals.wastePct);
});
