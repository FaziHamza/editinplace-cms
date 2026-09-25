import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createElement,
  darkenHex,
  detectLanguage,
  hexToRgb,
  randomId,
  resolveClientUrl,
  resolveSiteIdentifier,
} from '../src/utils';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('lang');
});

describe('createElement', () => {
  it('builds a tag with the class applied', () => {
    const el = createElement('div', 'lcms-panel');
    expect(el.tagName).toBe('DIV');
    expect(el.className).toBe('lcms-panel');
  });
});

describe('hexToRgb', () => {
  it('converts a hex colour to comma-separated channels', () => {
    expect(hexToRgb('#00C853')).toBe('0,200,83');
  });

  it('accepts a value without the hash', () => {
    expect(hexToRgb('FF5722')).toBe('255,87,34');
  });

  it('is case insensitive', () => {
    expect(hexToRgb('#ff5722')).toBe(hexToRgb('#FF5722'));
  });

  it('falls back to the brand green for anything unparseable', () => {
    expect(hexToRgb('rebeccapurple')).toBe('0,200,83');
    expect(hexToRgb('#fff')).toBe('0,200,83'); // short form is not supported
  });
});

describe('darkenHex', () => {
  it('returns a 60% brightness version', () => {
    // 0x00,0xC8,0x53 -> 0, 120, 49
    expect(darkenHex('#00C853')).toBe('#007831');
  });

  it('pads single-digit channels', () => {
    expect(darkenHex('#0A0A0A')).toBe('#060606');
  });

  it('never goes below black', () => {
    expect(darkenHex('#000000')).toBe('#000000');
  });

  it('falls back for an unparseable colour', () => {
    expect(darkenHex('nope')).toBe('#2E7D32');
  });
});

describe('resolveClientUrl', () => {
  it('prefixes a relative path with the base', () => {
    expect(resolveClientUrl('/web_page/save', 'https://api.example.com')).toBe(
      'https://api.example.com/web_page/save'
    );
  });

  it('leaves an absolute URL alone', () => {
    expect(resolveClientUrl('https://other.example.com/save', 'https://api.example.com')).toBe(
      'https://other.example.com/save'
    );
  });

  it('copes with a missing base', () => {
    expect(resolveClientUrl('/save', undefined)).toBe('/save');
  });
});

describe('randomId', () => {
  it('has the shape of a v4 identifier', () => {
    expect(randomId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 200 }, randomId));
    expect(ids.size).toBe(200);
  });
});

describe('detectLanguage', () => {
  const languages = ['en', 'ar'];

  it('prefers a stored choice', () => {
    localStorage.setItem('selectedLanguage', 'ar');
    document.documentElement.setAttribute('lang', 'en');

    // switchLang() writes storage immediately before reloading, so the html
    // attribute is stale at this point — storage has to win
    expect(detectLanguage(languages, 'en')).toBe('ar');
  });

  it('ignores a stored language the site does not offer', () => {
    localStorage.setItem('selectedLanguage', 'fr');
    expect(detectLanguage(languages, 'en')).toBe('en');
  });

  it('falls back to the html lang attribute', () => {
    document.documentElement.setAttribute('lang', 'ar');
    expect(detectLanguage(languages, 'en')).toBe('ar');
  });

  it('ignores an html lang the site does not offer', () => {
    document.documentElement.setAttribute('lang', 'de');
    expect(detectLanguage(languages, 'en')).toBe('en');
  });

  it('falls back to the default when there is nothing else', () => {
    expect(detectLanguage(languages, 'en')).toBe('en');
  });
});

describe('resolveSiteIdentifier', () => {
  it('uses a real hostname as-is', () => {
    expect(resolveSiteIdentifier('acme.studio')).toBe('acme.studio');
  });

  it.each(['localhost', '127.0.0.1', '192.168.1.5', ''])(
    'generates and stores an id for %s',
    (host) => {
      const id = resolveSiteIdentifier(host);

      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect(localStorage.getItem('editinplace_site_id')).toBe(id);
    }
  );

  it('reuses the id it already stored', () => {
    const first = resolveSiteIdentifier('localhost');
    const second = resolveSiteIdentifier('localhost');
    expect(second).toBe(first);
  });

  it('adopts an id written before the rename', () => {
    localStorage.setItem('xtroedge_site_id', 'legacy-site-id');
    expect(resolveSiteIdentifier('localhost')).toBe('legacy-site-id');
  });

  it('survives storage being blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => detectLanguage(['en'], 'en')).not.toThrow();
    vi.restoreAllMocks();
  });
});
