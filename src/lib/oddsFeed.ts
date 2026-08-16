import type { MmaEvent } from './types';
import { nameScore } from './espn';

/**
 * Odds aren't in any free feed, so they're committed to the repo as
 * `public/odds.json` and published with the site. Hitting "Refresh results"
 * pulls that file, which means new lines can be shipped by pushing a commit —
 * no re-entering anything on the phone.
 */

export interface OddsLine {
  fighter: string;
  moneyline: number;
}

export interface OddsEventFeed {
  espnId?: string;
  name: string;
  source?: string;
  capturedAt?: string;
  lines: OddsLine[];
}

export interface OddsFeed {
  updatedAt?: string;
  events: OddsEventFeed[];
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export async function fetchOddsFeed(): Promise<OddsFeed | null> {
  try {
    const res = await fetch(`${BASE}/odds.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = (await res.json()) as OddsFeed;
    return Array.isArray(json?.events) ? json : null;
  } catch {
    // Offline, or the file isn't published — results still work without it.
    return null;
  }
}

function feedForEvent(feed: OddsFeed, ev: MmaEvent): OddsEventFeed | null {
  return (
    feed.events.find((e) => e.espnId && ev.espnId && e.espnId === ev.espnId) ??
    feed.events.find((e) => e.name.toLowerCase() === ev.name.toLowerCase()) ??
    null
  );
}

/**
 * Writes prices onto the card, matching on fighter name. Fights that already
 * have a result are left alone, and bets keep the price they were struck at,
 * so re-running this can't rewrite history.
 */
export function applyOddsFeed(ev: MmaEvent, feed: OddsFeed): string[] {
  const forEvent = feedForEvent(feed, ev);
  if (!forEvent) return [];

  const changes: string[] = [];
  const taken = new Set<string>();

  for (const line of forEvent.lines) {
    let best: { fightId: string; corner: 'a' | 'b'; score: number } | null = null;

    for (const f of ev.fights) {
      if (f.result) continue;
      for (const corner of ['a', 'b'] as const) {
        const key = `${f.id}:${corner}`;
        if (taken.has(key)) continue;
        const score = nameScore(line.fighter, corner === 'a' ? f.a.name : f.b.name);
        if (score > (best?.score ?? 0)) best = { fightId: f.id, corner, score };
      }
    }

    if (!best || best.score < 0.7) continue;

    const fight = ev.fights.find((f) => f.id === best!.fightId)!;
    const prev = best.corner === 'a' ? fight.oddsA : fight.oddsB;
    if (prev === line.moneyline) {
      taken.add(`${best.fightId}:${best.corner}`);
      continue;
    }

    if (best.corner === 'a') fight.oddsA = line.moneyline;
    else fight.oddsB = line.moneyline;
    taken.add(`${best.fightId}:${best.corner}`);

    const who = best.corner === 'a' ? fight.a.name : fight.b.name;
    const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
    changes.push(
      prev === null
        ? `${who} opened at ${sign(line.moneyline)}`
        : `${who} ${sign(prev)} → ${sign(line.moneyline)}`,
    );
  }

  return changes;
}
