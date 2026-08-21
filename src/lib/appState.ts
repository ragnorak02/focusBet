import type { DB, GradedBet, MmaEvent } from './types';
import {
  computeBankroll,
  computeEventPnl,
  computeStats,
  gradeAll,
  type Bankroll,
  type EventPnl,
  type Stats,
} from './engine';

export interface AppState {
  events: MmaEvent[];
  bets: GradedBet[];
  cash: DB['cash'];
  bankroll: Bankroll;
  /** Scoped to the current tracking period; see `DB.statsResetAt`. */
  stats: Stats;
  /** The same numbers over everything ever bet, whatever the period is. */
  allTime: Stats;
  eventPnl: EventPnl[];
}

/** The single payload the client renders from. */
export function buildAppState(db: DB): AppState {
  const bets = gradeAll(db);
  const since = db.statsResetAt ?? null;
  // The bankroll is never scoped — the balance is the balance.
  const inPeriod = (b: GradedBet) => !since || (b.settledAt ?? b.placedAt) >= since;

  const stats = computeStats(db, bets, since);

  return {
    events: [...db.events].sort((a, b) => b.date.localeCompare(a.date)),
    bets,
    cash: [...db.cash].sort((a, b) => b.at.localeCompare(a.at)),
    bankroll: computeBankroll(db, bets),
    stats,
    allTime: since ? computeStats(db, bets, null) : stats,
    eventPnl: computeEventPnl(db, bets.filter(inPeriod)),
  };
}
