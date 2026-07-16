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

