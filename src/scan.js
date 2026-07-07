// Walk a repo, estimate each file's token cost, classify it, and aggregate.
import { readdirSync, readFileSync, statSync, openSync, readSync, closeSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { classify, ignorePattern } from "./classify.js";

const ALWAYS_SKIP = new Set([".git"]);
const MAX_READ = 5_000_000; // bytes fully read; larger files are estimated from size

/** ~4 chars per token is the widely-cited rule of thumb; good enough to rank files. */
export const estimateTokens = (text) => Math.ceil(text.length / 4);

function fileInfo(abs, size) {
  // Read up to MAX_READ bytes for both token estimate and the generated-marker sample.
  let text = "";
  let bytesRead = 0;
  try {
    if (size <= MAX_READ) { text = readFileSync(abs, "utf8"); bytesRead = size; }
    else {
      const fd = openSync(abs, "r");
      const buf = Buffer.alloc(MAX_READ);
      bytesRead = readSync(fd, buf, 0, MAX_READ, 0);
      closeSync(fd);
      text = buf.toString("utf8", 0, bytesRead);
    }
  } catch { return { tokens: 0, sample: "" }; }
  let tokens = estimateTokens(text);
  if (bytesRead && bytesRead < size) tokens = Math.round(tokens * (size / bytesRead)); // scale partial reads
  return { tokens, sample: text.slice(0, 4000) };
}

/**
 * @param {string} target repo root (or a subdir)
 * @param {{maxTokens?:number}} opts
 * @returns {{root, files, totals}}
 */
