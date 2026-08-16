import type {
  Corner,
  Fight,
  FightResult,
  Leg,
  Method,
  MethodOdds,
} from './types';
import { impliedProbability, formatAmerican, probabilityToAmerican } from './odds';

/**
 * The non-moneyline markets, laid out the way DraftKings does:
 *
 * - **Method of victory** — KO/TKO/DQ, submission or decision. DQ rides with
 *   KO/TKO, which is the book's grouping, not ours.
 * - **Double chance** — any two of those three. Books price these explicitly,
 *   so the book's number wins; we only derive one when it's missing.
 * - **Draw**
 * - **Total rounds** — over/under on how long the fight lasts.
 * - **Point spread** — a handicap on the judges' total scorecard points.
 */

export const METHOD_LABEL: Record<Method, string> = {
  ko: 'KO/TKO/DQ',
  sub: 'Submission',
  dec: 'Decision',
};

export const METHOD_SHORT: Record<Method, string> = {
  ko: 'KO',
  sub: 'Sub',
  dec: 'Dec',
};

export const SINGLE_METHODS: Method[] = ['ko', 'sub', 'dec'];

/** Listed in the order DraftKings shows them. */
export const DOUBLE_CHANCE: Method[][] = [
  ['ko', 'dec'],
  ['ko', 'sub'],
  ['sub', 'dec'],
];

type PairKey = 'koSub' | 'koDec' | 'subDec';

const PAIR_KEY: Record<string, PairKey> = {
  'ko/sub': 'koSub',
  'ko/dec': 'koDec',
  'sub/dec': 'subDec',
};

/**
 * Canonical ko → sub → dec ordering. Sorting alphabetically instead would turn
 * ['ko','dec'] into 'dec/ko', miss the table, and quietly hand back the wrong
 * market's price.
 */
export function pairKeyFor(methods: Method[]): PairKey | null {
  if (methods.length !== 2) return null;
  const ordered = SINGLE_METHODS.filter((m) => methods.includes(m));
  if (ordered.length !== 2) return null;
  return PAIR_KEY[ordered.join('/')] ?? null;
}

export function methodsLabel(methods: Method[]): string {
  if (methods.length === 1) return METHOD_LABEL[methods[0]];
  return methods.map((m) => METHOD_SHORT[m]).join(' or ');
}

export function methodOddsFor(fight: Fight, corner: Corner): MethodOdds | null {
  return (corner === 'a' ? fight.methodA : fight.methodB) ?? null;
}

/**
 * Price for a set of methods. Singles read straight off the book. Pairs prefer
 * the book's own double-chance number and fall back to adding the two implied
 * probabilities — which is roughly how a book builds one, though never exactly:
 * DraftKings prices these as their own market, so the derived figure is only a
 * stand-in until the real one is entered.
 */
export function priceForMethods(
  odds: MethodOdds | null,
  methods: Method[],
): number | null {
  if (!odds || methods.length === 0) return null;

  if (methods.length === 1) return odds[methods[0]] ?? null;

  const key = pairKeyFor(methods);
  if (key) {
    const explicit = odds[key];
    if (explicit !== null && explicit !== undefined) return explicit;
  }

  const parts: number[] = [];
  for (const m of methods) {
    const price = odds[m];
    if (price === null || price === undefined) return null;
    parts.push(price);
  }
  return probabilityToAmerican(
    parts.reduce((sum, p) => sum + impliedProbability(p), 0),
  );
}

/** True when a pair price came from the book rather than being derived. */
export function isExplicitPair(odds: MethodOdds | null, methods: Method[]): boolean {
  if (!odds) return false;
  const key = pairKeyFor(methods);
  return key ? odds[key] !== null && odds[key] !== undefined : false;
}

export function hasMethodMarkets(fight: Fight): boolean {
  const any = (o: MethodOdds | null | undefined) =>
    Boolean(o && (o.ko !== null || o.sub !== null || o.dec !== null));
  return any(fight.methodA) || any(fight.methodB) || fight.drawOdds != null;
}

export function hasAnyExtraMarket(fight: Fight): boolean {
  return (
    hasMethodMarkets(fight) ||
    Boolean(fight.totalRounds) ||
    Boolean(fight.spread)
  );
}

/**
 * Bucket a recorded finish. Disqualifications count as KO/TKO here, matching
 * the book's "KO/TKO/DQ" market.
 */
export function classifyMethod(method: string | undefined): Method | 'unknown' {
  if (!method) return 'unknown';
  const m = method.toLowerCase();
  if (m.includes('sub')) return 'sub';
  if (m.includes('dec')) return 'dec';
  if (
    m.includes('ko') ||
    m.includes('tko') ||
    m.includes('disqualif') ||
    m.includes('dq') ||
    m.includes('doctor') ||
    m.includes('stoppage') ||
    m.includes('retire') ||
    m.includes('corner')
  ) {
    return 'ko';
  }
  return 'unknown';
}

export function isDecision(result: FightResult): boolean {
  return classifyMethod(result.method) === 'dec';
}

/**
 * Seconds of fight time elapsed. A decision is the full scheduled distance;
 * a finish is the completed rounds plus the clock in the final one.
 * Returns null when there isn't enough detail to say.
 */
export function elapsedSeconds(fight: Fight, result: FightResult): number | null {
  if (isDecision(result)) return fight.rounds * 300;
  if (!result.round) return null;

  const raw = result.time ?? '5:00';
  const [mins, secs] = raw.split(':').map((n) => Number(n));
  if (!Number.isFinite(mins)) return null;

  return (result.round - 1) * 300 + mins * 60 + (Number.isFinite(secs) ? secs : 0);
}

/** Total-rounds line expressed in seconds (1.5 rounds = 7:30). */
export function totalLineSeconds(line: number): number {
  return line * 300;
}

export function formatTotalLine(line: number, side: 'over' | 'under'): string {
  return `${side === 'over' ? 'O' : 'U'} ${line}`;
}

/** Signed handicap for a corner: −9.5 for the favourite, +9.5 for the dog. */
export function spreadFor(fight: Fight, corner: Corner): number | null {
  if (!fight.spread) return null;
  return fight.spread.favorite === corner ? -fight.spread.line : fight.spread.line;
}

export function formatSpread(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

/** What a leg needs, in words, for slips and tickets. */
export function legLabel(leg: Leg): string | null {
  switch (leg.market ?? 'moneyline') {
    case 'method':
      return leg.methods?.length ? `by ${methodsLabel(leg.methods)}` : null;
    case 'draw':
      return 'Draw';
    case 'total':
      return leg.line != null && leg.side
        ? `${leg.side === 'over' ? 'Over' : 'Under'} ${leg.line} rounds`
        : null;
    case 'spread':
      return leg.line != null ? `${formatSpread(leg.line)} on the cards` : null;
    default:
      return null;
  }
}

/** Headline for a slip row, since totals and draws aren't about one fighter. */
export function legTitle(leg: Leg): string {
  const market = leg.market ?? 'moneyline';
  if (market === 'draw') return 'Draw';
  if (market === 'total') {
    return `${leg.fighterName} vs ${leg.opponentName}`;
  }
  return leg.fighterName;
}

export function priceLabel(price: number | null): string {
  return formatAmerican(price);
}
