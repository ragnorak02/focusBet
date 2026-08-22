import type { Outcome, Segment } from './types';

/**
 * Tapology blocks server-side requests (Cloudflare, 403 on every UA), so
 * results come from ESPN's public MMA feed instead. Same fights, same finishes,
 * and it updates within a minute or two of the official call.
 */

/**
 * ESPN keys its MMA feed by promotion. UFC and PFL are the two it carries with
 * full cards, per-bout results and records; Bellator and ONE return nothing
 * usable, so they aren't asked for.
 */
const LEAGUES = ['ufc', 'pfl'] as const;

const scoreboard = (league: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/mma/${league}/scoreboard`;

export interface EspnBout {
  espnId: string;
  order: number;
  weightClass: string;
  rounds: number;
  titleFight: boolean;
  segment: Segment;
  a: { name: string; record?: string; country?: string };
  b: { name: string; record?: string; country?: string };
  status: 'scheduled' | 'live' | 'final';
  outcome: Outcome | null;
  method?: string;
  round?: number;
  time?: string;
}

export interface EspnEvent {
  espnId: string;
  name: string;
  date: string;
  venue?: string;
  location?: string;
  bouts: EspnBout[];
}

/** ESPN labels finishes as "Unofficial Winner Kotko" / "... Submission" etc. */
function prettyMethod(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const t = raw.replace(/^Unofficial Winner\s*/i, '').trim();
  const map: Record<string, string> = {
    kotko: 'KO/TKO',
    ko: 'KO',
    tko: 'TKO',
    submission: 'Submission',
    decision: 'Decision',
    dq: 'Disqualification',
  };
  return map[t.toLowerCase().replace(/[^a-z]/g, '')] ?? t;
}

function segmentFor(index: number, total: number): Segment {
  // ESPN lists bout 0 first (card opener). Top 5 are the main card.
  const fromTop = total - index;
  if (fromTop <= 5) return 'main';
  return 'prelim';
}

interface RawCompetitor {
  order?: number;
  winner?: boolean;
  athlete?: { displayName?: string; fullName?: string; flag?: { alt?: string } };
  records?: { summary?: string }[];
}

interface RawCompetition {
  id?: string;
  type?: { abbreviation?: string };
  venue?: { fullName?: string; address?: { city?: string; state?: string; country?: string } };
  competitors?: RawCompetitor[];
  status?: {
    period?: number;
    displayClock?: string;
    type?: { name?: string; completed?: boolean; state?: string };
  };
  details?: { type?: { text?: string } }[];
  format?: { regulation?: { periods?: number } };
}

interface RawEvent {
  id?: string;
  name?: string;
  date?: string;
  competitions?: RawCompetition[];
}

function mapCompetitor(c: RawCompetitor | undefined) {
  return {
    name: c?.athlete?.displayName ?? c?.athlete?.fullName ?? 'TBD',
    record: c?.records?.[0]?.summary,
    country: c?.athlete?.flag?.alt,
  };
}

function mapEvent(ev: RawEvent): EspnEvent {
  const comps = ev.competitions ?? [];
  const venue = comps[0]?.venue;
  const addr = venue?.address;

  const bouts: EspnBout[] = comps.map((c, i) => {
    const competitors = c.competitors ?? [];
    // ESPN's `order` is 1/2 within a bout; index 0 is the red corner.
    const sorted = [...competitors].sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
    const a = sorted[0];
    const b = sorted[1];

    const statusName = c.status?.type?.name ?? '';
    const completed = c.status?.type?.completed === true;
    const state = c.status?.type?.state;
    const status: EspnBout['status'] = completed
      ? 'final'
      : state === 'in' || statusName === 'STATUS_IN_PROGRESS'
        ? 'live'
        : 'scheduled';

    const methodText = (c.details ?? [])
      .map((d) => d.type?.text ?? '')
      .find((t) => /Unofficial Winner|Decision|Draw|No Contest/i.test(t));

    let outcome: Outcome | null = null;
    if (completed) {
      if (/no contest/i.test(methodText ?? '')) outcome = 'nc';
      else if (/draw/i.test(methodText ?? '')) outcome = 'draw';
      else if (a?.winner) outcome = 'a';
      else if (b?.winner) outcome = 'b';
      else outcome = 'draw'; // finished with nobody flagged as winner
    }

    const rounds = c.format?.regulation?.periods ?? 3;

    return {
      espnId: c.id ?? `${ev.id}-${i}`,
      // Card opener is bout #1; the main event gets the highest number.
      order: i + 1,
      weightClass: c.type?.abbreviation ?? 'Catchweight',
      rounds,
      // 5-round non-main-event bouts are title fights.
      titleFight: rounds === 5,
      segment: segmentFor(i, comps.length),
      a: mapCompetitor(a),
      b: mapCompetitor(b),
      status,
      outcome,
      method: completed ? prettyMethod(methodText) : undefined,
      round: completed ? c.status?.period : undefined,
      time: completed ? c.status?.displayClock : undefined,
    };
  });

  return {
    espnId: String(ev.id ?? ''),
    name: ev.name ?? 'MMA Event',
    date: ev.date ?? new Date().toISOString(),
    venue: venue?.fullName,
    location: [addr?.city, addr?.state ?? addr?.country].filter(Boolean).join(', ') || undefined,
    bouts,
  };
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ESPN returned ${res.status}`);
  return res.json();
}

