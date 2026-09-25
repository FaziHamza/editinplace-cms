/**
 * Small helpers with no dependency on editor state.
 *
 * Anything here can be called from a test without standing up a page.
 */

const DEFAULT_PRIMARY_RGB = '0,200,83';
const DEFAULT_PRIMARY_DARK = '#2E7D32';

const HEX_COLOUR = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

export function createElement(tag: string, className: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** `"#00C853"` -> `"0,200,83"`, for use inside `rgba()` in the stylesheet. */
export function hexToRgb(hex: string): string {
  const m = HEX_COLOUR.exec(hex);
  if (!m) return DEFAULT_PRIMARY_RGB;
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}

/** A 60%-brightness version of the accent, used for gradients and hovers. */
export function darkenHex(hex: string): string {
  const m = HEX_COLOUR.exec(hex);
  if (!m) return DEFAULT_PRIMARY_DARK;

  const channel = (i: number) =>
    Math.max(0, Math.floor(parseInt(m[i], 16) * 0.6))
      .toString(16)
      .padStart(2, '0');

  return `#${channel(1)}${channel(2)}${channel(3)}`;
}

/**
 * Turns a stored relative path into an absolute URL.
 *
 * Values stored against an account are relative (`/web_page/save`) so the same
 * account works across environments; an absolute one is passed through.
 */
export function resolveClientUrl(storedUrl: string, base: string | undefined): string {
  return storedUrl.startsWith('/') ? `${base ?? ''}${storedUrl}` : storedUrl;
}

/** RFC-4122 shaped identifier. Not security-grade — it only has to be unique. */
export function randomId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Which language the editor should open in.
 *
 * localStorage wins because `switchLang()` writes it immediately before a
 * reload — the `<html lang>` attribute has not caught up at that point.
 */
export function detectLanguage(
  languages: string[],
  defaultLanguage: string,
  doc: Document = document
): string {
  try {
    const stored = localStorage.getItem('selectedLanguage');
    if (stored && languages.includes(stored)) return stored;
  } catch {
    /* storage blocked — fall through to the document */
  }

  const htmlLang = doc.documentElement.getAttribute('lang');
  if (htmlLang && languages.includes(htmlLang)) return htmlLang;

  return defaultLanguage;
}

/**
 * A stable identifier for the site being edited.
 *
 * A real hostname is the identifier. On a developer machine there is nothing
 * stable to use, so a random id is generated once and kept.
 */
export function resolveSiteIdentifier(hostname: string = window.location.hostname): string {
  const isLocal =
    !hostname ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.');

  if (!isLocal) return hostname;

  // Pre-rename installs stored this under the old prefix
  let id = localStorage.getItem('editinplace_site_id') || localStorage.getItem('xtroedge_site_id');

  if (!id) {
    id = randomId();
    localStorage.setItem('editinplace_site_id', id);
  }

  return id;
}
