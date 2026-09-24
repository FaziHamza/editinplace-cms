# Contributing to EditInPlace CMS

Thanks for taking the time. Bug reports, docs fixes and pull requests are all
welcome.

## What lives here

This repository holds the **editor library** published to npm as
`editinplace-cms` — the script that makes a page editable. It is MIT licensed.

The hosted EditInPlace service (accounts, publishing, storage) is a separate,
closed-source product. You do not need it to work on the library.

## Getting set up

```bash
git clone https://github.com/FaziHamza/editinplace-cms.git
cd editinplace-cms
npm install
npm run dev        # rebuilds dist/ on every change
```

`npm run dev` watches `src/` and rewrites `dist/`. Point a test page at
`dist/index.global.js` and reload as you work.

## Trying your changes

The quickest loop is a plain HTML file that loads the built bundle:

```html
<h1>Edit me</h1>
<p>And me.</p>

<script>
  window.__EDITINPLACE_CONFIG__ = {
    apiBase: "https://your-backend.example.com/api",
    licenseKey: "YOUR-KEY"
  };
</script>
<script src="./dist/index.global.js"></script>
```

Open it with `?edit=true` appended to the URL.

Saving and publishing talk to a backend. If you are only changing editor
behaviour — outlines, the toolbar, keyboard handling, the panel — you can work
without one; the editor loads and renders fine, only save/publish will fail.

## Before you open a pull request

```bash
npm run test:run   # must pass
npm run build      # must succeed
npx tsc --noEmit   # must be clean
```

CI runs all three on every PR.

Tests live in `tests/` and run on [vitest](https://vitest.dev) against jsdom.
`npm test` watches. New behaviour in an extracted module should come with a
test; the modules exist precisely so they can be tested without standing up a
whole page.

## What we look for

- **One change per pull request.** Easier to review, easier to revert.
- **Match the surrounding code.** Same naming, same comment density. The
  codebase is plain TypeScript with no framework and no runtime dependencies —
  please keep it that way.
- **No new dependencies** unless there is a strong reason. "Zero dependencies"
  is a feature of this package.
- **Explain the why.** What was broken, what changes, how you checked it.

## Reporting a bug

Open an issue with:

- What you expected and what happened instead
- A minimal page that reproduces it
- Browser and version
- The package version (`npm ls editinplace-cms`)

A reproduction is worth more than a description — most bugs here depend on the
exact HTML the editor is scanning.

## Security

Please do not open a public issue for a security problem. Email
**support@editinplace.com** instead and we will get back to you.

## Licence

By contributing you agree that your contribution is licensed under the MIT
licence that covers this library.
