import type {
  Bet,
  BetStatus,
  DB,
  Fight,
  GradedBet,
  GradedLeg,
  GradedPrediction,
  Leg,
  LegStatus,
  MmaEvent,
  PredictionStatus,
} from './types';
import { parlayDecimal, round2 } from './odds';
import {
  classifyMethod,
  elapsedSeconds,
  isDecision,
  totalLineSeconds,
} from './markets';

/**
 * Nothing about settlement is stored. Bet status, payouts and the bankroll are
 * all recomputed from (cash txns + stakes + fight results) on every read, so
 * clearing a fight result automatically unwinds every bet it touched.
 */

export function findFight(
  events: MmaEvent[],
  eventId: string,
  fightId: string,
): { event: MmaEvent; fight: Fight } | null {
  const event = events.find((e) => e.id === eventId);
  if (!event) return null;
  const fight = event.fights.find((f) => f.id === fightId);
  if (!fight) return null;
  return { event, fight };
}

export function gradeLeg(leg: Leg, fight: Fight | null): LegStatus {
  // Fight (or event) deleted out from under the bet — void the leg rather than
  // silently losing the user's money.
  if (!fight) return 'void';
  const r = fight.result;
  if (!r) return 'open';

  // Legs saved before these markets existed have no `market` field and are
  // moneyline by definition.
  const market = leg.market ?? 'moneyline';

  // A no contest wipes every market on the fight.
  if (r.outcome === 'nc') return 'void';

  if (market === 'draw') return r.outcome === 'draw' ? 'won' : 'lost';

  if (market === 'total') {
    const elapsed = elapsedSeconds(fight, r);
    if (elapsed === null || leg.line == null) return 'void';
    const target = totalLineSeconds(leg.line);
    if (elapsed === target) return 'void'; // exact push, only on whole lines
    const wentOver = elapsed > target;
    return (leg.side === 'over') === wentOver ? 'won' : 'lost';
  }

  if (market === 'spread') {
    // Nothing to handicap without judges' scorecards.
    if (!isDecision(r)) return 'void';
    if (r.scoreA == null || r.scoreB == null || leg.line == null) return 'open';
    const margin =
      leg.pick === 'a' ? r.scoreA - r.scoreB : r.scoreB - r.scoreA;
    const adjusted = margin + leg.line;
    if (adjusted === 0) return 'void';
    return adjusted > 0 ? 'won' : 'lost';
  }

  // Everything below is a bet on one fighter winning.
  if (r.outcome === 'draw') return 'void';
  if (r.outcome !== leg.pick) return 'lost';
  if (market === 'moneyline' || !leg.methods?.length) return 'won';

  const actual = classifyMethod(r.method);
  // Finished in a way we can't categorise — refund rather than take the stake.
  if (actual === 'unknown') return 'void';
  return leg.methods.includes(actual) ? 'won' : 'lost';
}

export function gradeBet(bet: Bet, events: MmaEvent[]): GradedBet {
  const legs: GradedLeg[] = bet.legs.map((leg) => {
    const found = findFight(events, leg.eventId, leg.fightId);
    const fight = found?.fight ?? null;
    return { ...leg, fight, status: gradeLeg(leg, fight) };
  });

  const live = legs.filter((l) => l.status !== 'void');
  const anyLost = live.some((l) => l.status === 'lost');
  const anyOpen = live.some((l) => l.status === 'open');

  // Voided legs drop out of the price entirely (standard parlay rule).
  const decimal = parlayDecimal(live.map((l) => l.odds));
  const potentialReturn = round2(bet.stake * decimal);

  // How the ticket grades on the fights alone, before any early settlement.
  // Cashing out hides that, and hiding it is exactly what makes the habit hard
  // to see, so it's kept alongside the real status rather than thrown away.
  let naturalStatus: BetStatus;
  if (anyLost) naturalStatus = 'lost';
  else if (anyOpen) naturalStatus = 'open';
  else if (live.length === 0) naturalStatus = 'push'; // every leg voided
  else naturalStatus = 'won';

  const naturalReturn =
    naturalStatus === 'won'
      ? potentialReturn
      : naturalStatus === 'push'
        ? round2(bet.stake)
        : 0;

  const status: BetStatus = bet.cashOut ? 'cashed' : naturalStatus;

  let returned = 0;
  if (status === 'cashed') returned = round2(bet.cashOut!.amount);
  else returned = naturalReturn;

  const settledAt =
    status === 'cashed'
      ? bet.cashOut!.at
      : status === 'open'
        ? null
        : latestGradedAt(legs) ?? bet.placedAt;

  return {
    ...bet,
    legs,
    status,
    isParlay: bet.legs.length > 1,
    decimal,
    potentialReturn,
    potentialProfit: round2(potentialReturn - bet.stake),
    returned,
    profit: status === 'open' ? 0 : round2(returned - bet.stake),
    naturalStatus,
    naturalReturn,
    settledAt,
  };
}

