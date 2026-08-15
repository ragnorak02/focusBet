export type Segment = 'main' | 'prelim' | 'early';

export type FightStatus = 'scheduled' | 'live' | 'final';

/** 'a' / 'b' = that corner won. 'draw' and 'nc' void every bet on the fight. */
export type Outcome = 'a' | 'b' | 'draw' | 'nc';

export type Corner = 'a' | 'b';

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
}

/* ---------- derived (never persisted) ---------- */

export type BetStatus = 'open' | 'won' | 'lost' | 'push' | 'cashed';

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
  /** Combined decimal odds of all non-void legs. */
  decimal: number;
  settledAt: string | null;
}
