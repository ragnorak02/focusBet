import type { DB, GradedBet, GradedPrediction, MmaEvent } from './types';
import {
  computeBankroll,
  computeEventPnl,
  computePredictionStats,
  computeStats,
  gradeAll,
  gradePredictions,
  type Bankroll,
  type EventPnl,
  type PredictionStats,
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
  /** Called fights, newest first — no money involved. */
  predictions: GradedPrediction[];
  predictionStats: PredictionStats;
}

/** The single payload the client renders from. */
export function buildAppState(db: DB): AppState {
  const bets = gradeAll(db);
  const since = db.statsResetAt ?? null;
  // The bankroll is never scoped — the balance is the balance.
  const inPeriod = (b: GradedBet) => !since || (b.settledAt ?? b.placedAt) >= since;

  const stats = computeStats(db, bets, since);
  const predictions = gradePredictions(db, bets);

  return {
    events: [...db.events].sort((a, b) => b.date.localeCompare(a.date)),
    bets,
    cash: [...db.cash].sort((a, b) => b.at.localeCompare(a.at)),
    bankroll: computeBankroll(db, bets),
    stats,
    allTime: since ? computeStats(db, bets, null) : stats,
    eventPnl: computeEventPnl(db, bets.filter(inPeriod)),
    predictions,
    predictionStats: computePredictionStats(predictions, since),
  };
}
