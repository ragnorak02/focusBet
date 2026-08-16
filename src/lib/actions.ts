import type {
  Corner,
  DB,
  Fight,
  Market,
  Method,
  MethodOdds,
  MmaEvent,
  Outcome,
  Segment,
} from './types';
import { methodOddsFor, methodsLabel, priceForMethods } from './markets';
import { computeBankroll, gradeAll, gradeBet } from './engine';
import { round2 } from './odds';
import { fetchEvent, fetchScoreboard, matchBout, type EspnEvent } from './espn';
import { applyOddsFeed, fetchOddsFeed } from './oddsFeed';
import { seedDb } from './seed';

/**
 * Every mutation the app can make, as one pure-ish reducer. It runs in the
 * browser (the app is a static site with localStorage for storage), so this is
 * the only place that writes to the DB.
 */

export class ActionError extends Error {}

function bad(msg: string): never {
  throw new ActionError(msg);
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function num(v: unknown, field: string): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) bad(`${field} must be a number`);
  return n;
}

function money(v: unknown, field: string): number {
  const n = round2(num(v, field));
  if (n <= 0) bad(`${field} must be greater than 0`);
  return n;
}

function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) bad(`${field} is required`);
  return v.trim();
}

function requireEvent(db: DB, id: unknown): MmaEvent {
  const ev = db.events.find((e) => e.id === id);
  if (!ev) bad('Event not found');
  return ev;
}

function requireFight(ev: MmaEvent, id: unknown): Fight {
  const f = ev.fights.find((x) => x.id === id);
  if (!f) bad('Fight not found');
  return f;
}

function balanceOf(db: DB): number {
  return computeBankroll(db, gradeAll(db)).balance;
}

function applyEspnToEvent(ev: MmaEvent, remote: EspnEvent): string[] {
  const changes: string[] = [];
  const now = new Date().toISOString();

  for (const fight of ev.fights) {
    const match = matchBout(fight, remote.bouts);
    if (!match) continue;
    const { bout, flipped } = match;

    fight.espnId = bout.espnId;
    if (fight.status !== bout.status) fight.status = bout.status;
    if (!bout.outcome) continue;

    // Corner order can differ between sources; flip so it lands on our fighter.
    let outcome: Outcome = bout.outcome;
    if (flipped && (outcome === 'a' || outcome === 'b')) {
      outcome = outcome === 'a' ? 'b' : 'a';
    }

    const unchanged =
      fight.result &&
      fight.result.outcome === outcome &&
      fight.result.round === bout.round &&
      fight.result.time === bout.time;
    if (unchanged) continue;

    // Never silently overwrite something graded by hand.
    if (fight.result?.source === 'manual') {
      changes.push(`${fight.a.name} vs ${fight.b.name}: kept your manual result`);
      continue;
    }

    fight.result = {
      outcome,
      method: bout.method,
      round: bout.round,
      time: bout.time,
      gradedAt: now,
      source: 'espn',
    };
    fight.status = 'final';

    const winner = outcome === 'a' ? fight.a.name : outcome === 'b' ? fight.b.name : null;
    const loser = outcome === 'a' ? fight.b.name : fight.a.name;
    changes.push(
      winner
        ? `${winner} def. ${loser}` +
            (bout.method
              ? ` (${bout.method}${bout.round ? `, R${bout.round} ${bout.time ?? ''}` : ''})`
              : '')
        : `${fight.a.name} vs ${fight.b.name}: ${outcome === 'nc' ? 'No Contest' : 'Draw'}`,
    );
  }

  return changes;
}

