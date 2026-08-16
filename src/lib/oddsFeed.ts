import type { MethodOdds, MmaEvent } from './types';
import { nameScore } from './espn';

/**
 * Odds aren't in any free feed, so they're committed to the repo as
 * `public/odds.json` and published with the site. Hitting "Refresh results"
 * pulls that file, which means new lines can be shipped by pushing a commit —
 * no re-entering anything on the phone.
 */

export interface OddsLine {
  fighter: string;
  moneyline?: number;
  /** Method of victory. `ko` is the book's KO/TKO/DQ bucket. */
  ko?: number;
  sub?: number;
  dec?: number;
  /** The book's own double-chance prices. */
  koSub?: number;
  koDec?: number;
  subDec?: number;
  /** Signed handicap for this fighter on the judges' cards, e.g. -9.5. */
  spread?: number;
  spreadOdds?: number;
  /** Fight-level markets, accepted on whichever fighter's line carries them. */
  draw?: number;
  totalLine?: number;
  over?: number;
  under?: number;
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
    taken.add(`${best.fightId}:${best.corner}`);

    const who = best.corner === 'a' ? fight.a.name : fight.b.name;
    const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

    if (line.moneyline !== undefined) {
      const prev = best.corner === 'a' ? fight.oddsA : fight.oddsB;
      if (prev !== line.moneyline) {
        if (best.corner === 'a') fight.oddsA = line.moneyline;
        else fight.oddsB = line.moneyline;
        changes.push(
          prev === null
            ? `${who} opened at ${sign(line.moneyline)}`
            : `${who} ${sign(prev)} → ${sign(line.moneyline)}`,
        );
      }
    }

    // Method prices are replaced wholesale rather than merged, so a line the
    // book has pulled disappears here too.
    const METHOD_KEYS = ['ko', 'sub', 'dec', 'koSub', 'koDec', 'subDec'] as const;
    if (METHOD_KEYS.some((k) => line[k] !== undefined)) {
      const next: MethodOdds = {
        ko: line.ko ?? null,
        sub: line.sub ?? null,
        dec: line.dec ?? null,
        koSub: line.koSub ?? null,
        koDec: line.koDec ?? null,
        subDec: line.subDec ?? null,
      };
      const prev = best.corner === 'a' ? fight.methodA : fight.methodB;
      const changed = !prev || METHOD_KEYS.some((k) => (prev[k] ?? null) !== next[k]);
      if (changed) {
        if (best.corner === 'a') fight.methodA = next;
        else fight.methodB = next;
        const parts = (['ko', 'sub', 'dec'] as const)
          .filter((k) => next[k] !== null)
          .map((k) => `${k.toUpperCase()} ${sign(next[k] as number)}`);
        changes.push(`${who} method: ${parts.join(', ')}`);
      }
    }

    if (line.spread !== undefined && line.spreadOdds !== undefined) {
      const magnitude = Math.abs(line.spread);
      const favorite: 'a' | 'b' =
        line.spread < 0 ? best.corner : best.corner === 'a' ? 'b' : 'a';
      const prev = fight.spread;
      const next = {
        line: magnitude,
        favorite,
        oddsA: best.corner === 'a' ? line.spreadOdds : (prev?.oddsA ?? null),
        oddsB: best.corner === 'b' ? line.spreadOdds : (prev?.oddsB ?? null),
      };
      const changed =
        !prev ||
        prev.line !== next.line ||
        prev.favorite !== next.favorite ||
        prev.oddsA !== next.oddsA ||
        prev.oddsB !== next.oddsB;
      fight.spread = next;
      if (changed) {
        changes.push(
          `${who} spread ${line.spread > 0 ? '+' : ''}${line.spread} ${sign(line.spreadOdds)}`,
        );
      }
    }

    // Draw and totals belong to the fight, not a corner, so they're accepted
    // from whichever line happens to carry them.
    if (line.draw !== undefined && fight.drawOdds !== line.draw) {
      fight.drawOdds = line.draw;
      changes.push(`${fight.a.name} vs ${fight.b.name} draw ${sign(line.draw)}`);
    }

    if (line.totalLine !== undefined) {
      const prev = fight.totalRounds;
      const next = {
        line: line.totalLine,
        over: line.over ?? prev?.over ?? null,
        under: line.under ?? prev?.under ?? null,
      };
      const changed =
        !prev || prev.line !== next.line || prev.over !== next.over || prev.under !== next.under;
      fight.totalRounds = next;
      if (changed) {
        changes.push(
          `${fight.a.name} vs ${fight.b.name} total ${next.line} ` +
            `(O ${next.over === null ? '—' : sign(next.over)} / U ${next.under === null ? '—' : sign(next.under)})`,
        );
      }
    }
  }

  return changes;
}
