import type { Corner, Fight, Leg, Method, MethodOdds } from './types';
import { impliedProbability, probabilityToAmerican } from './odds';

/**
 * Method-of-victory markets: a fighter to win specifically by KO/TKO,
 * submission or decision, plus the "double chance" pairs (KO or Sub, and so on).
 */

export const METHOD_LABEL: Record<Method, string> = {
  ko: 'KO/TKO',
  sub: 'Submission',
  dec: 'Decision',
};

export const METHOD_SHORT: Record<Method, string> = {
  ko: 'KO',
  sub: 'Sub',
  dec: 'Dec',
};

export const SINGLE_METHODS: Method[] = ['ko', 'sub', 'dec'];

/** The three double-chance pairs, in the order DraftKings lists them. */
export const DOUBLE_CHANCE: Method[][] = [
  ['ko', 'sub'],
  ['ko', 'dec'],
  ['sub', 'dec'],
];

export function methodsLabel(methods: Method[]): string {
  if (methods.length === 1) return METHOD_LABEL[methods[0]];
  return methods.map((m) => METHOD_SHORT[m]).join(' or ');
}

/** Short description of what a leg needs, for slips and tickets. */
export function legLabel(leg: Leg): string | null {
  if ((leg.market ?? 'moneyline') === 'moneyline') return null;
  if (!leg.methods?.length) return null;
  return `by ${methodsLabel(leg.methods)}`;
}

export function methodOddsFor(fight: Fight, corner: Corner): MethodOdds | null {
  return (corner === 'a' ? fight.methodA : fight.methodB) ?? null;
}

/**
 * Price for a set of methods. A single method reads straight off the book's
 * numbers; a pair is derived by adding the implied probabilities, which is how
 * a book builds a double chance (and keeps the vig from both legs).
 * Returns null when any component has no line.
 */
export function priceForMethods(
  odds: MethodOdds | null,
  methods: Method[],
): number | null {
  if (!odds || methods.length === 0) return null;

  const prices: number[] = [];
  for (const m of methods) {
    const price = odds[m];
    if (price === null || price === undefined) return null;
    prices.push(price);
  }

  if (prices.length === 1) return prices[0];

  const combined = prices.reduce((sum, p) => sum + impliedProbability(p), 0);
  return probabilityToAmerican(combined);
}

/** True once a fight has any method line at all, so the UI can offer the market. */
export function hasMethodMarkets(fight: Fight): boolean {
  const any = (o: MethodOdds | null | undefined) =>
    Boolean(o && (o.ko !== null || o.sub !== null || o.dec !== null));
  return any(fight.methodA) || any(fight.methodB);
}

/**
 * Bucket a recorded result method into one of the three markets.
 * Doctor stoppages are TKOs. Anything else (a DQ, say) is 'other' and cashes
 * no method bet.
 */
export function classifyMethod(method: string | undefined): Method | 'other' {
  if (!method) return 'other';
  const m = method.toLowerCase();
  if (m.includes('disqualif') || m.includes('dq')) return 'other';
  if (m.includes('sub')) return 'sub';
  if (m.includes('dec')) return 'dec';
  if (m.includes('ko') || m.includes('tko') || m.includes('doctor') || m.includes('stoppage')) {
    return 'ko';
  }
  return 'other';
}
