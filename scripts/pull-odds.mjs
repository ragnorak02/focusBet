#!/usr/bin/env node
/**
 * Rebuilds `public/odds.json` from BestFightOdds.
 *
 *   node scripts/pull-odds.mjs [--books=FanDuel,Kalshi] [--event=slug] [--dry-run]
 *
 * The app is a static site, so odds ship as a file rather than a request: the
 * board reads `public/odds.json` on load. This script is what fills it, and
 * `.github/workflows/odds.yml` runs it on a schedule so cards price themselves
 * without anyone opening a book.
 *
 * Prices are chosen a market at a time from the first book in `--books` that
 * quotes the whole market — see `scripts/lib/lines.mjs`. Anything in
 * `data/odds-manual.json` is laid over the result and wins, which is how the
 * markets BFO doesn't carry (the scorecard spread) and the cards it doesn't
 * list get onto the board at all.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BFO_ORIGIN, fetchHtml, parseEventIndex, parseEventPage } from './lib/bfo.mjs';
import { DEFAULT_BOOKS, matchupToLines } from './lib/lines.mjs';
import { fetchEvents } from './lib/espnFeed.mjs';
import { boutScore, nameScore } from './lib/names.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/odds.json');
const MANUAL = resolve(ROOT, 'data/odds-manual.json');

const args = process.argv.slice(2);
const flag = (name) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : '';
};

const dryRun = flag('dry-run') !== null;
const only = flag('event');
const books = (flag('books') ?? process.env.ODDS_BOOKS ?? '')
  .split(',')
  .map((b) => b.trim())
  .filter(Boolean);
const preference = books.length ? books : DEFAULT_BOOKS;

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

/* ---------- matching a BFO card to an ESPN event ---------- */

/**
 * The feed keys on ESPN's event id, so a scraped card is only useful once it
 * has one. Names don't line up ("UFC Sacramento" vs "UFC Fight Night:
 * Hernandez vs. Rodrigues"), so the fights themselves are the join.
 */
function matchEspnEvent(matchups, espnEvents) {
  let best = null;
  for (const ev of espnEvents) {
    let hits = 0;
    for (const mu of matchups) {
      const [a, b] = mu.fighters;
      const found = ev.bouts.some((bout) => boutScore(a.name, b.name, bout.a, bout.b).score >= 0.75);
      if (found) hits++;
    }
    if (hits > (best?.hits ?? 0)) best = { ev, hits };
  }
  // Half the card agreeing rules out two events sharing one crossover fighter.
  if (!best || best.hits < 3 || best.hits < matchups.length / 2) return null;
  return best.ev;
}

/* ---------- the manual override layer ---------- */

function sameEvent(x, y) {
  if (x.espnId && y.espnId) return x.espnId === y.espnId;
  return x.name?.toLowerCase() === y.name?.toLowerCase();
}

/**
 * Manual lines win field by field, so a file that carries nothing but a spread
 * leaves the scraped moneyline alone. Removing an entry hands that market back
 * to the feed on the next run.
 */
function mergeManual(scraped, manual) {
  const out = scraped.map((e) => ({ ...e, lines: e.lines.map((l) => ({ ...l })) }));
  const overrides = [];

  for (const mev of manual.events ?? []) {
    const target = out.find((e) => sameEvent(e, mev));
    if (!target) {
      out.push(structuredClone(mev));
      overrides.push(`${mev.name}: hand-entered only (not on BestFightOdds)`);
      continue;
    }

    if (mev.source) target.source = `${mev.source}, over ${target.source}`;
    let touched = 0;
    for (const mline of mev.lines ?? []) {
      let best = null;
      for (const line of target.lines) {
        const score = nameScore(mline.fighter, line.fighter);
        if (score > (best?.score ?? 0)) best = { line, score };
      }
      if (best && best.score >= 0.8) {
        // A total is one market spread across two records, and the two sources
        // can list the corners in opposite order — so a hand-entered total
        // replaces both sides rather than merging into the scraped one, which
        // would leave an over from one book against an under from another.
        if ('totalLine' in mline) {
          delete best.line.over;
          delete best.line.under;
        }
        Object.assign(best.line, mline, { fighter: best.line.fighter });
      } else {
        target.lines.push({ ...mline });
      }
      touched++;
    }
    if (touched) overrides.push(`${target.name}: ${touched} hand-entered line(s) applied`);
  }

  return { events: out, overrides };
}

