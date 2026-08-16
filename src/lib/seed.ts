import type { DB, MmaEvent } from './types';

/**
 * UFC 330 — Makhachev vs. Machado Garry (Xfinity Mobile Arena, Philadelphia).
 * Card + records from Tapology, moneylines from DraftKings.
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
  ) => ({
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
      f(12, 'main', 'Welterweight', 5, true, ['Islam Makhachev', '28-1'], ['Ian Machado Garry', '17-1'], -340, 270),
      f(11, 'main', "Women's Strawweight", 5, true, ['Mackenzie Dern', '16-5'], ['Gillian Robertson', '17-8'], -198, 164),
      f(10, 'main', 'Lightweight', 3, false, ['Jalin Turner', '15-9'], ['Kauê Fernandes', '11-2'], -118, -102),
      f(9, 'main', 'Middleweight', 3, false, ['Mansur Abdul-Malik', '9-1-1'], ['Dustin Stoltzfus', '16-8'], -750, 525),
      f(8, 'main', 'Lightweight', 3, false, ['Edson Barboza', '24-14'], ['Esteban Ribovics', '15-3'], 525, -750),
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
