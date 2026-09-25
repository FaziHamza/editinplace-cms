/** Where edit history is kept in the browser. */
export const DB_NAME = 'editinplace_history';
export const STORE_NAME = 'history';

/**
 * Tags the editor makes editable when `editableTags` is not configured.
 *
 * Deliberately text-bearing elements only — inputs, media and structural
 * wrappers are left alone so the scan does not fight the host page.
 */
export const DEFAULT_EDITABLE_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'b', 'strong', 'i', 'em',
  'a', 'button', 'li', 'label', 'small', 'blockquote', 'td', 'th',
  'div', 'header', 'footer',
];

/**
 * The hosted EditInPlace API, used when `apiBase` is not configured.
 *
 * Set `apiBase` to your own server to point the editor elsewhere, or to an
 * empty string to run with no backend at all — see the demo page.
 */
export const DEFAULT_API_BASE = 'https://backend-xi-lime-d90e4p1ysf.vercel.app/api';
