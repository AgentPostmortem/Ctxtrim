// Generate / update ignore files that AI coding tools honor, so trimmed paths never
// enter the model's context. Writes are idempotent via a managed block.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Which filename each tool reads. (Cursor: .cursorignore; Gemini Code Assist / Firebase
// Studio: .aiexclude; "generic" is a neutral file some tools and wrappers respect.)
export const TARGETS = {
  cursor: ".cursorignore",
  gemini: ".aiexclude",
  generic: ".aiignore",
};

const START = "# >>> ctxtrim (managed) >>>";
const END = "# <<< ctxtrim (managed) <<<";

export function block(patterns) {
  return [START, "# Paths ctxtrim flagged as high-cost, low-value for AI context.", ...patterns, END].join("\n");
}

/** Insert or replace the managed block in existing content (keeps the user's own lines). */
export function merge(existing, patterns) {
  const b = block(patterns);
  if (existing.includes(START) && existing.includes(END)) {
    return existing.replace(new RegExp(escape(START) + "[\\s\\S]*?" + escape(END)), b).trimEnd() + "\n";
  }
  const base = existing.trim();
  return (base ? base + "\n\n" : "") + b + "\n";
}

/** @returns {{file, action:'created'|'updated', patterns:number}[]} */
