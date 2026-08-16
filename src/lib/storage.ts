import type { DB } from './types';
import { seedDb } from './seed';

const KEY = 'focusbet.db.v1';

/**
 * The app is a static site, so the browser is the database. Everything lives
 * under one localStorage key; nothing is sent anywhere except the public
 * results feed.
 */

export function loadDb(): DB {
  if (typeof window === 'undefined') return seedDb();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return seedDb();
    const parsed = JSON.parse(raw) as Partial<DB>;
    return {
      version: parsed.version ?? 1,
      events: parsed.events ?? [],
      bets: parsed.bets ?? [],
      cash: parsed.cash ?? [],
    };
  } catch {
    // Corrupt or unreadable — start clean rather than crashing the app.
    return seedDb();
  }
}

export function saveDb(db: DB): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota or private mode — the session still works, it just won't persist */
  }
}

export function exportDb(db: DB): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `focusbet-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readFileAsJson(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read that file'));
    fr.onload = () => {
      try {
        resolve(JSON.parse(String(fr.result)));
      } catch {
        reject(new Error('That file is not valid JSON'));
      }
    };
    fr.readAsText(file);
  });
}
