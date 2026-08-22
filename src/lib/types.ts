export type Segment = 'main' | 'prelim' | 'early';

export type FightStatus = 'scheduled' | 'live' | 'final';

/** 'a' / 'b' = that corner won. 'draw' and 'nc' void every bet on the fight. */
export type Outcome = 'a' | 'b' | 'draw' | 'nc';

export type Corner = 'a' | 'b';

/**
 * How a fight can end. `ko` covers KO/TKO **and disqualification**, which is
 * how books group it ("KO/TKO/DQ").
 */
export type Method = 'ko' | 'sub' | 'dec';

export type Market = 'moneyline' | 'method' | 'draw' | 'total' | 'spread';

/**
 * Prices for one fighter's ways to win. The `koSub`/`koDec`/`subDec` fields are
 * the book's own double-chance numbers; when absent they're derived from the
 * three singles instead.
 */
export interface MethodOdds {
  ko: number | null;
  sub: number | null;
  dec: number | null;
  koSub?: number | null;
  koDec?: number | null;
  subDec?: number | null;
}

/** Over/under on how long the fight lasts, in rounds (e.g. 1.5, 4.5). */
export interface TotalRounds {
  line: number;
  over: number | null;
  under: number | null;
}

/**
 * Handicap on the judges' total scorecard points. `line` is the absolute
 * number and `favorite` is the corner giving it away, so a line of 9.5 with
 * favorite 'a' means A −9.5 / B +9.5.
 */
export interface Spread {
  line: number;
  favorite: Corner;
  oddsA: number | null;
  oddsB: number | null;
}

export interface Fighter {
  name: string;
  record?: string;
  country?: string;
}

export interface FightResult {
  outcome: Outcome;
  /** "KO/TKO", "Submission", "Decision - Unanimous", ... */
  method?: string;
  round?: number;
  /** "3:20" */
  time?: string;
  /**
   * Judges' total scorecard points, summed across all three judges. Only a
   * decision has these, and the spread market can't settle without them.
   */
  scoreA?: number;
  scoreB?: number;
  gradedAt: string;
  source: 'manual' | 'espn';
}

export interface Fight {
  id: string;
  /** Bout number as shown on the card. Higher = later = closer to the main event. */
  order: number;
  segment: Segment;
  weightClass: string;
  titleFight: boolean;
  rounds: number;
  a: Fighter;
  b: Fighter;
  /** American moneyline, e.g. -285 / +270. null = odds not entered yet. */
  oddsA: number | null;
  oddsB: number | null;
  /** Method-of-victory prices. Absent until a book's numbers are entered. */
  methodA?: MethodOdds | null;
  methodB?: MethodOdds | null;
  /** Price on the fight being scored a draw. */
  drawOdds?: number | null;
  totalRounds?: TotalRounds | null;
  spread?: Spread | null;
  status: FightStatus;
  result: FightResult | null;
  espnId?: string;
}

export interface MmaEvent {
  id: string;
  name: string;
  /** ISO datetime of the first bout. */
  date: string;
  venue?: string;
  location?: string;
  espnId?: string;
  fights: Fight[];
  createdAt: string;
}

export type LegStatus = 'open' | 'won' | 'lost' | 'void';

export interface Leg {
  eventId: string;
  fightId: string;
  pick: Corner;
  /** Absent on tickets placed before method markets existed — treat as moneyline. */
  market?: Market;
  /**
   * Which finishes cash this leg, for `market: 'method'`. One entry is a
   * straight method bet; two is a double chance (e.g. KO or Submission).
   */
  methods?: Method[];
  /** Which way, for `market: 'total'`. */
  side?: 'over' | 'under';
  /** The handicap or total this leg was struck against. */
  line?: number;
  /** American odds locked in at placement — never re-read from the fight. */
  odds: number;
  fighterName: string;
  opponentName: string;
  eventName: string;
}

export interface Bet {
  id: string;
  placedAt: string;
  stake: number;
  legs: Leg[];
  /** Manual early settlement. Overrides derived grading. */
  cashOut?: { at: string; amount: number };
}

/**
 * A called fight with no money on it. Kept apart from bets on purpose: the
 * point is to see how well you read a card without the stake changing what you
 * pick. One per fight, changeable right up until the fight starts.
 */
export interface Prediction {
  eventId: string;
  fightId: string;
  pick: Corner;
  at: string;
  /** Set when the call was changed before the fight went off. */
  updatedAt?: string;
}

export type CashType = 'deposit' | 'withdraw';

export interface CashTxn {
  id: string;
  at: string;
  type: CashType;
  amount: number;
  note?: string;
}

export interface DB {
  version: number;
  events: MmaEvent[];
  bets: Bet[];
  cash: CashTxn[];
  predictions?: Prediction[];
  /**
   * Start of the current tracking period. Stats are measured from here, so
   * changing how you bet can be measured against the change rather than
   * against everything you've ever done. Nothing is deleted when it moves —
   * clearing it puts the whole history back.
   */
  statsResetAt?: string | null;
}

/* ---------- derived (never persisted) ---------- */

export type BetStatus = 'open' | 'won' | 'lost' | 'push' | 'cashed';

/** 'void' is a draw, a no contest, or a fight that no longer exists. */
export type PredictionStatus = 'open' | 'correct' | 'wrong' | 'void';

export interface GradedPrediction extends Prediction {
  status: PredictionStatus;
  fight: Fight | null;
  eventName: string;
  fighterName: string;
  opponentName: string;
  /** The pick's moneyline, so a call on an underdog can be told apart. */
  odds: number | null;
  settledAt: string | null;
  /** Whether a bet was also placed on this fight. */
  backed: boolean;
}

export interface GradedLeg extends Leg {
  status: LegStatus;
  fight: Fight | null;
}

export interface GradedBet extends Bet {
  legs: GradedLeg[];
  status: BetStatus;
  isParlay: boolean;
  /** Total returned to bankroll (stake + profit) once settled. 0 while open/lost. */
  returned: number;
  /** Stake + profit if every open leg wins. */
  potentialReturn: number;
  /** potentialReturn - stake */
  potentialProfit: number;
  /** returned - stake once settled, else 0. */
  profit: number;
  /**
   * What the ticket would have done had it been left alone — the same grading
   * with the cash out ignored. On anything not cashed out this is just
   * `status` / `returned`.
   */
  naturalStatus: BetStatus;
  naturalReturn: number;
  /** Combined decimal odds of all non-void legs. */
  decimal: number;
  settledAt: string | null;
}
