import { promises as fs } from 'fs';
import path from 'path';
import type { DB } from './types';
import { seedDb } from './seed';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

/**
 * Single-user app, so a JSON file is plenty. Writes are serialized through one
 * promise chain and go via a temp file + rename so a crash mid-write can't
 * leave a truncated bankroll behind.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

async function readRaw(): Promise<DB> {
  try {
    const text = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(text) as DB;
    return {
      version: parsed.version ?? 1,
      events: parsed.events ?? [],
      bets: parsed.bets ?? [],
      cash: parsed.cash ?? [],
    };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      const fresh = seedDb();
      await writeRaw(fresh);
      return fresh;
    }
    throw err;
  }
}

async function writeRaw(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_PATH);
}

export function readDb(): Promise<DB> {
  return enqueue(readRaw);
}

/** Read-modify-write under the same queue, so concurrent actions can't clobber. */
export function updateDb<T>(
  mutator: (db: DB) => T | Promise<T>,
): Promise<{ db: DB; result: T }> {
  return enqueue(async () => {
    const db = await readRaw();
    const result = await mutator(db);
    await writeRaw(db);
    return { db, result };
  });
}

export function resetDb(): Promise<DB> {
  return enqueue(async () => {
    const fresh = seedDb();
    await writeRaw(fresh);
    return fresh;
  });
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