function latestGradedAt(legs: GradedLeg[]): string | null {
  const times = legs
    .map((l) => l.fight?.result?.gradedAt)
    .filter((t): t is string => Boolean(t))
    .sort();
  return times.length ? times[times.length - 1] : null;
}

export function gradeAll(db: DB): GradedBet[] {
  return db.bets
    .map((b) => gradeBet(b, db.events))
    .sort((x, y) => y.placedAt.localeCompare(x.placedAt));
}

/* ---------- predictions ---------- */

/**
 * Picks settle on the moneyline and nothing else: the fighter won, or they
 * didn't. A draw, a no contest, or a fight that has been deleted voids the
 * call rather than scoring it against you.
 */
export function gradePredictions(db: DB, graded: GradedBet[]): GradedPrediction[] {
  const bettedFights = new Set(
    graded.flatMap((b) => b.legs.map((l) => `${l.eventId}:${l.fightId}`)),
  );

  return (db.predictions ?? [])
    .map((p) => {
      const found = findFight(db.events, p.eventId, p.fightId);
      const fight = found?.fight ?? null;
      const r = fight?.result ?? null;

      let status: PredictionStatus;
      if (!fight) status = 'void';
      else if (!r) status = 'open';
      else if (r.outcome === 'draw' || r.outcome === 'nc') status = 'void';
      else status = r.outcome === p.pick ? 'correct' : 'wrong';

      const fighter = fight ? (p.pick === 'a' ? fight.a : fight.b) : null;
      const opponent = fight ? (p.pick === 'a' ? fight.b : fight.a) : null;

      return {
        ...p,
        fight,
        status,
        eventName: found?.event.name ?? 'Deleted card',
        fighterName: fighter?.name ?? 'Deleted fight',
        opponentName: opponent?.name ?? '',
        odds: fight ? (p.pick === 'a' ? fight.oddsA : fight.oddsB) : null,
        settledAt: status === 'open' ? null : (r?.gradedAt ?? null),
        backed: bettedFights.has(`${p.eventId}:${p.fightId}`),
      };
    })
    .sort((x, y) => y.at.localeCompare(x.at));
}

export interface PredictionStats {
  total: number;
  open: number;
  settled: number;
  correct: number;
  wrong: number;
  void: number;
  /** Correct as a share of settled calls; draws and no contests don't count. */
  accuracy: number;
  /** Split by whether the book had the pick as the favourite. */
  favorites: { correct: number; total: number };
  underdogs: { correct: number; total: number };
  /** Settled calls you also had money on. */
  backed: number;
  /** Correct calls you had no money on — the ones that got away. */
  missedWinners: number;
  currentStreak: { type: 'W' | 'L' | null; count: number };
}

