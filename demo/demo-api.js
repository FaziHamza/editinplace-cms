/**
 * A backend for the demo, running entirely in the browser.
 *
 * The editor talks to a handful of endpoints to sign in, check a licence, load
 * a page, save a draft, publish it and upload an image. Here those are answered
 * by intercepting fetch and keeping everything in localStorage, so the full
 * round trip — edit, save, reload, publish — works with no server and without
 * touching the hosted service.
 *
 * Nothing here ships in the package. It exists so that anyone working on the
 * save and publish paths has something to exercise them against.
 */

(function () {
  const PREFIX = '/__demo-api';
  const STORE = 'editinplace-demo-pages';
  const TOKEN = 'demo-token';

  const readPages = () => {
    try {
      return JSON.parse(localStorage.getItem(STORE) || '{}');
    } catch {
      return {};
    }
  };

  const writePages = (pages) => {
    try {
      localStorage.setItem(STORE, JSON.stringify(pages));
    } catch {
      /* quota — the demo just forgets, which is fine */
    }
  };

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  function handle(pathname, search, init) {
    const body = init && init.body ? JSON.parse(init.body) : {};
    const pages = readPages();

    // Any credentials are accepted — there are no accounts here.
    if (pathname.endsWith('/auth/login')) return json({ token: TOKEN });
    if (pathname.endsWith('/auth/verify-otp')) return json({ token: TOKEN });
    if (pathname.endsWith('/auth/resend-otp')) return json({ ok: true });

    if (pathname.endsWith('/license/validate')) {
      return json({
        valid: true,
        plan: 'paid',
        features: { images: true },
        message: 'Demo mode — nothing leaves this browser.',
      });
    }

    if (pathname.endsWith('/web-page/get')) {
      const slug = new URLSearchParams(search).get('slug') || '';
      return pages[slug] ? json(pages[slug]) : json({ message: 'Not found' }, 404);
    }

    if (pathname.endsWith('/web_page/save')) {
      const page = pages[body.slug] || { slug: body.slug, title: body.title };
      page.title = body.title;
      page.content = body.content;
      pages[body.slug] = page;
      writePages(pages);
      return json({ ok: true, slug: body.slug });
    }

    if (pathname.endsWith('/web_page/publish')) {
      const page = pages[body.slug] || { slug: body.slug, title: body.title };
      page.title = body.title;
      page.published_content = body.published_content;
      // Publishing also settles the draft, the way a real backend would
      page.content = body.published_content;
      pages[body.slug] = page;
      writePages(pages);
      return json({ ok: true, slug: body.slug });
    }

    if (pathname.endsWith('/web/upload-image')) {
      // The image arrives as a data URL and is handed straight back. With
      // imageBaseUrl set to an empty string the editor uses it unchanged.
      return json({ path: body.url });
    }

    return json({ message: `No demo handler for ${pathname}` }, 404);
  }

  const realFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input && input.url;

    if (typeof url === 'string' && url.includes(PREFIX)) {
      const parsed = new URL(url, window.location.origin);
      try {
        return Promise.resolve(handle(parsed.pathname, parsed.search, init));
      } catch (err) {
        return Promise.resolve(json({ message: String(err) }, 500));
      }
    }

    return realFetch(input, init);
  };

  /** Wipes the demo's saved pages. Handy from the console. */
  window.resetDemo = function () {
    localStorage.removeItem(STORE);
    location.reload();
  };
})();
