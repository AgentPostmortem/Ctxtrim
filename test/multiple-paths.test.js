import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../bin/ctxtrim.js", import.meta.url));

test("multiple paths fail before scanning or writing either directory", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ctxtrim-paths-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths = [join(root, "a"), join(root, "b")];
  for (const path of paths) {
    mkdirSync(path);
    writeFileSync(join(path, "package-lock.json"), "{}\n");
  }
  for (const args of [
    [paths[0], paths[1], "--write"],
    [paths[0], "--format", "json", paths[1], "--write"],
    [paths[0], paths[0]],
    ["", paths[1]],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /only one path/i);
    assert.equal(result.stdout, "");
  }
  for (const path of paths) {
    assert.equal(existsSync(join(path, ".cursorignore")), false);
    assert.equal(existsSync(join(path, ".aiexclude")), false);
  }
  for (const args of [[paths[0], "--format", "json"], ["--format=json", paths[0]], []]) {
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: paths[0], encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
});