function espnToFights(remote: EspnEvent): Fight[] {
  return remote.bouts
    .map((b) => ({
      id: newId('ft'),
      order: b.order,
      segment: b.segment as Segment,
      weightClass: b.weightClass,
      titleFight: b.titleFight,
      rounds: b.rounds,
      a: { name: b.a.name, record: b.a.record, country: b.a.country },
      b: { name: b.b.name, record: b.b.record, country: b.b.country },
      oddsA: null,
      oddsB: null,
      status: b.status,
      espnId: b.espnId,
      result: b.outcome
        ? {
            outcome: b.outcome,
            method: b.method,
            round: b.round,
            time: b.time,
            gradedAt: new Date().toISOString(),
            source: 'espn' as const,
          }
        : null,
    }))
    .sort((x, y) => y.order - x.order);
}

export interface ActionOutcome {
  db: DB;
  message?: string;
  eventId?: string;
  changes?: string[];
}

/**
 * Returns a NEW db; the input is never mutated. Throws ActionError for
 * anything the user can fix (bad amount, insufficient funds, ...).
 */
export async function applyAction(
  input: DB,
  type: string,
  p: Record<string, unknown> = {},
): Promise<ActionOutcome> {
  if (type === 'resetAll') {
    return { db: seedDb(), message: 'Everything reset' };
  }
  if (type === 'replaceAll') {
    const next = p.db as DB;
    if (!next || !Array.isArray(next.events) || !Array.isArray(next.bets)) {
      bad('That file does not look like a focusBet backup');
    }
    return {
      db: {
        version: next.version ?? 1,
        events: next.events,
        bets: next.bets,
        cash: next.cash ?? [],
      },
      message: 'Backup restored',
    };
  }

  const db: DB = structuredClone(input);
  let message: string | undefined;
  let eventId: string | undefined;
  let changes: string[] | undefined;

  switch (type) {
    case 'deposit': {
      const amount = money(p.amount, 'Amount');
      db.cash.push({
        id: newId('cash'),
        at: new Date().toISOString(),
        type: 'deposit',
        amount,
        note: typeof p.note === 'string' ? p.note : undefined,
      });
      message = `Deposited $${amount.toFixed(2)}`;
      break;
    }

    case 'withdraw': {
      const amount = money(p.amount, 'Amount');
      const bal = balanceOf(db);
      if (amount > bal) bad(`Can't cash out $${amount.toFixed(2)} — balance is $${bal.toFixed(2)}`);
      db.cash.push({
        id: newId('cash'),
        at: new Date().toISOString(),
        type: 'withdraw',
        amount,
        note: typeof p.note === 'string' ? p.note : undefined,
      });
      message = `Cashed out $${amount.toFixed(2)}`;
      break;
    }

    case 'placeBet': {
      const stake = money(p.stake, 'Stake');
      const rawLegs = Array.isArray(p.legs) ? p.legs : bad('No selections');
      if (rawLegs.length === 0) bad('No selections');

      const legs = rawLegs.map((raw) => {
        const l = raw as {
          eventId?: string;
          fightId?: string;
          pick?: Corner;
          market?: Market;
          methods?: Method[];
        };
        const ev = requireEvent(db, l.eventId);
        const fight = requireFight(ev, l.fightId);
        if (l.pick !== 'a' && l.pick !== 'b') bad('Invalid selection');
        if (fight.result) bad(`${fight.a.name} vs ${fight.b.name} has already finished`);

        const who = l.pick === 'a' ? fight.a.name : fight.b.name;
        const market: Market = l.market === 'method' ? 'method' : 'moneyline';

        let odds: number | null | undefined;
        let methods: Method[] | undefined;

        if (market === 'method') {
          methods = (l.methods ?? []).filter((m): m is Method =>
            m === 'ko' || m === 'sub' || m === 'dec',
          );
          if (methods.length === 0) bad('No finish selected');
          if (methods.length > 2) bad('A double chance covers at most two finishes');
          // Recomputed from the card, never trusted from the caller.
          odds = priceForMethods(methodOddsFor(fight, l.pick), methods);
          if (odds === null || odds === undefined) {
            bad(`No line for ${who} by ${methodsLabel(methods)}`);
          }
        } else {
          odds = l.pick === 'a' ? fight.oddsA : fight.oddsB;
          if (odds === null || odds === undefined) bad(`No odds entered for ${who}`);
        }

        return {
          eventId: ev.id,
          fightId: fight.id,
          pick: l.pick,
          market,
          methods,
          odds,
          fighterName: who,
          opponentName: l.pick === 'a' ? fight.b.name : fight.a.name,
          eventName: ev.name,
        };
      });

      // Both corners of one fight would be a guaranteed-loss parlay.
      const seen = new Set<string>();
      for (const l of legs) {
        const key = `${l.eventId}:${l.fightId}`;
        if (seen.has(key)) bad('Same fight can only appear once on a parlay');
        seen.add(key);
      }

      const bal = balanceOf(db);
      if (stake > bal) bad(`Not enough funds — balance is $${bal.toFixed(2)}`);

      const bet = { id: newId('bet'), placedAt: new Date().toISOString(), stake, legs };
      db.bets.push(bet);
      const graded = gradeBet(bet, db.events);
      message =
        legs.length > 1
          ? `${legs.length}-leg parlay placed — $${stake.toFixed(2)} to win $${graded.potentialProfit.toFixed(2)}`
          : `Bet placed — $${stake.toFixed(2)} to win $${graded.potentialProfit.toFixed(2)}`;
      break;
    }

    case 'cashOutBet': {
      const bet = db.bets.find((b) => b.id === p.betId);
      if (!bet) bad('Bet not found');
      if (bet.cashOut) bad('Already cashed out');
      if (gradeBet(bet, db.events).status !== 'open') bad('Only open bets can be cashed out');
      const amount = money(p.amount, 'Amount');
      bet.cashOut = { at: new Date().toISOString(), amount };
      message = `Cashed out for $${amount.toFixed(2)}`;
      break;
    }

    case 'deleteBet': {
      const i = db.bets.findIndex((b) => b.id === p.betId);
      if (i < 0) bad('Bet not found');
      db.bets.splice(i, 1);
      message = 'Bet deleted';
      break;
    }

    case 'gradeFight': {
      const ev = requireEvent(db, p.eventId);
      const fight = requireFight(ev, p.fightId);
      const outcome = p.outcome as Outcome;
      if (!['a', 'b', 'draw', 'nc'].includes(outcome)) bad('Invalid outcome');
      fight.result = {
        outcome,
        method: typeof p.method === 'string' && p.method ? p.method : undefined,
        round: p.round ? num(p.round, 'Round') : undefined,
        time: typeof p.time === 'string' && p.time ? p.time : undefined,
        gradedAt: new Date().toISOString(),
        source: 'manual',
      };
      fight.status = 'final';
      message = 'Result saved';
      break;
    }

    case 'clearResult': {
      const ev = requireEvent(db, p.eventId);
      const fight = requireFight(ev, p.fightId);
      fight.result = null;
      fight.status = 'scheduled';
      message = 'Result cleared — bets reopened';
      break;
    }

    case 'setFightStatus': {
      const ev = requireEvent(db, p.eventId);
      const fight = requireFight(ev, p.fightId);
      const s = p.status;
      if (s !== 'scheduled' && s !== 'live' && s !== 'final') bad('Invalid status');
      fight.status = s;
      break;
    }

    case 'setOdds': {
      const ev = requireEvent(db, p.eventId);
      const fight = requireFight(ev, p.fightId);
      fight.oddsA = p.oddsA === null || p.oddsA === '' ? null : num(p.oddsA, 'Odds');
      fight.oddsB = p.oddsB === null || p.oddsB === '' ? null : num(p.oddsB, 'Odds');
      message = 'Odds updated';
      break;
    }

    case 'setMethodOdds': {
      const ev = requireEvent(db, p.eventId);
      const fight = requireFight(ev, p.fightId);
      const corner = p.corner;
      if (corner !== 'a' && corner !== 'b') bad('Invalid corner');

      const parse = (v: unknown, field: string): number | null =>
        v === null || v === undefined || v === '' ? null : num(v, field);

      const next: MethodOdds = {
        ko: parse(p.ko, 'KO price'),
        sub: parse(p.sub, 'Submission price'),
        dec: parse(p.dec, 'Decision price'),
      };
      const empty = next.ko === null && next.sub === null && next.dec === null;

      if (corner === 'a') fight.methodA = empty ? null : next;
      else fight.methodB = empty ? null : next;

      message = empty ? 'Method lines cleared' : 'Method lines updated';
      break;
    }

    case 'bulkSetOdds': {
      const ev = requireEvent(db, p.eventId);
      const updates = Array.isArray(p.updates) ? p.updates : bad('No odds to apply');
      let n = 0;
      for (const raw of updates) {
        const u = raw as { fightId?: string; oddsA?: number | null; oddsB?: number | null };
        const fight = ev.fights.find((f) => f.id === u.fightId);
        if (!fight) continue;
        if (u.oddsA !== undefined) fight.oddsA = u.oddsA;
        if (u.oddsB !== undefined) fight.oddsB = u.oddsB;
        n++;
      }
      message = `Odds applied to ${n} fight${n === 1 ? '' : 's'}`;
      break;
    }

    case 'updateFight': {
      const ev = requireEvent(db, p.eventId);
      const fight = requireFight(ev, p.fightId);
      if (typeof p.aName === 'string') fight.a.name = p.aName.trim();
      if (typeof p.bName === 'string') fight.b.name = p.bName.trim();
      if (typeof p.aRecord === 'string') fight.a.record = p.aRecord.trim() || undefined;
      if (typeof p.bRecord === 'string') fight.b.record = p.bRecord.trim() || undefined;
      if (typeof p.weightClass === 'string') fight.weightClass = p.weightClass.trim();
      if (typeof p.segment === 'string') fight.segment = p.segment as Segment;
      if (typeof p.titleFight === 'boolean') fight.titleFight = p.titleFight;
      if (p.rounds !== undefined) fight.rounds = num(p.rounds, 'Rounds');
      if (p.order !== undefined) fight.order = num(p.order, 'Bout number');
      if (p.oddsA !== undefined) fight.oddsA = p.oddsA === null ? null : num(p.oddsA, 'Odds');
      if (p.oddsB !== undefined) fight.oddsB = p.oddsB === null ? null : num(p.oddsB, 'Odds');
      message = 'Fight updated';
      break;
    }

    case 'addFight': {
      const ev = requireEvent(db, p.eventId);
      const maxOrder = ev.fights.reduce((m, f) => Math.max(m, f.order), 0);
      ev.fights.push({
        id: newId('ft'),
        order: maxOrder + 1,
        segment: (p.segment as Segment) ?? 'main',
        weightClass: typeof p.weightClass === 'string' ? p.weightClass : 'Catchweight',
        titleFight: false,
        rounds: 3,
        a: { name: str(p.aName, 'Fighter A') },
        b: { name: str(p.bName, 'Fighter B') },
        oddsA: p.oddsA === undefined || p.oddsA === null ? null : num(p.oddsA, 'Odds'),
        oddsB: p.oddsB === undefined || p.oddsB === null ? null : num(p.oddsB, 'Odds'),
        status: 'scheduled',
        result: null,
      });
      message = 'Fight added';
      break;
    }

    case 'deleteFight': {
      const ev = requireEvent(db, p.eventId);
      const i = ev.fights.findIndex((f) => f.id === p.fightId);
      if (i < 0) bad('Fight not found');
      // Bets on it void automatically — gradeLeg treats a missing fight as void.
      ev.fights.splice(i, 1);
      message = 'Fight removed';
      break;
    }

    case 'createEvent': {
      const ev: MmaEvent = {
        id: newId('ev'),
        name: str(p.name, 'Event name'),
        date: typeof p.date === 'string' && p.date ? p.date : new Date().toISOString(),
        venue: typeof p.venue === 'string' ? p.venue : undefined,
        location: typeof p.location === 'string' ? p.location : undefined,
        createdAt: new Date().toISOString(),
        fights: [],
      };
      db.events.push(ev);
      eventId = ev.id;
      message = 'Event created';
      break;
    }

    case 'updateEvent': {
      const ev = requireEvent(db, p.eventId);
      if (typeof p.name === 'string' && p.name.trim()) ev.name = p.name.trim();
      if (typeof p.date === 'string' && p.date) ev.date = p.date;
      if (typeof p.venue === 'string') ev.venue = p.venue || undefined;
      if (typeof p.location === 'string') ev.location = p.location || undefined;
      message = 'Event updated';
      break;
    }

    case 'deleteEvent': {
      const i = db.events.findIndex((e) => e.id === p.eventId);
      if (i < 0) bad('Event not found');
      db.events.splice(i, 1);
      message = 'Event deleted';
      break;
    }

    case 'importEspnEvent': {
      const espnId = str(p.espnId, 'ESPN event id');
      const remote = await fetchEvent(espnId);
      if (!remote) bad('That event is not on the ESPN feed right now');

      const existing = db.events.find((e) => e.espnId === espnId);
      if (existing) {
        changes = applyEspnToEvent(existing, remote);
        eventId = existing.id;
        message = changes.length
          ? `Updated ${changes.length} fight${changes.length === 1 ? '' : 's'}`
          : 'Already up to date';
        break;
      }

      const ev: MmaEvent = {
        id: newId('ev'),
        name: remote.name,
        date: remote.date,
        venue: remote.venue,
        location: remote.location,
        espnId: remote.espnId,
        createdAt: new Date().toISOString(),
        fights: espnToFights(remote),
      };
      db.events.push(ev);
      eventId = ev.id;
      message = `Imported ${ev.fights.length} fights from ${ev.name}`;
      break;
    }

    case 'refreshResults': {
      const ev = requireEvent(db, p.eventId);

      // Published odds and live results are independent — fetch both, and let
      // one fail without taking the other down.
      const [remoteResult, feed] = await Promise.all([
        (async () => {
          let remote: EspnEvent | null = null;
          if (ev.espnId) remote = await fetchEvent(ev.espnId);
          if (!remote) {
            const board = await fetchScoreboard();
            remote =
              board.find((r) => r.name.toLowerCase() === ev.name.toLowerCase()) ??
              board.find((r) => r.date.slice(0, 10) === ev.date.slice(0, 10)) ??
              null;
          }
          return remote;
        })().catch(() => null),
        fetchOddsFeed(),
      ]);

      const oddsChanges = feed ? applyOddsFeed(ev, feed) : [];

      if (!remoteResult) {
        if (oddsChanges.length) {
          changes = oddsChanges;
          message = `${oddsChanges.length} line${oddsChanges.length === 1 ? '' : 's'} updated`;
          break;
        }
        bad(
          'Could not reach the results feed. Check your connection, or grade the fights by hand.',
        );
      }

      if (remoteResult.espnId) ev.espnId = remoteResult.espnId;
      const resultChanges = applyEspnToEvent(ev, remoteResult);

      changes = [...resultChanges, ...oddsChanges];
      const parts: string[] = [];
      if (resultChanges.length) {
        parts.push(`${resultChanges.length} result${resultChanges.length === 1 ? '' : 's'}`);
      }
      if (oddsChanges.length) {
        parts.push(`${oddsChanges.length} line${oddsChanges.length === 1 ? '' : 's'}`);
      }
      message = parts.length ? `Updated ${parts.join(' and ')}` : 'Nothing new yet';
      break;
    }

    default:
      bad(`Unknown action: ${type}`);
  }

  return { db, message, eventId, changes };
}
