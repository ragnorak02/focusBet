import type { DB, Fight, MmaEvent } from './types';

/**
 * UFC 330 — Makhachev vs. Machado Garry (Xfinity Mobile Arena, Philadelphia).
 * Card + records from Tapology, moneylines, spreads, totals and method lines from DraftKings.
 * Bouts left without a price simply have no line entered yet.
 */
function ufc330(): MmaEvent {
  const f = (
    order: number,
    segment: 'main' | 'prelim',
    weightClass: string,
    rounds: number,
    titleFight: boolean,
    a: [string, string],
    b: [string, string],
    oddsA: number | null,
    oddsB: number | null,
    extra?: Partial<
      Pick<Fight, 'methodA' | 'methodB' | 'drawOdds' | 'totalRounds' | 'spread'>
    >,
  ): Fight => ({
    id: `f${order}`,
    order,
    segment,
    weightClass,
    titleFight,
    rounds,
    a: { name: a[0], record: a[1] },
    b: { name: b[0], record: b[1] },
    oddsA,
    oddsB,
    status: 'scheduled' as const,
    result: null,
    ...extra,
  });

  return {
    id: 'ufc-330',
    name: 'UFC 330: Makhachev vs. Machado Garry',
    date: '2026-08-15T21:30:00.000Z',
    venue: 'Xfinity Mobile Arena',
    location: 'Philadelphia, PA',
    espnId: '600059185',
    createdAt: new Date(0).toISOString(),
    fights: [
      f(12, 'main', 'Welterweight', 5, true, ['Islam Makhachev', '28-1'], ['Ian Machado Garry', '17-1'], -345, 275, {
        methodA: { ko: 900, sub: 185, dec: 120, koSub: 150, koDec: -120, subDec: -330 },
        methodB: { ko: 900, sub: 5000, dec: 450, koSub: 850, koDec: 300, subDec: 400 },
        drawOdds: 5000,
        totalRounds: { line: 4.5, over: -154, under: 120 },
        spread: { line: 9.5, favorite: 'a', oddsA: -120, oddsB: -110 },
      }),
      f(11, 'main', "Women's Strawweight", 5, true, ['Mackenzie Dern', '16-5'], ['Gillian Robertson', '17-8'], -198, 164, {
        methodA: { ko: 1000, sub: 250, dec: 165, koSub: 200, koDec: 115, subDec: -180 },
        methodB: { ko: 1100, sub: 900, dec: 275, koSub: 550, koDec: 195, subDec: 180 },
        drawOdds: 5000,
        totalRounds: { line: 3.5, over: -230, under: 175 },
        spread: { line: 5.5, favorite: 'a', oddsA: 100, oddsB: -135 },
      }),
      f(10, 'main', 'Lightweight', 3, false, ['Jalin Turner', '15-9'], ['Kauê Fernandes', '11-2'], -118, -102, {
        methodA: { ko: 200, sub: 550, dec: 650, koSub: 130, koDec: 140, subDec: 255 },
        methodB: { ko: 185, sub: 800, dec: 600, koSub: 140, koDec: 110, subDec: 300 },
        drawOdds: 5000,
        totalRounds: { line: 1.5, over: -115, under: -115 },
        spread: { line: 3.5, favorite: 'a', oddsA: 110, oddsB: -145 },
      }),
      f(9, 'main', 'Middleweight', 3, false, ['Mansur Abdul-Malik', '9-1-1'], ['Dustin Stoltzfus', '16-8'], -700, 500, {
        methodA: { ko: -115, sub: 650, dec: 215, koSub: -160, koDec: -550, subDec: 125 },
        methodB: { ko: 2500, sub: 1200, dec: 1100, koSub: 900, koDec: 700, subDec: 550 },
        drawOdds: 5000,
        totalRounds: { line: 1.5, over: -120, under: -110 },
        spread: { line: 7.5, favorite: 'a', oddsA: -205, oddsB: 150 },
      }),
      f(8, 'main', 'Lightweight', 3, false, ['Edson Barboza', '24-14'], ['Esteban Ribovics', '15-3'], 525, -750, {
        methodA: { ko: 1200, sub: 4000, dec: 900, koSub: 1000, koDec: 550, subDec: 750 },
        methodB: { ko: -175, sub: 1200, dec: 250, koSub: -185, koDec: -600, subDec: 180 },
        drawOdds: 5000,
        totalRounds: { line: 1.5, over: -175, under: 135 },
        spread: { line: 3.5, favorite: 'b', oddsA: 240, oddsB: -350 },
      }),
      f(7, 'prelim', 'Welterweight', 3, false, ['Chidi Njokuani', '25-12'], ['Joel Álvarez', '23-4'], 285, -360),
      f(6, 'prelim', 'Catchweight', 3, false, ['Charles Johnson', '19-9'], ['Eduardo Chapolin', '15-2'], null, null),
      f(5, 'prelim', 'Middleweight', 3, false, ['Donte Johnson', '8-0'], ['Eric McConico', '11-4-1'], null, null),
      f(4, 'prelim', 'Middleweight', 3, false, ['Vicente Luque', '24-12-1'], ['Tresean Gore', '7-4'], -104, -100),
      f(3, 'prelim', 'Light Heavyweight', 3, false, ['Rafael Tobias', '14-2'], ['Lucas Fernando', '13-3'], null, null),
      f(2, 'prelim', 'Welterweight', 3, false, ['Neil Magny', '32-14'], ['Ramiz Brahimaj', '13-6'], 488, -525),
      f(1, 'prelim', 'Welterweight', 3, false, ['Jeremiah Wells', '13-4-1'], ['Myktybek Orolbai', '16-2-1'], 567, -733),
    ],
  };
}

export function seedDb(): DB {
  return {
    version: 1,
    events: [ufc330()],
    bets: [],
    cash: [
      {
        id: 'seed-deposit',
        at: new Date().toISOString(),
        type: 'deposit',
        amount: 50,
        note: 'Starting bankroll',
      },
    ],
  };
}
