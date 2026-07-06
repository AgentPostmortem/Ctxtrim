// Walk a repo, estimate each file's token cost, classify it, and aggregate.
import { readdirSync, readFileSync, statSync, openSync, readSync, closeSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { classify, ignorePattern } from "./classify.js";

const ALWAYS_SKIP = new Set([".git"]);
const MAX_READ = 5_000_000; // bytes fully read; larger files are estimated from size

/** ~4 chars per token is the widely-cited rule of thumb; good enough to rank files. */
export const estimateTokens = (text) => Math.ceil(text.length / 4);

