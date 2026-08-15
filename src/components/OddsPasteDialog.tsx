'use client';

import { useMemo, useState } from 'react';
import { useStore } from './Store';
import { Button, Modal } from './ui';
import { formatAmerican, parseAmerican } from '@/lib/odds';
import { nameScore } from '@/lib/espn';
import { cx } from '@/lib/format';
import type { MmaEvent } from '@/lib/types';

interface Parsed {
  name: string;
  odds: number;
}

interface Applied {
  fightId: string;
  corner: 'a' | 'b';
  fighterName: string;
  odds: number;
  score: number;
}

/**
 * Accepts anything shaped like "Fighter Name  -285" — one per line. That covers
 * a copied odds column, a screenshot transcribed by hand, or a book's share text.
 */
function parseLines(text: string): Parsed[] {
  const out: Parsed[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    // Split the trailing price off the name.
    const m = line.match(/^(.*?)[\s:|,\t]+([+\-−–—]?\d{2,5})\s*[▲▼△▽^v]?\s*$/u);
    if (!m) continue;

    const name = m[1].replace(/[•·\-–—|]+$/, '').trim();
    const odds = parseAmerican(m[2]);
    if (!name || odds === null) continue;
    if (name.length < 2) continue;

    out.push({ name, odds });
  }
  return out;
}

export function OddsPasteDialog({
  open,
  onClose,
  event,
}: {
  open: boolean;
  onClose: () => void;
  event: MmaEvent;
}) {
  const { act, busy } = useStore();
  const [text, setText] = useState('');

  const parsed = useMemo(() => parseLines(text), [text]);

  const matches = useMemo<{ applied: Applied[]; unmatched: Parsed[] }>(() => {
    const applied: Applied[] = [];
    const unmatched: Parsed[] = [];
    const taken = new Set<string>();

    for (const p of parsed) {
      let best: Applied | null = null;
      for (const f of event.fights) {
        for (const corner of ['a', 'b'] as const) {
          const key = `${f.id}:${corner}`;
          if (taken.has(key)) continue;
          const fighter = corner === 'a' ? f.a : f.b;
          const score = nameScore(p.name, fighter.name);
          if (score > (best?.score ?? 0)) {
            best = {
              fightId: f.id,
              corner,
              fighterName: fighter.name,
              odds: p.odds,
              score,
            };
          }
        }
      }
      if (best && best.score >= 0.7) {
        taken.add(`${best.fightId}:${best.corner}`);
        applied.push(best);
      } else {
        unmatched.push(p);
      }
    }
    return { applied, unmatched };
  }, [parsed, event.fights]);

  async function apply() {
    // Collapse per-corner matches into one update per fight.
    const byFight = new Map<string, { fightId: string; oddsA?: number; oddsB?: number }>();
    for (const m of matches.applied) {
      const row = byFight.get(m.fightId) ?? { fightId: m.fightId };
      if (m.corner === 'a') row.oddsA = m.odds;
      else row.oddsB = m.odds;
      byFight.set(m.fightId, row);
    }
    const res = await act('bulkSetOdds', {
      eventId: event.id,
      updates: [...byFight.values()],
    });
    if (res.ok) {
      setText('');
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Paste moneylines" wide>
      <p className="mb-3 text-xs text-ink-400">
        One fighter per line with the price after the name — exactly how an odds
        column reads. Names are matched to this card automatically, so order
        doesn&apos;t matter and surnames alone are usually enough.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        spellCheck={false}
        placeholder={`Ian Machado Garry   +270\nIslam Makhachev     -285\nGillian Robertson    +178\nMackenzie Dern       -186`}
        className="nums w-full rounded-lg border border-ink-600 bg-ink-900 p-3 font-mono text-[13px] leading-relaxed text-ink-200 placeholder:text-ink-600 focus:border-brand-500/60 focus:outline-none"
      />

      {parsed.length > 0 ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-500">
              Matched ({matches.applied.length})
            </div>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-2">
              {matches.applied.length ? (
                matches.applied.map((m, i) => (
                  <div
                    key={`${m.fightId}-${m.corner}-${i}`}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span
                      className={cx(
                        'truncate',
                        m.score >= 0.9 ? 'text-ink-300' : 'text-warn-500',
                      )}
                      title={m.score < 0.9 ? 'Fuzzy match — double-check this one' : undefined}
                    >
                      {m.fighterName}
                    </span>
                    <span className="nums shrink-0 font-bold text-brand-500">
                      {formatAmerican(m.odds)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-3 text-center text-xs text-ink-600">
                  Nothing matched this card
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
              Skipped ({matches.unmatched.length})
            </div>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-2">
              {matches.unmatched.length ? (
                matches.unmatched.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 text-xs text-ink-600"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="nums shrink-0">{formatAmerican(p.odds)}</span>
                  </div>
                ))
              ) : (
                <div className="py-3 text-center text-xs text-ink-600">
                  Everything matched
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={busy || matches.applied.length === 0}
          onClick={apply}
        >
          Apply {matches.applied.length || ''} line
          {matches.applied.length === 1 ? '' : 's'}
        </Button>
      </div>
    </Modal>
  );
}
