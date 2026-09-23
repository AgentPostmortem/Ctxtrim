import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { run } from "../src/cli.js";

for (const format of ["text", "json"]) {
  for (const failTarget of [".cursorignore", ".aiexclude"]) {
    test(`CLI reports write failure cleanly (${format}, ${failTarget})`, (t) => {
      const root = fs.mkdtempSync(join(tmpdir(), "ctxtrim-write-error-"));
      t.after(() => fs.rmSync(root, { recursive: true, force: true }));
      fs.writeFileSync(join(root, "package-lock.json"), "{}\n");
      const originalWrite = fs.writeFileSync;
      let stdout = "", stderr = "";
      t.mock.method(process.stdout, "write", (chunk) => { stdout += chunk; return true; });
      t.mock.method(process.stderr, "write", (chunk) => { stderr += chunk; return true; });
      t.mock.method(fs, "writeFileSync", (file, ...args) => {
        if (file === join(root, failTarget)) {
          const error = new Error(`EACCES: permission denied, open '${file}'`);
          error.code = "EACCES";
          throw error;
        }
        return originalWrite(file, ...args);
      });
      syncBuiltinESMExports();
      let code;
      try { code = run([root, "--write", "--format", format], { version: "test" }); }
      finally { t.mock.restoreAll(); syncBuiltinESMExports(); }

      assert.equal(code, 2);
      assert.equal(stdout, "");
      assert.equal(stderr, `ctxtrim: EACCES: permission denied, open '${join(root, failTarget)}'\n`);
      assert.equal(fs.existsSync(join(root, failTarget)), false);
      // Earlier targets can already have been written; error handling is not rollback.
      assert.equal(fs.existsSync(join(root, ".cursorignore")), failTarget === ".aiexclude");
    });
  }
}
