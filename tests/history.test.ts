import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeHistoryDB,
  formatHistoryDate,
  historyLabel,
  openHistoryDB,
  pruneHistory,
  readHistory,
  writeHistoryEntry,
} from '../src/history';
import { DB_NAME, STORE_NAME } from '../src/constants';

/** Waits for a write transaction to settle — IndexedDB writes are not awaited. */
async function settled() {
  const db = await openHistoryDB();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    tx.oncomplete = () => resolve();
    tx.objectStore(STORE_NAME).count();
  });
}

beforeEach(async () => {
  closeHistoryDB();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  closeHistoryDB();
});

describe('opening the database', () => {
  it('creates the store and its indexes', async () => {
    const db = await openHistoryDB();

    expect(db.objectStoreNames.contains(STORE_NAME)).toBe(true);

    const tx = db.transaction(STORE_NAME, 'readonly');
    const names = Array.from(tx.objectStore(STORE_NAME).indexNames);
    expect(names).toContain('slug');
    expect(names).toContain('timestamp');
  });

  it('reuses the same handle', async () => {
    expect(await openHistoryDB()).toBe(await openHistoryDB());
  });
});

describe('reading and writing entries', () => {
  it('returns nothing for a page with no history', async () => {
    expect(await readHistory('/about')).toEqual([]);
  });

  it('stores an entry and reads it back', async () => {
    await writeHistoryEntry({
      slug: '/about',
      key: 'xcms_h1_1',
      lang: 'en',
      snapshot: '{"texts":{}}',
    });
    await settled();

    const [entry] = await readHistory('/about');
    expect(entry.slug).toBe('/about');
    expect(entry.lang).toBe('en');
    expect(entry.snapshot).toBe('{"texts":{}}');
  });

  it('keeps pages apart', async () => {
    await writeHistoryEntry({ slug: '/a', key: 'k', lang: 'en', snapshot: '1' });
    await writeHistoryEntry({ slug: '/b', key: 'k', lang: 'en', snapshot: '2' });
    await settled();

    expect(await readHistory('/a')).toHaveLength(1);
    expect(await readHistory('/b')).toHaveLength(1);
  });

  it('returns the newest first', async () => {
    // Only the clock is faked, never the timers: fake-indexeddb settles its
    // transactions on real async scheduling and would hang otherwise.
    const now = vi.spyOn(Date, 'now');

    now.mockReturnValue(Date.parse('2026-01-01T10:00:00Z'));
    await writeHistoryEntry({ slug: '/p', key: 'old', lang: 'en', snapshot: 'old' });
    now.mockReturnValue(Date.parse('2026-01-01T12:00:00Z'));
    await writeHistoryEntry({ slug: '/p', key: 'new', lang: 'en', snapshot: 'new' });

    now.mockRestore();
    await settled();

    const entries = await readHistory('/p');
    expect(entries.map((e) => e.snapshot)).toEqual(['new', 'old']);
  });

  it('caps the list at 30 entries', async () => {
    for (let i = 0; i < 35; i++) {
      await writeHistoryEntry({ slug: '/p', key: `k${i}`, lang: 'en', snapshot: String(i) });
    }
    await settled();

    expect(await readHistory('/p')).toHaveLength(30);
  });
});

describe('pruning', () => {
  it('drops entries older than the retention window and keeps the rest', async () => {
    const now = vi.spyOn(Date, 'now');

    now.mockReturnValue(Date.parse('2026-01-01T00:00:00Z'));
    await writeHistoryEntry({ slug: '/p', key: 'ancient', lang: 'en', snapshot: 'ancient' });

    now.mockReturnValue(Date.parse('2026-01-10T00:00:00Z'));
    await writeHistoryEntry({ slug: '/p', key: 'recent', lang: 'en', snapshot: 'recent' });
    await settled();

    // Now: 11 Jan. A 7-day window should leave only the 10 Jan entry.
    now.mockReturnValue(Date.parse('2026-01-11T00:00:00Z'));
    await pruneHistory(7 * 24 * 60 * 60 * 1000);

    now.mockRestore();
    await settled();

    const entries = await readHistory('/p');
    expect(entries.map((e) => e.snapshot)).toEqual(['recent']);
  });
});

describe('historyLabel', () => {
  it('describes a text edit by the tail of the key', () => {
    expect(historyLabel('section_xcms_h1_1', 'en')).toBe('Edited 1');
  });

  it('falls back to the whole key when there is nothing to split on', () => {
    expect(historyLabel('heading', 'en')).toBe('Edited heading');
  });

  it('describes an image change by its file name', () => {
    expect(historyLabel('/images/hero.jpg', 'img')).toBe('Changed hero.jpg');
  });
});

describe('formatHistoryDate', () => {
  it('formats an afternoon time in 12-hour form', () => {
    expect(formatHistoryDate(new Date(2026, 2, 4, 21, 5).getTime())).toBe('Mar 4, 9:05 PM');
  });

  it('shows midnight as 12 AM rather than 0', () => {
    expect(formatHistoryDate(new Date(2026, 0, 1, 0, 7).getTime())).toBe('Jan 1, 12:07 AM');
  });

  it('shows midday as 12 PM', () => {
    expect(formatHistoryDate(new Date(2026, 11, 25, 12, 0).getTime())).toBe('Dec 25, 12:00 PM');
  });
});
