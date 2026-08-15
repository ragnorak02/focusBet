/** American moneyline helpers. All money is play money, rounded to cents. */

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** -285 -> 1.3509, +270 -> 3.70 */
export function toDecimal(american: number): number {
  if (american === 0) return 1;
  return american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
}

/** 3.70 -> +270, 1.35 -> -285 */
export function toAmerican(decimal: number): number {
  if (decimal <= 1) return 0;
  return decimal >= 2
    ? Math.round((decimal - 1) * 100)
    : -Math.round(100 / (decimal - 1));
}

/** Break-even win % the price implies (with vig, not normalized). */
export function impliedProbability(american: number): number {
  return american > 0
    ? 100 / (american + 100)
    : Math.abs(american) / (Math.abs(american) + 100);
}

export function formatAmerican(american: number | null | undefined): string {
  if (american === null || american === undefined || Number.isNaN(american)) return '—';
  return american > 0 ? `+${american}` : `${american}`;
}

export function formatMoney(n: number, opts: { sign?: boolean } = {}): string {
  const v = round2(n);
  const body = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (opts.sign) return `${v < 0 ? '−' : '+'}$${body}`;
  return `${v < 0 ? '−' : ''}$${body}`;
}

/** Combined decimal price of a parlay. Empty list -> 1. */
export function parlayDecimal(americanOdds: number[]): number {
  return americanOdds.reduce((acc, o) => acc * toDecimal(o), 1);
}

/** Total returned (stake included) if the ticket wins. */
export function payout(stake: number, americanOdds: number[]): number {
  return round2(stake * parlayDecimal(americanOdds));
}

export function profitOn(stake: number, americanOdds: number[]): number {
  return round2(payout(stake, americanOdds) - stake);
}

/**
 * Parse a moneyline out of loose text: "+270", "−285" (unicode minus),
 * "-285 ▲", "285" (assumed favorite-less positive). Returns null if absent.
 */
export function parseAmerican(raw: string): number | null {
  const cleaned = raw.replace(/[−–—]/g, '-').replace(/[,\s]/g, '');
  const m = cleaned.match(/([+-]?\d{2,5})/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n === 0) return null;
  // A bare number with no sign in an odds column is a favorite in some feeds,
  // but ambiguous — treat unsigned as positive (underdog) and let the user fix it.
  if (Math.abs(n) < 100) return null;
  return n;
}
