import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLicenseCache,
  currentLicenseKey,
  fetchLicenseStatus,
  licenseBlockedMessage,
  planFeatures,
  readLicenseCache,
  trialBannerHTML,
  writeLicenseCache,
} from '../src/license';
import { secureSet } from '../src/storage';
import type { EditInPlaceConfig, LicenseStatus } from '../src/types';

const config: EditInPlaceConfig = {
  apiBase: 'https://api.example.com/api',
  licenseKey: 'XTRO-TEST-KEY',
};

const paid: LicenseStatus = {
  valid: true,
  plan: 'paid',
  features: { images: true },
  message: 'License active.',
};

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('currentLicenseKey', () => {
  it('prefers the configured key', () => {
    secureSet('builder_token', 'session-token');
    expect(currentLicenseKey(config)).toBe('XTRO-TEST-KEY');
  });

  it('falls back to the signed-in session token', () => {
    secureSet('builder_token', 'session-token');
    expect(currentLicenseKey({ apiBase: config.apiBase })).toBe('session-token');
  });

  it('is empty when there is neither', () => {
    expect(currentLicenseKey({})).toBe('');
  });
});

describe('license cache', () => {
  it('round-trips a status', () => {
    writeLicenseCache(config, paid);
    expect(readLicenseCache(config)).toEqual(paid);
  });

  it('is empty before anything is written', () => {
    expect(readLicenseCache(config)).toBeNull();
  });

  it('refuses a cache written under a different licence key', () => {
    writeLicenseCache(config, paid);

    // Same browser, different account — serving the old plan would leak it
    const other = { ...config, licenseKey: 'XTRO-SOMEONE-ELSE' };
    expect(readLicenseCache(other)).toBeNull();
  });

  it('expires after 30 minutes', () => {
    writeLicenseCache(config, paid);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);

    expect(readLicenseCache(config)).toBeNull();
  });

  it('still returns an expired entry when the caller ignores the TTL', () => {
    writeLicenseCache(config, paid);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);

    // This is the offline path — a stale plan beats locking the user out
    expect(readLicenseCache(config, true)).toEqual(paid);
  });

  it('is dropped by clearLicenseCache', () => {
    writeLicenseCache(config, paid);
    clearLicenseCache();
    expect(readLicenseCache(config)).toBeNull();
  });
});

describe('planFeatures', () => {
  it('reads the features the server sent', () => {
    expect(planFeatures({ valid: true, plan: 'free', features: { images: false } })).toEqual({
      images: false,
    });
  });

  it('assumes allowed when the server sends no features at all', () => {
    // An older backend predates the free tier. The server still enforces the
    // gate, so guessing "allowed" here cannot unlock anything.
    expect(planFeatures({ valid: true, plan: 'paid' })).toEqual({ images: true });
  });

  it('assumes allowed when there is no status yet', () => {
    expect(planFeatures(null)).toEqual({ images: true });
  });
});

describe('licenseBlockedMessage', () => {
  it('names expiry when the plan has run out', () => {
    expect(licenseBlockedMessage({ valid: false, plan: 'expired' })).toContain('expired');
  });

  it('passes the server message through when there is one', () => {
    const msg = licenseBlockedMessage({
      valid: false,
      plan: 'invalid',
      message: 'This license is not authorized for domain "x.com".',
    });
    expect(msg).toContain('x.com');
  });

  it('falls back to a generic message', () => {
    expect(licenseBlockedMessage(null)).toBe('License validation failed. Editing is disabled.');
  });
});

describe('trialBannerHTML', () => {
  it('says nothing once dismissed', () => {
    expect(trialBannerHTML({ valid: true, plan: 'free' }, true, true)).toBe('');
  });

  it('says nothing without a status', () => {
    expect(trialBannerHTML(null, true, false)).toBe('');
  });

  it('says nothing on a paid plan', () => {
    expect(trialBannerHTML(paid, true, false)).toBe('');
  });

  it('offers the upgrade on a free plan', () => {
    const html = trialBannerHTML({ valid: true, plan: 'free' }, true, false);
    expect(html).toContain('upgrade to edit images');
  });

  it('counts down a trial', () => {
    const html = trialBannerHTML({ valid: true, plan: 'trial', daysLeft: 3 }, true, false);
    expect(html).toContain('3 days remaining');
  });

  it('uses the singular on the last day', () => {
    const html = trialBannerHTML({ valid: true, plan: 'trial', daysLeft: 1 }, true, false);
    expect(html).toContain('1 day remaining');
  });

  it('warns in red when the licence is not valid', () => {
    const html = trialBannerHTML({ valid: false, plan: 'expired' }, false, false);
    expect(html).toContain('Trial expired');
    expect(html).toContain('239,68,68'); // the red used for the danger state
  });
});

describe('fetchLicenseStatus', () => {
  it('refuses when there is no key to check', async () => {
    const status = await fetchLicenseStatus({ apiBase: config.apiBase });

    expect(status.valid).toBe(false);
    expect(status.plan).toBe('invalid');
  });

  it('allows when no validation endpoint is configured', async () => {
    // A site with no licensing set up should still be editable rather than
    // being blocked by a check it never asked for
    const status = await fetchLicenseStatus({ licenseKey: 'K' });
    expect(status.valid).toBe(true);
  });

  it('returns the cached status without calling the network', async () => {
    writeLicenseCache(config, paid);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const status = await fetchLicenseStatus(config);

    expect(status).toEqual(paid);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('asks the server and caches the answer', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => paid,
    } as Response);

    const status = await fetchLicenseStatus(config);

    expect(status).toEqual(paid);
    expect(readLicenseCache(config)).toEqual(paid);
  });

  it('sends the licence key and the current hostname', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => paid,
    } as Response);

    await fetchLicenseStatus(config);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.example.com/api/license/validate');
    expect(JSON.parse(String(init?.body))).toEqual({
      licenseKey: 'XTRO-TEST-KEY',
      domain: window.location.hostname,
    });
  });

  it('falls back to a stale cache when the network fails', async () => {
    writeLicenseCache(config, paid);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 60 * 1000); // cache is past its TTL

    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    expect(await fetchLicenseStatus(config)).toEqual(paid);
  });

  it('refuses when the network fails and nothing is cached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const status = await fetchLicenseStatus(config);

    expect(status.valid).toBe(false);
    expect(status.message).toContain('internet connection');
  });

  it('refuses when the server answers with something that is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    expect((await fetchLicenseStatus(config)).valid).toBe(false);
  });
});
