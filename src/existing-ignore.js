import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const EXISTING_IGNORE_FILES = [".gitignore", ".cursorignore", ".claudeignore"];

function globSource(pattern) {
  let source = "";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "\\" && i + 1 < pattern.length) {
      source += pattern[++i].replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    } else if (char === "*") {
      if (pattern[i + 1] === "*") {
        const previous = pattern[i - 1];
        const after = pattern[i + 2];
        if ((i === 0 || previous === "/") && after === "/") {
          i += 2;
          source += "(?:.*/)?";
        } else if (previous === "/" && i + 2 === pattern.length) {
          i++;
          source += ".*";
        } else {
          while (pattern[i + 1] === "*") i++;
          source += "[^/]*";
        }
      } else source += "[^/]*";
    } else if (char === "?") source += "[^/]";
    else if (char === "[") {
      const posix = pattern.slice(i).match(/^\[\[:(alnum|alpha|blank|cntrl|digit|graph|lower|print|punct|space|upper|xdigit):\]\]/);
      if (posix) {
        const classes = {
          alnum: "A-Za-z0-9", alpha: "A-Za-z", blank: " \\t", cntrl: "\\x00-\\x1F\\x7F",
          digit: "0-9", graph: "!-~", lower: "a-z", print: " -~", punct: "!-/:-@[-`{-~",
          space: "\\s", upper: "A-Z", xdigit: "A-Fa-f0-9",
        };
        source += `[${classes[posix[1]]}]`;
        i += posix[0].length - 1;
        continue;
      }

      let cursor = i + 1;
      let negated = false;
      if (pattern[cursor] === "!" || pattern[cursor] === "^") {
        negated = true;
        cursor++;
      }
      if (pattern[cursor] === "]") cursor++;
      const close = pattern.indexOf("]", cursor);
      if (close === -1) {
        source += "\\[";
        continue;
      }

      let contents = pattern.slice(i + 1 + (negated ? 1 : 0), close);
      if (!contents) return null;
      contents = contents
        .replace(/\\/g, "\\\\")
        .replace(/^\]/, "\\]");
      source += `[${negated ? "^" : ""}${contents}]`;
      i = close;
    } else source += char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }
  return source;
}

function parseRule(line) {
  let value = line.replace(/\r$/, "");
  if (!value || /^\s*$/.test(value)) return null;

  let escapedPrefix = false;
  if (value.startsWith("\\#") || value.startsWith("\\!")) {
    value = value.slice(1);
    escapedPrefix = true;
  }
  if (!escapedPrefix && value.startsWith("#")) return null;

  let negated = false;
  if (!escapedPrefix && value.startsWith("!")) {
    negated = true;
    value = value.slice(1);
  }
  if (!value) return null;

  // Unescaped trailing spaces are ignored by gitignore-style files.
  while (value.endsWith(" ")) {
    let slashes = 0;
    for (let i = value.length - 2; i >= 0 && value[i] === "\\"; i--) slashes++;
    if (slashes % 2 === 1) break;
    value = value.slice(0, -1);
  }
  const directoryOnly = value.endsWith("/");
  if (directoryOnly) value = value.slice(0, -1);
  const anchored = value.startsWith("/") || value.includes("/");
  if (value.startsWith("/")) value = value.slice(1);
  if (!value) return null;

  const prefix = anchored ? "^" : "(?:^|/)";
  const source = globSource(value);
  if (source == null) return { negated, directoryOnly, regex: /$a/ };
  let regex;
  try {
    regex = new RegExp(`${prefix}${source}$`);
  } catch {
    regex = /$a/;
  }
  return {
    negated,
    directoryOnly,
    regex,
  };
}

function createMatcher(contents) {
  const rules = contents.split("\n").map(parseRule).filter(Boolean);
  const directStatus = (path, isDirectory) => {
    let ignored = false;
    for (const rule of rules) {
      if ((!rule.directoryOnly || isDirectory) && rule.regex.test(path)) ignored = !rule.negated;
    }
    return ignored;
  };

  return (path, isDirectory) => {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) {
      if (directStatus(parts.slice(0, i).join("/"), true)) return true;
    }
    return directStatus(path, isDirectory);
  };
}

/** Read supported root ignore files and return a path predicate. */
export function existingIgnoreMatcher(root) {
  const matchers = [];
  for (const filename of EXISTING_IGNORE_FILES) {
    const path = join(root, filename);
    if (!existsSync(path)) continue;
    try {
      matchers.push(createMatcher(readFileSync(path, "utf8")));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return (path, isDirectory = false) => matchers.some((matches) => matches(path, isDirectory));
}