export function computePredictionStats(
  predictions: GradedPrediction[],
  since: string | null = null,
): PredictionStats {
  const inPeriod = (p: GradedPrediction) => !since || (p.settledAt ?? p.at) >= since;
  const scoped = predictions.filter(inPeriod);
  const settled = scoped.filter((p) => p.status === 'correct' || p.status === 'wrong');

  const side = (favorite: boolean) => {
    const set = settled.filter((p) =>
      p.odds === null ? false : favorite ? p.odds < 0 : p.odds > 0,
    );
    return {
      correct: set.filter((p) => p.status === 'correct').length,
      total: set.length,
    };
  };

  // Newest first, so the streak reads straight off the front of the list.
  const chrono = [...settled].sort((a, b) =>
    (b.settledAt ?? b.at).localeCompare(a.settledAt ?? a.at),
  );
  let currentStreak: PredictionStats['currentStreak'] = { type: null, count: 0 };
  for (const p of chrono) {
    const t = p.status === 'correct' ? 'W' : 'L';
    if (currentStreak.type === null) currentStreak = { type: t, count: 1 };
    else if (currentStreak.type === t) currentStreak.count++;
    else break;
  }

  const correct = settled.filter((p) => p.status === 'correct');

  return {
    total: scoped.length,
    open: scoped.filter((p) => p.status === 'open').length,
    settled: settled.length,
    correct: correct.length,
    wrong: settled.length - correct.length,
    void: scoped.filter((p) => p.status === 'void').length,
    accuracy: settled.length ? correct.length / settled.length : 0,
    favorites: side(true),
    underdogs: side(false),
    backed: settled.filter((p) => p.backed).length,
    missedWinners: correct.filter((p) => !p.backed).length,
    currentStreak,
  };
}

export interface Bankroll {
  balance: number;
  deposited: number;
  withdrawn: number;
  /** Stake currently tied up in open tickets. */
  exposure: number;
  /** What open tickets return if they all hit. */
  potentialReturn: number;
}

export function computeBankroll(db: DB, graded: GradedBet[]): Bankroll {
  const deposited = db.cash
    .filter((c) => c.type === 'deposit')
    .reduce((s, c) => s + c.amount, 0);
  const withdrawn = db.cash
    .filter((c) => c.type === 'withdraw')
    .reduce((s, c) => s + c.amount, 0);

  const staked = graded.reduce((s, b) => s + b.stake, 0);
  const returned = graded.reduce((s, b) => s + b.returned, 0);

  const open = graded.filter((b) => b.status === 'open');

  return {
    balance: round2(deposited - withdrawn - staked + returned),
    deposited: round2(deposited),
    withdrawn: round2(withdrawn),
    exposure: round2(open.reduce((s, b) => s + b.stake, 0)),
    potentialReturn: round2(open.reduce((s, b) => s + b.potentialReturn, 0)),
  };
}

/**
 * What cashing out has actually done. Every cashed ticket is also graded as if
 * it had been left alone, so "I take the money too early" stops being a hunch
 * and becomes a number.
 */
export interface CashOutStats {
  /** Tickets settled early. */
  count: number;
  /** Share of every settled ticket that was cashed out. */
  rate: number;
  staked: number;
  /** Sum of the offers taken. */
  taken: number;
  /** taken - staked. */
  profit: number;
  /** Of those, how many have since had every fight finish. */
  resolved: number;
  wouldHaveWon: number;
  wouldHaveLost: number;
  /** What the resolved ones would have paid if they'd been left alone. */
  wouldHaveReturned: number;
  /** Taken minus that. Positive means cashing out was the better call. */
  delta: number;
  /** Cashed tickets whose fights haven't all happened yet. */
  pending: number;
}

export interface Stats {
  settled: number;
  won: number;
  lost: number;
  push: number;
  cashed: number;
  open: number;
  winRate: number;
  totalStaked: number;
  totalReturned: number;
  netProfit: number;
  roi: number;
  biggestWin: GradedBet | null;
  biggestLoss: GradedBet | null;
  longestWinStreak: number;
  currentStreak: { type: 'W' | 'L' | null; count: number };
  legRecord: { won: number; lost: number; void: number };
  singles: { won: number; lost: number; profit: number };
  parlays: { won: number; lost: number; profit: number };
  cashOut: CashOutStats;
  /** Bankroll after each money event, oldest first. For the chart. */
  history: { at: string; balance: number; label: string }[];
  /** Start of the period these numbers cover, or null for all time. */
  since: string | null;
  /**
   * Where break-even sits: everything deposited, or — inside a tracking
   * period — the balance the period opened at.
   */
  baseline: number;
}

