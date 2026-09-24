/**
 * Browser-side storage for the editor's session.
 *
 * Everything sensitive lives in one obfuscated localStorage entry rather than
 * a key per value, so a glance at devtools does not read as a list of the
 * editor's secrets. This is obfuscation, not encryption — the key ships in the
 * bundle. The real protection is server side: every token is verified and
 * every gated action is re-checked by the API.
 */

const SCRAMBLE_KEY = 'xTr0EdG3_s3cUr3_k3y!@#2024';
const VAULT_KEY = '_xtd';

/** Prefix used before the project was renamed to EditInPlace. */
const LEGACY_PREFIX = 'xtroedge_';
const CURRENT_PREFIX = 'editinplace_';

function scramble(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    result += String.fromCharCode(value.charCodeAt(i) ^ SCRAMBLE_KEY.charCodeAt(i % SCRAMBLE_KEY.length));
  }
  return btoa(result);
}

function unscramble(encoded: string): string {
  try {
    const decoded = atob(encoded);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ SCRAMBLE_KEY.charCodeAt(i % SCRAMBLE_KEY.length));
    }
    return result;
  } catch {
    return '';
  }
}

function readVault(): Record<string, string> {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return {};
    return JSON.parse(unscramble(raw));
  } catch {
    return {};
  }
}

function writeVault(vault: Record<string, string>): void {
  try {
    localStorage.setItem(VAULT_KEY, scramble(JSON.stringify(vault)));
  } catch {
    /* storage full or blocked */
  }
}

export function secureSet(key: string, value: string): void {
  const vault = readVault();
  vault[key] = value;
  writeVault(vault);
}

export function secureGet(key: string): string {
  const vault = readVault();
  if (vault[key]) return vault[key];

  // Entries written before the rename are still under the old prefix. Reading
  // them through keeps existing users signed in instead of silently logging
  // everyone out on upgrade.
  const legacyKey = key.replace(new RegExp('^' + CURRENT_PREFIX), LEGACY_PREFIX);
  return legacyKey !== key ? vault[legacyKey] || '' : '';
}

export function secureRemove(key: string): void {
  const vault = readVault();
  delete vault[key];
  writeVault(vault);
}

export function secureClear(): void {
  try {
    localStorage.removeItem(VAULT_KEY);
  } catch {
    /* ignore */
  }
}
