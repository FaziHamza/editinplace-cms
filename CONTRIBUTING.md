# Contributing

Thanks for being here. Bug reports, typo fixes and pull requests are all
welcome, and you do not need to know this codebase to help.

## What this repo is

This is the **editor library** — the script that makes a web page editable. It
is published to npm as `editinplace-cms` and is MIT licensed.

The hosted EditInPlace service (accounts, saving, publishing) is a separate
product and is not open source. You do not need it to work on this library.

## Set up

You need [Node.js](https://nodejs.org) 20 or newer. Then:

```bash
git clone https://github.com/FaziHamza/editinplace-cms.git
cd editinplace-cms
npm install
npm run demo
```

Open **http://localhost:5173/?edit=true**. You should see a sample page with an
editor button in the corner. That is the whole setup.

## Make a change

Open a second terminal and run:

```bash
npm run dev
```

This rebuilds the library every time you save a file in `src/`. Refresh the
browser to see your change. Leave both terminals running while you work.

The demo page lives at `demo/index.html` — edit it freely if you need different
content to test against. Just don't commit those edits unless they help
everyone.

### A note on saving

Saving and publishing need a backend, and the demo has none. The editor opens
and works, but **Save will fail**. That is expected. Almost all editor work —
the toolbar, outlines, keyboard handling, the panel, images — can be done
without ever saving.

## Where things live

| File | What it does |
| --- | --- |
| `src/editinplace.ts` | The editor itself. The big one. |
| `src/license.ts` | Works out which plan is active and what it unlocks |
| `src/storage.ts` | Reads and writes browser storage |
| `src/history.ts` | The local edit history, kept in IndexedDB |
| `src/styles.ts` | All the editor's CSS |
| `src/utils.ts` | Small helpers with no dependencies |
| `src/types.ts` | Shared TypeScript types |
| `src/icons.ts` | The SVG icons |
| `src/constants.ts` | Fixed values used in more than one place |
| `src/index.ts` | What the package exports, and the auto-start |

Tests live in `tests/`, one file per module.

If this is your first change, the smaller files are a much friendlier place to
start than `editinplace.ts`.

## Before you open a pull request

Run these three. All three must pass:

```bash
npm run test:run    # tests
npx tsc --noEmit    # types
npm run build       # build
```

The same three run automatically on your pull request.

If you changed how something behaves, add a test for it. Tests use
[vitest](https://vitest.dev); `npm test` reruns them as you type.

## Opening the pull request

1. Fork the repo on GitHub
2. Make a branch: `git checkout -b fix-the-thing`
3. Commit your change
4. Push to your fork and open a pull request

Please keep it to **one change per pull request** — it is easier to review and
easier to undo.

In the description, say what was wrong, what you changed, and how you checked
it. A screenshot or a short clip helps a lot for anything visual.

## House style

- **No new dependencies.** Zero dependencies is a feature of this package.
- **No frameworks.** Plain TypeScript and plain DOM.
- **Write like the code around it.** Same naming, same amount of commenting.

## Reporting a bug

Open an issue and include:

- What you expected, and what happened instead
- A small page that reproduces it
- Your browser and version
- Your package version (`npm ls editinplace-cms`)

A page we can open ourselves is worth more than a paragraph describing it —
most bugs here depend on the exact HTML the editor is looking at.

## Security

Please do not open a public issue for a security problem. Email
**support@editinplace.com** instead.

## Licence

By contributing, you agree your contribution is released under the MIT licence
that covers this library.