function cashOutStats(scoped: GradedBet[], settledCount: number): CashOutStats {
  const cashed = scoped.filter((b) => b.status === 'cashed');
  const resolved = cashed.filter((b) => b.naturalStatus !== 'open');

  const taken = round2(cashed.reduce((s, b) => s + b.returned, 0));
  const staked = round2(cashed.reduce((s, b) => s + b.stake, 0));
  const wouldHaveReturned = round2(resolved.reduce((s, b) => s + b.naturalReturn, 0));
  const takenOnResolved = round2(resolved.reduce((s, b) => s + b.returned, 0));

  return {
    count: cashed.length,
    rate: settledCount ? cashed.length / settledCount : 0,
    staked,
    taken,
    profit: round2(taken - staked),
    resolved: resolved.length,
    wouldHaveWon: resolved.filter((b) => b.naturalStatus === 'won').length,
    wouldHaveLost: resolved.filter((b) => b.naturalStatus === 'lost').length,
    wouldHaveReturned,
    delta: round2(takenOnResolved - wouldHaveReturned),
    pending: cashed.length - resolved.length,
  };
}

/**
 * `since` scopes everything except the open-ticket count to one tracking
 * period — a bet belongs to the period it settled in. Pass null for all time.
 */
export function computeStats(db: DB, graded: GradedBet[], since: string | null = null): Stats {
  const inPeriod = (b: GradedBet) => !since || (b.settledAt ?? b.placedAt) >= since;
  const scoped = graded.filter(inPeriod);
  const settled = scoped.filter((b) => b.status !== 'open');
  const won = settled.filter((b) => b.status === 'won');
  const lost = settled.filter((b) => b.status === 'lost');
  const push = settled.filter((b) => b.status === 'push');
  const cashed = settled.filter((b) => b.status === 'cashed');

  const totalStaked = round2(settled.reduce((s, b) => s + b.stake, 0));
  const totalReturned = round2(settled.reduce((s, b) => s + b.returned, 0));
  const netProfit = round2(totalReturned - totalStaked);

  // Pushes are a wash — exclude them from win rate.
  const decisive = won.length + lost.length;

  const legStatuses = scoped.flatMap((b) => b.legs.map((l) => l.status));

  const bySide = (parlay: boolean) => {
    const set = settled.filter((b) => b.isParlay === parlay);
    return {
      won: set.filter((b) => b.status === 'won').length,
      lost: set.filter((b) => b.status === 'lost').length,
      profit: round2(set.reduce((s, b) => s + b.profit, 0)),
    };
  };

  // Chronological settlement order drives streaks and the bankroll curve.
  const chrono = [...settled].sort((a, b) =>
    (a.settledAt ?? a.placedAt).localeCompare(b.settledAt ?? b.placedAt),
  );

  let longest = 0;
  let run = 0;
  for (const b of chrono) {
    if (b.status === 'won') longest = Math.max(longest, ++run);
    else if (b.status === 'lost') run = 0;
  }

  let currentStreak: Stats['currentStreak'] = { type: null, count: 0 };
  for (let i = chrono.length - 1; i >= 0; i--) {
    const s = chrono[i].status;
    if (s !== 'won' && s !== 'lost') continue;
    const t = s === 'won' ? 'W' : 'L';
    if (currentStreak.type === null) currentStreak = { type: t, count: 1 };
    else if (currentStreak.type === t) currentStreak.count++;
    else break;
  }

  return {
    settled: settled.length,
    won: won.length,
    lost: lost.length,
    push: push.length,
    cashed: cashed.length,
    // Open tickets are a present-tense fact, so they aren't scoped to a period.
    open: graded.filter((b) => b.status === 'open').length,
    winRate: decisive ? won.length / decisive : 0,
    totalStaked,
    totalReturned,
    netProfit,
    roi: totalStaked ? netProfit / totalStaked : 0,
    biggestWin:
      won.length || cashed.length
        ? [...won, ...cashed].reduce((m, b) => (b.profit > m.profit ? b : m))
        : null,
    biggestLoss: lost.length
      ? lost.reduce((m, b) => (b.stake > m.stake ? b : m))
      : null,
    longestWinStreak: longest,
    currentStreak,
    legRecord: {
      won: legStatuses.filter((s) => s === 'won').length,
      lost: legStatuses.filter((s) => s === 'lost').length,
      void: legStatuses.filter((s) => s === 'void').length,
    },
    singles: bySide(false),
    parlays: bySide(true),
    cashOut: cashOutStats(scoped, settled.length),
    ...periodCurve(db, graded, since),
    since,
  };
}

