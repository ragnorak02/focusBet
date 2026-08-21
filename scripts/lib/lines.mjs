import { normalizeName } from './names.mjs';

/**
 * Turns one BestFightOdds matchup into the two `OddsLine` records the app's
 * feed is made of (see `src/lib/oddsFeed.ts`).
 *
 * BFO lists every book side by side, so something has to choose. Two rules:
 *
 * - **One book per market.** A moneyline taken from two different books can
 *   price both corners as the favourite; so can a total. Each market is filled
 *   from the first book in the preference order that prices *both* sides of it,
 *   and only falls back to a one-sided fill when no book prices the pair.
 * - **No spreads.** BFO does not carry a handicap on the judges' scorecards,
 *   so that market stays hand-entered.
 */

export const DEFAULT_BOOKS = [
  'FanDuel',
  'Kalshi',
  'DraftKings',
  'BetRivers',
  'Caesars',
  'BetMGM',
  'BetWay',
  'Unibet',
  'Polymarket',
];

function impliedProb(american) {
  return american > 0 ? 100 / (american + 100) : -american / (-american + 100);
}

/** First book pricing every one of `sides`, so a market never mixes books. */
function pickBook(preference, sides) {
  const books = new Set([...preference, ...sides.flatMap((s) => Object.keys(s ?? {}))]);
  const ordered = [
    ...preference.filter((b) => books.has(b)),
    ...[...books].filter((b) => !preference.includes(b)),
  ];
  for (const book of ordered) {
    if (sides.every((s) => s?.[book] !== undefined)) return book;
  }
  return null;
}

/** Best-effort fill for a market no single book prices in full. */
function pickEach(preference, sides) {
  return sides.map((s) => {
    const book = pickBook(preference, [s]);
    return book === null ? null : { book, price: s[book] };
  });
}

function findProp(props, test) {
  return props.find((p) => test(p.label))?.prices ?? null;
}

/** "Hernandez wins by TKO/KO" — labels use the surname alone. */
function propFor(props, fighter, tail) {
  const target = normalizeName(fighter);
  return findProp(props, (label) => {
    const m = new RegExp(`^(.+?) ${tail}$`, 'i').exec(label);
    if (!m) return false;
    const who = normalizeName(m[1]);
    return who.length > 1 && (target === who || target.endsWith(` ${who}`));
  });
}

/**
 * BFO lists every total a book has posted (1½ through 4½). The one that
 * belongs on the board is the one closest to a coin flip, which is what a book
 * means by its main line.
 */
function pickTotal(props, preference) {
  const lines = new Map();
  for (const p of props) {
    const m = /^(Over|Under) ([\d.]+) rounds$/i.exec(p.label);
    if (!m) continue;
    const line = Number(m[2]);
    const entry = lines.get(line) ?? {};
    entry[m[1].toLowerCase()] = p.prices;
    lines.set(line, entry);
  }

  let best = null;
  for (const [line, sides] of lines) {
    const book = pickBook(preference, [sides.over, sides.under]);
    if (book === null) continue;
    const over = sides.over[book];
    const under = sides.under[book];
    const balance = Math.abs(impliedProb(over) - impliedProb(under));
    if (!best || balance < best.balance) best = { line, over, under, book, balance };
  }
  if (best) return best;

  // Nothing two-sided: take the most balanced single side that exists at all.
  for (const [line, sides] of lines) {
    const [over, under] = pickEach(preference, [sides.over ?? {}, sides.under ?? {}]);
    if (!over && !under) continue;
    return {
      line,
      over: over?.price ?? null,
      under: under?.price ?? null,
      book: over?.book ?? under?.book,
    };
  }
  return null;
}

/**
 * `lines` is the pair of feed records; `books` names every book that ended up
 * contributing, for the feed's `source` string.
 */
export function matchupToLines(matchup, preference = DEFAULT_BOOKS) {
  const [a, b] = matchup.fighters;
  const props = matchup.props;
  const used = new Set();

  const lineA = { fighter: a.name };
  const lineB = { fighter: b.name };

  const mlBook = pickBook(preference, [a.prices, b.prices]);
  if (mlBook) {
    lineA.moneyline = a.prices[mlBook];
    lineB.moneyline = b.prices[mlBook];
    used.add(mlBook);
  } else {
    const [pa, pb] = pickEach(preference, [a.prices, b.prices]);
    if (pa) {
      lineA.moneyline = pa.price;
      used.add(pa.book);
    }
    if (pb) {
      lineB.moneyline = pb.price;
      used.add(pb.book);
    }
  }

  // A card with no moneyline is a card the app can't put on the board.
  if (lineA.moneyline === undefined && lineB.moneyline === undefined) return null;

  const total = pickTotal(props, preference);
  if (total) {
    lineA.totalLine = total.line;
    lineB.totalLine = total.line;
    if (total.over !== null) lineA.over = total.over;
    if (total.under !== null) lineB.under = total.under;
    if (total.book) used.add(total.book);
  }

  const draw = findProp(props, (l) => /^Fight is a draw$/i.test(l));
  if (draw) {
    const book = pickBook(preference, [draw]);
    if (book) {
      lineA.draw = draw[book];
      used.add(book);
    }
  }

  // Method prices come as a set: a book that only prices the KO is worse than
  // one that prices all three, because the board reads them together.
  for (const [fighter, line] of [
    [a, lineA],
    [b, lineB],
  ]) {
    const ko = propFor(props, fighter.name, 'wins by TKO/KO');
    const sub = propFor(props, fighter.name, 'wins by submission');
    const dec = propFor(props, fighter.name, 'wins by decision');
    const inside = propFor(props, fighter.name, 'wins inside distance');
    if (!ko && !sub && !dec) continue;

    const book = pickBook(preference, [ko, sub, dec].filter(Boolean));
    const take = (prices) => {
      if (!prices) return undefined;
      if (book && prices[book] !== undefined) return prices[book];
      const solo = pickBook(preference, [prices]);
      if (!solo) return undefined;
      used.add(solo);
      return prices[solo];
    };
    if (book) used.add(book);

    const koPrice = take(ko);
    const subPrice = take(sub);
    const decPrice = take(dec);
    if (koPrice !== undefined) line.ko = koPrice;
    if (subPrice !== undefined) line.sub = subPrice;
    if (decPrice !== undefined) line.dec = decPrice;

    // "Inside distance" is exactly the KO-or-submission double chance.
    const insidePrice = take(inside);
    if (insidePrice !== undefined) line.koSub = insidePrice;
  }

  return { lines: [lineA, lineB], books: [...used] };
}
