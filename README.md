# ctxtrim

**Trim what bloats your AI coding context.** Claude Code, Cursor, and Codex send your files as context on *every* request — so a lockfile, a `dist/` bundle, or a big JSON quietly makes every message cost more. `ctxtrim` finds that junk and writes the ignore files that cut it.

```bash
npx ctxtrim            # see what's costing you tokens
npx ctxtrim --write    # write .cursorignore + .aiexclude to cut it
```

[![npm](https://img.shields.io/npm/v/ctxtrim.svg)](https://www.npmjs.com/package/ctxtrim) [![CI](https://github.com/royalpinto007/ctxtrim/actions/workflows/ci.yml/badge.svg)](https://github.com/royalpinto007/ctxtrim/actions) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## Why

AI coding tools re-send your context with every turn — *"a one-line question in a session that's been open all day still draws usage for the whole conversation,"* and **large context can cost 3× the tokens.** Usage dashboards (like ccusage) tell you *how much you spent* after the fact. `ctxtrim` is the other half: it tells you **what to stop sending** so the bill is smaller in the first place.

It flags the files that are high-cost and low-value for a model — lockfiles, `dist/`/`build/` output, `node_modules`, minified bundles, big data/JSON, generated code — and generates the ignore files your tools already honor.