/**
 * The curve, and where break-even sits on it. Balances are absolute, so a
 * period is a slice of the whole history rather than a fresh run from zero —
 * the line picks up exactly where the last period left it.
 */
function periodCurve(
  db: DB,
  graded: GradedBet[],
  since: string | null,
): Pick<Stats, 'history' | 'baseline'> {
  const full = buildHistory(db, graded);
  if (!since) {
    const deposited = db.cash
      .filter((c) => c.type === 'deposit')
      .reduce((s, c) => s + c.amount, 0);
    return { history: full, baseline: round2(deposited) };
  }
  const before = full.filter((p) => p.at < since);
  return {
    history: full.filter((p) => p.at >= since),
    baseline: before.length ? before[before.length - 1].balance : 0,
  };
}

function buildHistory(db: DB, graded: GradedBet[]): Stats['history'] {
  type Ev = { at: string; delta: number; label: string };
  const evs: Ev[] = [];

  for (const c of db.cash) {
    evs.push({
      at: c.at,
      delta: c.type === 'deposit' ? c.amount : -c.amount,
      label: c.type === 'deposit' ? 'Deposit' : 'Cash out',
    });
  }
  for (const b of graded) {
    evs.push({ at: b.placedAt, delta: -b.stake, label: 'Bet placed' });
    if (b.status !== 'open' && b.returned !== 0) {
      evs.push({
        at: b.settledAt ?? b.placedAt,
        delta: b.returned,
        label: b.status === 'won' ? 'Bet won' : b.status === 'push' ? 'Push refund' : 'Cash out',
      });
    }
  }

  evs.sort((a, b) => a.at.localeCompare(b.at));

  let bal = 0;
  return evs.map((e) => {
    bal = round2(bal + e.delta);
    return { at: e.at, balance: bal, label: e.label };
  });
}

/** Per-event P&L, newest event first. */
export interface EventPnl {
  eventId: string;
  name: string;
  date: string;
  staked: number;
  returned: number;
  profit: number;
  bets: number;
}

export function computeEventPnl(db: DB, graded: GradedBet[]): EventPnl[] {
  const rows = new Map<string, EventPnl>();
  for (const b of graded) {
    if (b.status === 'open') continue;
    // A parlay spanning events is credited to the event of its first leg.
    const eventId = b.legs[0]?.eventId;
    if (!eventId) continue;
    const ev = db.events.find((e) => e.id === eventId);
    const row =
      rows.get(eventId) ??
      {
        eventId,
        name: ev?.name ?? b.legs[0].eventName,
        date: ev?.date ?? b.placedAt,
        staked: 0,
        returned: 0,
        profit: 0,
        bets: 0,
      };
    row.staked = round2(row.staked + b.stake);
    row.returned = round2(row.returned + b.returned);
    row.profit = round2(row.returned - row.staked);
    row.bets++;
    rows.set(eventId, row);
  }
  return [...rows.values()].sort((a, b) => b.date.localeCompare(a.date));
}
