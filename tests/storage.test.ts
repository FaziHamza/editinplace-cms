import { beforeEach, describe, expect, it } from 'vitest';
import { secureClear, secureGet, secureRemove, secureSet } from '../src/storage';

/** The single localStorage entry every value is packed into. */
const VAULT_KEY = '_xtd';

beforeEach(() => {
  localStorage.clear();
});

describe('secure storage', () => {
  it('round-trips a value', () => {
    secureSet('builder_token', 'abc123');
    expect(secureGet('builder_token')).toBe('abc123');
  });

  it('returns an empty string for a key that was never set', () => {
    expect(secureGet('nothing_here')).toBe('');
  });

  it('keeps several values in one vault entry', () => {
    secureSet('a', '1');
    secureSet('b', '2');

    expect(secureGet('a')).toBe('1');
    expect(secureGet('b')).toBe('2');
    expect(Object.keys(localStorage)).toEqual([VAULT_KEY]);
  });

  it('overwrites an existing value', () => {
    secureSet('token', 'old');
    secureSet('token', 'new');
    expect(secureGet('token')).toBe('new');
  });

  it('removes one value without touching the rest', () => {
    secureSet('keep', 'yes');
    secureSet('drop', 'no');

    secureRemove('drop');

    expect(secureGet('drop')).toBe('');
    expect(secureGet('keep')).toBe('yes');
  });

  it('clears everything', () => {
    secureSet('a', '1');
    secureClear();

    expect(secureGet('a')).toBe('');
    expect(localStorage.getItem(VAULT_KEY)).toBeNull();
  });

  it('does not store values in readable form', () => {
    secureSet('builder_token', 'super-secret-value');

    const raw = localStorage.getItem(VAULT_KEY) ?? '';
    expect(raw).not.toContain('super-secret-value');
    expect(raw).not.toContain('builder_token');
  });

  it('survives a corrupted vault instead of throwing', () => {
    localStorage.setItem(VAULT_KEY, 'not-valid-base64-or-json!!');

    expect(() => secureGet('anything')).not.toThrow();
    expect(secureGet('anything')).toBe('');
  });
});

describe('legacy keys from before the rename', () => {
  it('reads an editinplace_ key through to its xtroedge_ predecessor', () => {
    // Written by a version of the library that predates the rename
    secureSet('xtroedge_site_id', 'site-42');

    expect(secureGet('editinplace_site_id')).toBe('site-42');
  });

  it('prefers the current key when both exist', () => {
    secureSet('xtroedge_site_id', 'old');
    secureSet('editinplace_site_id', 'new');

    expect(secureGet('editinplace_site_id')).toBe('new');
  });

  it('does not invent a fallback for keys without the prefix', () => {
    secureSet('xtroedge_builder_token', 'should-not-be-found');

    expect(secureGet('builder_token')).toBe('');
  });
});