/* ---------- run ---------- */

/** The promotions ESPN carries results for, which is all the app can grade. */
const PROMOTIONS = /^(ufc|pfl)\b/i;

function isSupported(ev) {
  return PROMOTIONS.test(ev.name) || PROMOTIONS.test((ev.slug ?? '').replace(/-/g, ' '));
}

/**
 * BestFightOdds lists a card under more than one page while it is being built
 * (the same event under two dates), and posts far-out cards with a single
 * priced fight. Keep the version with the most lines, and drop the stubs — the
 * app downloads this file on every load, and a card no book has priced yet is
 * nothing to bet on.
 */
function dedupe(events) {
  const kept = [];
  for (const ev of events) {
    if (!ev.espnId && ev.lines.length < 6) continue;
    const clash = kept.findIndex(
      (k) => (ev.espnId && k.espnId === ev.espnId) || (!ev.espnId && k.name === ev.name),
    );
    if (clash < 0) kept.push(ev);
    else if (kept[clash].lines.length < ev.lines.length) kept[clash] = ev;
  }
  return kept;
}

async function main() {
  const index = parseEventIndex(await fetchHtml(`${BFO_ORIGIN}/`)).filter(isSupported);
  const wanted = only ? index.filter((e) => e.slug.includes(only)) : index;

  if (!wanted.length) {
    console.error(only ? `No BestFightOdds event matching "${only}"` : 'No cards listed');
    process.exitCode = 1;
    return;
  }

  const espnEvents = await fetchEvents().catch((err) => {
    console.warn(`ESPN lookup failed (${err.message}) — cards will be keyed by name only`);
    return [];
  });

  const capturedAt = new Date().toISOString();
  const scraped = [];

  for (const entry of wanted) {
    const page = parseEventPage(await fetchHtml(entry.url));
    if (!page.matchups.length) {
      console.warn(`${entry.name}: no odds posted yet`);
      continue;
    }

    const lines = [];
    const used = new Set();
    let skipped = 0;
    for (const mu of page.matchups) {
      const result = matchupToLines(mu, preference);
      if (!result) {
        skipped++;
        continue;
      }
      lines.push(...result.lines);
      result.books.forEach((b) => used.add(b));
    }
    if (!lines.length) {
      console.warn(`${entry.name}: nothing priced by ${preference.join(', ')}`);
      continue;
    }

    const espn = matchEspnEvent(page.matchups, espnEvents);
    scraped.push({
      espnId: espn?.espnId,
      name: espn?.name ?? entry.name,
      source: `BestFightOdds (${[...used].join(', ')})`,
      capturedAt,
      lines,
    });

    console.log(
      `${espn?.name ?? entry.name}: ${lines.length / 2} fights from ${[...used].join(', ')}` +
        (espn ? ` [espn ${espn.espnId}]` : ' [no ESPN id — matched by name]') +
        (skipped ? ` (${skipped} unpriced)` : ''),
    );
  }

  const manual = readJson(MANUAL, { events: [] });
  const { events, overrides } = mergeManual(dedupe(scraped), manual);
  overrides.forEach((o) => console.log(o));

  const previous = readJson(OUT, null);
  const strip = (feed) =>
    JSON.stringify({
      events: (feed?.events ?? []).map(({ capturedAt: _c, ...rest }) => rest),
    });

  if (previous && strip(previous) === strip({ events })) {
    console.log('No line moved — leaving public/odds.json alone');
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify({ updatedAt: capturedAt, events }, null, 2));
    return;
  }

  writeFileSync(OUT, `${JSON.stringify({ updatedAt: capturedAt, events }, null, 2)}\n`);
  console.log(`Wrote ${events.length} event(s) to public/odds.json`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