/**
 * Events on ESPN's current scoreboard (today / this week), across every
 * promotion. One promotion failing doesn't take the others down.
 */
export async function fetchScoreboard(dates?: string): Promise<EspnEvent[]> {
  const perLeague = await Promise.all(
    LEAGUES.map(async (league) => {
      const base = scoreboard(league);
      const url = dates ? `${base}?dates=${encodeURIComponent(dates)}` : base;
      try {
        const json = (await getJson(url)) as { events?: RawEvent[] };
        return (json.events ?? []).map(mapEvent);
      } catch {
        return [];
      }
    }),
  );

  const byId = new Map<string, EspnEvent>();
  for (const ev of perLeague.flat()) byId.set(ev.espnId, ev);
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** One event by ESPN id, searched across a window of recent/upcoming dates. */
export async function fetchEvent(espnId: string): Promise<EspnEvent | null> {
  const direct = await fetchScoreboard();
  const hit = direct.find((e) => e.espnId === espnId);
  if (hit) return hit;

  // Fall back to a date-range sweep — the scoreboard only shows "now".
  const now = new Date();
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const from = new Date(now.getTime() - 45 * 864e5);
  const to = new Date(now.getTime() + 45 * 864e5);

  const ranged = await fetchScoreboard(`${fmt(from)}-${fmt(to)}`);
  return ranged.find((e) => e.espnId === espnId) ?? null;
}

/* ---------- name matching ---------- */

export function normalizeName(s: string): string {
  return s
    // NFD splits accents into combining marks, which the a-z filter below then
    // drops: "Joel Álvarez" -> "joel alvarez", "Kauê" -> "kaue".
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lastName(s: string): string {
  const parts = normalizeName(s).split(' ');
  return parts[parts.length - 1] ?? '';
}

/** 0 = no match, 1 = exact. Surname agreement is the strong signal. */
export function nameScore(x: string, y: string): number {
  const a = normalizeName(x);
  const b = normalizeName(y);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const la = lastName(x);
  const lb = lastName(y);
  if (la && la === lb) return 0.8;
  const at = new Set(a.split(' '));
  const bt = new Set(b.split(' '));
  const shared = [...at].filter((t) => bt.has(t) && t.length > 2).length;
  if (shared >= 1) return 0.5 + 0.1 * shared;
  return 0;
}

/**
 * Match a local fight to an ESPN bout. Corners can be swapped between sources,
 * so this reports whether the pairing is flipped.
 */
export function matchBout(
  local: { a: { name: string }; b: { name: string } },
  bouts: EspnBout[],
): { bout: EspnBout; flipped: boolean; score: number } | null {
  let best: { bout: EspnBout; flipped: boolean; score: number } | null = null;

  for (const bout of bouts) {
    const straight = (nameScore(local.a.name, bout.a.name) + nameScore(local.b.name, bout.b.name)) / 2;
    const flipped = (nameScore(local.a.name, bout.b.name) + nameScore(local.b.name, bout.a.name)) / 2;
    const score = Math.max(straight, flipped);
    if (score > (best?.score ?? 0)) {
      best = { bout, flipped: flipped > straight, score };
    }
  }

  // Both corners have to land, otherwise we'd grade the wrong fight.
  return best && best.score >= 0.75 ? best : null;
}
