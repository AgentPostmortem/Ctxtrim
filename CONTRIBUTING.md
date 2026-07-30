# Contributing to Ctxtrim

Thanks for helping improve **Ctxtrim**. Bug reports, fixes, and features are all welcome.

## Getting set up

```bash
git clone https://github.com/royalpinto007/Ctxtrim
cd Ctxtrim
npm test    # runs `node --test`, zero dependencies
```

## How to run it

Run it locally with: `npx ctxtrim`.

## Ways to contribute

Add a classification rule in `src/classify.js` or a new ignore target in `src/ignore.js`, and cover it in `test/`.

## Pull requests

1. Fork and branch from `main`.
2. Make one focused change per PR.
3. Add or update tests; keep them green.
4. Bump the version and add a `CHANGELOG.md` entry.
5. Open a PR using the template.

## Style

- Match the surrounding code — this project is intentionally **zero-dependency**, so please don't add runtime dependencies.
- Keep it small, honest, and well-scoped.

Questions? Open an issue.
