// Output formatting for ctxtrim.
const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);

export const fmtTokens = (n) =>
  n >= 1_000_000 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
  : n >= 1000 ? (n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "") + "k"
  : "" + n;
const dollars = (tokens, price) => (tokens / 1e6) * price;
const usd = (n) => "$" + n.toFixed(n < 1 ? 3 : 2);

export function textReport(scan, { price, top, wrote }) {
  const t = scan.totals;
  const L = [];
  L.push("");
  L.push(c("1", `ctxtrim`) + c("90", `  ·  ${scan.root}  ·  ${t.files} files`));
  L.push("");
  L.push(`  Full context load: ${c("1", "~" + fmtTokens(t.totalTokens) + " tokens")}  ${c("90", "(~" + usd(dollars(t.totalTokens, price)) + " @ $" + price + "/M input)")}`);
  if (t.trimTokens > 0) {
    L.push(`  Trimmable:         ${c("33", "~" + fmtTokens(t.trimTokens) + " tokens")} ${c("33", "(" + t.wastePct + "%)")}  ${c("32", "→ save ~" + usd(dollars(t.trimTokens, price)) + " per load")}`);
  } else {
    L.push(c("32", "  Nothing worth trimming — your context is already lean. ✓"));
    L.push("");
    return L.join("\n");
  }
  L.push("");
  const cats = Object.entries(t.byCategory).sort((a, b) => b[1].tokens - a[1].tokens);
  L.push(c("90", "  by category: ") + cats.map(([k, v]) => `${k} ${fmtTokens(v.tokens)}`).join(c("90", " · ")));
  L.push("");
  L.push(c("1", "  Top offenders"));
  for (const f of scan.files.filter((f) => f.trim).slice(0, top)) {
    const tok = ("~" + fmtTokens(f.tokens)).padStart(7);
    L.push(`  ${c("33", tok)}  ${c("90", usd(dollars(f.tokens, price)).padStart(7))}  ${f.rel}  ${c("90", "— " + f.reason)}`);
  }
  L.push("");
  if (wrote && wrote.length) {
    L.push(c("32", "  ✓ ") + wrote.map((w) => `${w.file} (${w.action}, ${w.patterns} patterns)`).join(", "));
  } else {
    L.push(c("90", "  Run with ") + c("1", "--write") + c("90", " to create .cursorignore / .aiexclude and cut this from context."));
  }
  L.push("");
  return L.join("\n");
}

export function jsonReport(scan, { price, wrote }) {
  const t = scan.totals;
  return JSON.stringify({
    tool: "ctxtrim",
    root: scan.root,
    price,
    totals: {
      ...t,
      estUsdPerLoad: +dollars(t.totalTokens, price).toFixed(4),
      estUsdSaved: +dollars(t.trimTokens, price).toFixed(4),
    },
    patterns: scan.patterns,
    offenders: scan.files.filter((f) => f.trim).map((f) => ({ path: f.rel, tokens: f.tokens, category: f.category, reason: f.reason })),
    wrote: wrote || [],
  }, null, 2);
}
