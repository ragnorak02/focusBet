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
  stats: Stats;
  eventPnl: EventPnl[];
}

/** The single payload the client renders from. */
export function buildAppState(db: DB): AppState {
  const bets = gradeAll(db);
  return {
    events: [...db.events].sort((a, b) => b.date.localeCompare(a.date)),
    bets,
    cash: [...db.cash].sort((a, b) => b.at.localeCompare(a.at)),
    bankroll: computeBankroll(db, bets),
    stats: computeStats(db, bets),
    eventPnl: computeEventPnl(db, bets),
  };
}
