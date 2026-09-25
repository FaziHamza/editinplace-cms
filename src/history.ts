import type { EditHistoryEntry } from './types';
import { DB_NAME, STORE_NAME } from './constants';

/**
 * Edit history, kept in the visitor's own browser.
 *
 * This is a local undo trail, not a record the server knows about — it lets an
 * editor walk back through today's changes on this machine. Nothing here is
 * authoritative; losing it costs a convenience, not content.
 */

/** Most recent entries shown in the panel. Older ones stay until the sweep. */
const MAX_ENTRIES = 30;

let cachedDb: IDBDatabase | null = null;

export function openHistoryDB(): Promise<IDBDatabase> {
  if (cachedDb) return Promise.resolve(cachedDb);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('slug', 'slug', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    req.onsuccess = () => {
      cachedDb = req.result;
      resolve(cachedDb);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Drops the cached handle. Used by destroy(), and by tests between cases. */
export function closeHistoryDB(): void {
  cachedDb?.close();
  cachedDb = null;
}

/** The newest entries for one page, most recent first. */
export async function readHistory(slug: string): Promise<EditHistoryEntry[]> {
  try {
    const db = await openHistoryDB();

    return await new Promise<EditHistoryEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).index('slug').getAll(slug);

      req.onsuccess = () =>
        resolve(
          (req.result as EditHistoryEntry[])
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, MAX_ENTRIES)
        );
      req.onerror = () => reject(req.error);
    });
  } catch {
    // History is a convenience — a browser that refuses IndexedDB (private
    // mode, blocked storage) should not stop anyone editing
    return [];
  }
}

/** Human label for an entry, from the element key that changed. */
export function historyLabel(key: string, lang: string): string {
  const isImage = lang === 'img';
  const shortKey = isImage ? key.split('/').pop() || 'image' : key.split('_').pop() || key;
  return isImage ? `Changed ${shortKey}` : `Edited ${shortKey}`;
}

export async function writeHistoryEntry(entry: {
  slug: string;
  key: string;
  lang: string;
  snapshot: string;
}): Promise<void> {
  try {
    const db = await openHistoryDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');

    tx.objectStore(STORE_NAME).add({
      slug: entry.slug,
      timestamp: Date.now(),
      label: historyLabel(entry.key, entry.lang),
      lang: entry.lang,
      snapshot: entry.snapshot,
    });
  } catch {
    /* ignore — see readHistory */
  }
}

/** Removes entries older than the retention window. */
export async function pruneHistory(retentionMs: number): Promise<void> {
  try {
    const db = await openHistoryDB();
    const cutoff = Date.now() - retentionMs;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).index('timestamp').openCursor(IDBKeyRange.upperBound(cutoff));

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  } catch {
    /* ignore */
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats an entry's timestamp for the panel, e.g. `Mar 4, 9:05 PM`.
 *
 * Deliberately not `toLocaleString`: the panel is narrow, and a locale-formatted
 * date wraps unpredictably across the languages the editor supports.
 */
export function formatHistoryDate(timestamp: number): string {
  const d = new Date(timestamp);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;

  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${hour12}:${minutes} ${meridiem}`;
}
