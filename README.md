# editinplace-cms

Framework-agnostic inline CMS. Add `?edit=true` to any URL and your site becomes editable — click the text, change it, publish. No admin panel to learn, no rebuild, no redeploy.

Works with Angular, React, Next.js, Vue, or plain HTML.

```bash
npm install editinplace-cms
```

## Quick start

The fastest way — one script tag, no build step. Paste it before `</body>`:

```html
<script>
  window.__EDITINPLACE_CONFIG__ = {
    licenseKey: "XTRO-XXXX-XXXX-XXXX-XXXX",
    apiBase: "https://your-backend.com/api"
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/editinplace-cms/dist/index.global.js"></script>
```

That's it. Open any page with `?edit=true`, sign in, flip the **Edit** toggle, and every heading, paragraph, link and button on the page is editable.

Get a licence key by creating a free account — see [Backend](#backend) below.

## How it works

1. The script scans the page and tags editable elements with `data-cms`.
2. `?edit=true` shows a floating button; signing in unlocks edit mode.
3. Edited elements get a dashed outline. Click, type, done.
4. **Save Draft** keeps a private copy; **Publish** makes it live for visitors.
5. Visitors without `?edit=true` just see the published content — no editor UI, nothing editable.

Content is stored per page slug and per language, so the same element can hold different text in each language you configure.

## Usage with a bundler

If you would rather import it than use a script tag, skip the auto-init and create the instance yourself:

```ts
import { EditInPlace } from 'editinplace-cms';

const cms = await EditInPlace.create({
  apiBase: 'https://your-backend.com/api',
  licenseKey: 'XTRO-XXXX-XXXX-XXXX-XXXX',
  languages: ['en', 'ar'],
  defaultLanguage: 'en',
});

// later
cms.destroy();
```

### React / Next.js

```tsx
import { useEffect, useRef } from 'react';
import { EditInPlace } from 'editinplace-cms';

export default function App() {
  const cms = useRef<EditInPlace | null>(null);

  useEffect(() => {
    EditInPlace.create({
      apiBase: 'https://your-backend.com/api',
      licenseKey: 'XTRO-XXXX-XXXX-XXXX-XXXX',
    }).then((instance) => {
      cms.current = instance;
    });

    return () => cms.current?.destroy();
  }, []);

  return <main>{/* your page */}</main>;
}
```

In Next.js, put this in a client component (`'use client'`) so it only runs in the browser.

### Angular

```ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { EditInPlace } from 'editinplace-cms';

@Component({ selector: 'app-root', template: '<router-outlet />' })
export class AppComponent implements OnInit, OnDestroy {
  private cms?: EditInPlace;

  async ngOnInit() {
    this.cms = await EditInPlace.create({
      apiBase: 'https://your-backend.com/api',
      licenseKey: 'XTRO-XXXX-XXXX-XXXX-XXXX',
    });
  }

  ngOnDestroy() {
    this.cms?.destroy();
  }
}
```

## Configuration

Only `licenseKey` is required.

`apiBase` decides which server the editor talks to. Leave it out and the
hosted EditInPlace API is used, which is what most installs want. Set it to
your own server to self-host, or to an empty string to run with no backend at
all — the editor opens and nothing can be saved, which is how the demo page
and local development work.

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `licenseKey` | `string` | — | Your licence key. Ties the editor to your account and domain. |
| `apiBase` | `string` | the hosted EditInPlace API | Which server handles sign-in, save and publish. Your own API, or `''` for none. |
| `highlightColor` | `string` | `'#00C853'` | Accent colour for the outlines, panel and buttons. Editors can also change it from the Theme swatches. |
| `languages` | `string[]` | `['en']` | Languages you keep content in. Two or more adds a language switcher. |
| `defaultLanguage` | `string` | first of `languages` | Which language the editor opens in. |
| `containerSelector` | `string` | whole page | Limit editing to one region, e.g. `'main'`. Anything outside is left alone. |
| `editableTags` | `string[]` | 23 text tags | Which tags become editable — `h1`–`h6`, `p`, `span`, `a`, `button`, `li`, `td`, `th`, `div`, `header`, `footer` and friends. |
| `richText` | `boolean` | `true` | The bold / italic / underline / link toolbar shown on selection. |
| `historyRetentionDays` | `number` | `7` | How long edit history is kept in the browser. |
| `i18nBasePath` | `string` | — | Path to existing translation JSON, used to pre-fill languages you already have. |
| `clientApi` | `string` | `apiBase` | Your own API, if content should be forwarded there instead of stored by EditInPlace. |
| `clientHeaders` | `object` | — | Headers sent with those client API calls. |

### Callbacks

```js
window.__EDITINPLACE_CONFIG__ = {
  licenseKey: '...',
  apiBase: '...',
  onSaved: () => console.log('draft saved'),
  onPublished: () => console.log('live'),
  onError: (action, error) => console.error(action, error),
  onEditModeChanged: (editing) => console.log('edit mode:', editing),
  onLangChanged: (lang) => console.log('language:', lang),
};
```

## Plans

| | Free | Pro |
| --- | :---: | :---: |
| Inline text editing | ✅ | ✅ |
| Rich text formatting | ✅ | ✅ |
| Multi-language content | ✅ | ✅ |
| Edit history & undo | ✅ | ✅ |
| Save drafts & publish | ✅ | ✅ |
| Image editing & upload | — | ✅ |

Free is free forever — no trial clock, no card. The only thing Pro adds is replacing and uploading images from the editor. On Free, images simply are not editable; everything else works the same.

Your plan is read from the licence key at runtime, so upgrading takes effect without touching your site's code.

## The service behind it

This repository is the editor — the part that runs in your visitor's browser.
Saving and publishing need somewhere to put the content, and that is the hosted
EditInPlace service (a separate, closed-source product).

A free account gives you:

- A licence key and the exact snippet for your site
- Content storage, drafts and publishing
- Multi-language content

Free has no expiry and no card. Pro adds image editing and upload.

Sign up at [xtroedge.com](https://xtroedge.com) — you get your key and snippet
straight away.

## Browser support

Any modern browser. The editor uses `contenteditable`, IndexedDB for history, and `localStorage` for the session — no framework runtime, no dependencies.

## Links

- [Website](https://xtroedge.com)
- [npm](https://www.npmjs.com/package/editinplace-cms)

## License

MIT — see [LICENSE](LICENSE). Free for personal and commercial use.

That covers this repository: the editor that runs in the browser. The hosted
EditInPlace service it talks to (accounts, storage, publishing) is a separate,
closed-source product.
