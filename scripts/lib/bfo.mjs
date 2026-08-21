/**
 * BestFightOdds scraper.
 *
 * BFO publishes one row per market per fight and one column per book, in plain
 * server-rendered HTML — no JS, no auth, no rate limit worth worrying about.
 * That makes it the only free source carrying moneylines, totals, draw and
 * method-of-victory prices for a whole card, which is exactly the set of
 * markets focusBet prices.
 *
 * Nothing here is DOM-based on purpose: the tables are regular enough to walk
 * with regexes, and that keeps the odds job a zero-dependency `node` run.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const BFO_ORIGIN = 'https://www.bestfightodds.com';

export async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

/* ---------- html helpers ---------- */

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  '#189': '\u00bd', '#188': '\u00bc', '#190': '\u00be', '#39': "'",
};

function decode(s) {
  return s.replace(/&(#?[a-z0-9]+);/gi, (m, name) => {
    const key = name.toLowerCase();
    if (ENTITIES[key] !== undefined) return ENTITIES[key];
    if (/^#\d+$/.test(name)) return String.fromCharCode(Number(name.slice(1)));
    return m;
  });
}

function text(html) {
  return decode(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Half-round totals come through as "1½", so the fraction has to survive. */
function halves(s) {
  return s.replace(/\u00bd/g, '.5');
}

/* ---------- events index ---------- */

/**
 * Upcoming events from the front page, newest first. The date shown there has
 * no year ("August 22nd"), so it is only a label — the real date comes from
 * matching the card against ESPN later.
 */
export function parseEventIndex(html) {
  const out = [];
  const re =
    /<div class="table-header"><a href="(\/events\/[^"]+)"><h1>([^<]*)<\/h1><\/a><span class="table-header-date">([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({
      url: `${BFO_ORIGIN}${m[1]}`,
      slug: m[1].split('/').pop(),
      name: decode(m[2]).replace(/\s+Odds$/i, '').trim(),
      dateLabel: decode(m[3]).trim(),
    });
  }
  return out;
}

/* ---------- one event ---------- */

function parseHeader(thead) {
  const books = [];
  const re = /<th\b[^>]*\bdata-b="(\d+)"[^>]*>([\s\S]*?)<\/th>/g;
  let m;
  while ((m = re.exec(thead))) {
    // The bonus badge sits after the <br>; the book's name is what precedes it.
    const name = text(m[2].split('<br')[0]);
    books.push({ id: Number(m[1]), name });
  }
  return books;
}

function cellPrice(cellHtml) {
  const m = /<span id="oID\d+"[^>]*>([^<]*)<\/span>/.exec(cellHtml);
  if (!m) return null;
  const raw = decode(m[1]).replace(/[+\s]/g, '').replace(/\u2212/g, '-');
  const n = Number(raw);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/**
 * Rows carry `data-li="[book, side, matchupId, ...]"` on priced cells and
 * `data-li="[side, matchupId, ...]"` on the trailing chart button, which is
 * the only handle on which fight a row belongs to.
 */
function matchupIdOf(rowHtml) {
  const priced = /class="but-sgp?"[^>]*data-li="\[(\d+),(\d+),(\d+)/.exec(rowHtml);
  if (priced) return Number(priced[3]);
  const button = /class="button-cell but-sip?"[^>]*data-li="\[(\d+),(\d+)/.exec(rowHtml);
  if (button) return Number(button[2]);
  return null;
}

/** Every row of the odds table, in document order, with a price per book. */
function parseRows(tbody, books) {
  const rows = [];
  const rowRe = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(tbody))) {
    const inner = m[2];
    const thMatch = /<th scope="row">([\s\S]*?)<\/th>/.exec(inner);
    if (!thMatch) continue;

    // The edit link is admin-only chrome that renders as a bare matchup number.
    const labelHtml = thMatch[1].replace(/<a[^>]*class="bfo-admin-link"[^>]*>[\s\S]*?<\/a>/g, '');
    const label = halves(text(labelHtml));

    const prices = {};
    const cellRe = /<td\b([^>]*)>([\s\S]*?)<\/td>/g;
    let c;
    let i = 0;
    while ((c = cellRe.exec(inner))) {
      if (i < books.length) {
        const price = cellPrice(c[2]);
        if (price !== null) prices[books[i].name] = price;
      }
      i++;
    }

    rows.push({
      label,
      isFighter: /<a href="\/fighters\//.test(thMatch[1]),
      matchupId: matchupIdOf(inner),
      prices,
    });
  }
  return rows;
}

/**
 * Matchups on one event page. Each is the two corners plus every prop row BFO
 * lists for the fight, still as raw labels — mapping those onto markets is the
 * caller's job.
 */
export function parseEventPage(html) {
  // The first table is the responsive label column and carries no prices.
  const start = html.indexOf('<table class="odds-table">');
  if (start < 0) return { books: [], matchups: [] };
  const table = html.slice(start, html.indexOf('</table>', start));

  const theadEnd = table.indexOf('</thead>');
  const books = parseHeader(table.slice(0, theadEnd));
  const rows = parseRows(table.slice(theadEnd), books);

  const byId = new Map();
  for (const row of rows) {
    if (row.matchupId === null) continue;
    let mu = byId.get(row.matchupId);
    if (!mu) {
      mu = { id: row.matchupId, fighters: [], props: [] };
      byId.set(row.matchupId, mu);
    }
    if (row.isFighter && mu.fighters.length < 2) {
      mu.fighters.push({ name: row.label, prices: row.prices });
    } else if (!row.isFighter) {
      mu.props.push({ label: row.label, prices: row.prices });
    }
  }

  return {
    books: books.map((b) => b.name),
    matchups: [...byId.values()].filter((mu) => mu.fighters.length === 2),
  };
}
