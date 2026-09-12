import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/scan.js";

const cli = fileURLToPath(new URL("../bin/ctxtrim.js", import.meta.url));

test("scanRepo rejects a file path instead of scanning the current directory", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-file-target-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const target = join(root, "package.json");
  writeFileSync(target, "{}\n");

  assert.throws(() => scanRepo(target), {
    message: `not a directory: ${target}`,
  });
});

test("scanRepo rejects a missing path instead of scanning the current directory", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-missing-target-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  assert.throws(() => scanRepo(join(root, "missing")), { code: "ENOENT" });
});

test("CLI rejects relative and absolute file targets before reporting or writing", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-invalid-scan-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // Ensure that an accidental cwd scan would find something to trim and write.
  writeFileSync(join(root, "package-lock.json"), "{}\n");

  for (const target of ["package-lock.json", join(root, "package-lock.json")]) {
    const result = spawnSync(process.execPath, [
      cli, target, "--write", "--targets", "cursor,gemini,generic", "--format", "json",
    ], { cwd: root, encoding: "utf8" });

    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, `ctxtrim: not a directory: ${target}\n`);
    for (const file of [".cursorignore", ".aiexclude", ".aiignore"]) {
      assert.equal(existsSync(join(root, file)), false, `${file} should not be written`);
    }
  }
});
