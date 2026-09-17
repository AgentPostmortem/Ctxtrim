// Walk a repo, estimate each file's token cost, classify it, and aggregate.
import { readdirSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { classify, classifyPath, ignorePattern, VENDOR_DIRS, BUILD_DIRS } from "./classify.js";

const ALWAYS_SKIP = new Set([".git"]);
// Directory names that are vendored or build output: record once, never descend.
const VENDOR_SKIP = new Set(VENDOR_DIRS.map((d) => d.toLowerCase()));
const BUILD_SKIP = new Set(BUILD_DIRS.map((d) => d.toLowerCase()));
const MAX_READ = 5_000_000; // bytes fully read; larger files are estimated from size

/** ~4 chars per token is the widely-cited rule of thumb; good enough to rank files. */
export const estimateTokens = (text) => Math.ceil(text.length / 4);

/** Cheap total token estimate for a directory: sum sibling sizes without reading contents. */
function dirTokenEstimate(abs) {
  let bytes = 0;
  const stack = [abs];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const child = join(dir, e.name);
      try {
        if (e.isDirectory()) stack.push(child);
        else if (e.isFile()) bytes += statSync(child).size;
      } catch { /* skip unreadable entries */ }
    }
  }
  return Math.ceil(bytes / 4);
}

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
export function scanRepo(target, opts = {}) {
  const maxTokens = opts.maxTokens ?? 2000;
  if (!statSync(target).isDirectory()) throw new Error(`not a directory: ${target}`);
  const root = target;
  const files = [];

  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (ALWAYS_SKIP.has(e.name)) continue;
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        const lower = e.name.toLowerCase();
        if (VENDOR_SKIP.has(lower) || BUILD_SKIP.has(lower)) {
          // Record the directory once by name; do not descend or read contents.
          const rel = relative(root, abs).split(sep).join("/");
          const reason = VENDOR_SKIP.has(lower)
            ? "vendored dependency directory"
            : "build / generated output directory";
          files.push({
            rel, size: 0, tokens: dirTokenEstimate(abs),
            category: VENDOR_SKIP.has(lower) ? "vendored" : "build",
            trim: true, binary: false, reason,
          });
          continue;
        }
        walk(abs); continue;
      }
      if (!e.isFile() && !e.isSymbolicLink()) continue;
      let size = 0;
      try {
        const stat = statSync(abs);
        if (!stat.isFile()) continue;
        size = stat.size;
      } catch { continue; }
      const rel = relative(root, abs).split(sep).join("/");
      const pathClassification = classifyPath(rel);
      const info = pathClassification?.binary ? { tokens: 0, sample: "" } : fileInfo(abs, size);
      const c = pathClassification ?? classify(rel, { size, tokens: info.tokens, sample: info.sample, maxTokens });
      const tokens = c.binary ? 0 : info.tokens; // binaries carry no text tokens
      files.push({ rel, size, tokens, category: c.category, trim: c.trim, binary: c.binary, reason: c.reason });
    }
  };
  walk(root);

  const textFiles = files.filter((f) => !f.binary);
  const total = sum(textFiles.map((f) => f.tokens));
  const trimTokens = sum(textFiles.filter((f) => f.trim).map((f) => f.tokens));
  const patterns = uniq(files.filter((f) => f.trim).map((f) => ignorePattern(f.rel))).sort();

  files.sort((a, b) => b.tokens - a.tokens);
  return {
    root,
    files,
    patterns,
    totals: {
      files: files.length,
      textFiles: textFiles.length,
      totalTokens: total,
      trimTokens,
      keepTokens: total - trimTokens,
      wastePct: total ? Math.round((trimTokens / total) * 100) : 0,
      byCategory: countBy(files.filter((f) => f.trim)),
    },
  };
}

const sum = (a) => a.reduce((x, y) => x + y, 0);
const uniq = (a) => [...new Set(a)];
function countBy(files) {
  const out = {};
  for (const f of files) {
    out[f.category] = out[f.category] || { files: 0, tokens: 0 };
    out[f.category].files++; out[f.category].tokens += f.tokens;
  }
  return out;
}
