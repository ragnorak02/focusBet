'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useStore } from '@/components/Store';
import { FightRow } from '@/components/FightRow';
import { BetCard } from '@/components/BetCard';
import { Button, Empty, Panel, PanelHeader } from '@/components/ui';
import { formatMoney } from '@/lib/odds';
import { cx, fmtDate, fmtTime } from '@/lib/format';
import type { Segment } from '@/lib/types';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'main', label: 'Main Card' },
  { key: 'prelim', label: 'Prelims' },
  { key: 'early', label: 'Early Prelims' },
];

type Sync = { phase: 'loading' } | { phase: 'ok'; at: string } | { phase: 'error' };

function EventView() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const { state, act, ready } = useStore();
  const [filter, setFilter] = useState<'all' | 'open' | 'final'>('all');
  // Results and lines both arrive from the feed, so the board is read-only by
  // default and every bout is two rows shorter for it. This is the way back in
  // when the feed is behind, or when a spread needs its scorecards.
  const [editing, setEditing] = useState(false);
  const [sync, setSync] = useState<Sync>({ phase: 'loading' });

  const event = state.events.find((e) => e.id === id);
  const eventId = event?.id;

  const eventBets = useMemo(
    () => state.bets.filter((b) => b.legs.some((l) => l.eventId === id)),
    [state.bets, id],
  );

  const pnl = state.eventPnl.find((p) => p.eventId === id);

  // Odds and results are pulled on load, so a pull-to-refresh is the whole
  // update gesture. Guarded by a ref because `act` swaps the db in, which
  // re-runs this effect — without it the fetch would loop.
  const pulledFor = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !eventId) return;
    if (pulledFor.current === eventId) return;
    pulledFor.current = eventId;

    let cancelled = false;
    setSync({ phase: 'loading' });

    // Silent: nothing here was triggered by a tap, so a toast on every page
    // view (or every time the phone is offline) would just be noise.
    act('refreshResults', { eventId }, { silent: true }).then((res) => {
      if (cancelled) return;
      setSync(res.ok ? { phase: 'ok', at: new Date().toISOString() } : { phase: 'error' });
    });

    return () => {
      cancelled = true;
    };
  }, [ready, eventId, act]);

  if (!event) {
    return (
      <Panel>
        <Empty
          title={ready ? 'Card not found' : 'Loading…'}
          body={ready ? 'It may have been deleted.' : undefined}
          action={
            ready ? (
              <Link href="/events/">
                <Button variant="primary">Back to cards</Button>
              </Link>
            ) : undefined
          }
        />
      </Panel>
    );
  }

  const fights = [...event.fights].sort((a, b) => b.order - a.order);
  const visible = fights.filter((f) =>
    filter === 'all' ? true : filter === 'final' ? f.result : !f.result,
  );

  const finals = fights.filter((f) => f.result).length;
  const missingOdds = fights.filter(
    (f) => !f.result && (f.oddsA === null || f.oddsB === null),
  ).length;

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden">
        <div className="relative px-4 py-4 sm:px-5">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-500/[0.06] to-transparent" />
          <div className="relative">
            <Link
              href="/events/"
              className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-300"
            >
              ← All cards
            </Link>
            <div className="mt-1.5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl font-black tracking-tight text-ink-200 sm:text-2xl">
                  {event.name}
                </h1>
                <div className="mt-1 text-sm text-ink-400">
                  {fmtDate(event.date, { weekday: 'short' })}
                  {event.venue ? ` · ${event.venue}` : ''}
                  {event.location ? ` · ${event.location}` : ''}
                </div>
                <div className="nums mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span>{fights.length} bouts</span>
                  <span className="text-ink-700">•</span>
                  <span>{finals} final</span>
                  {missingOdds > 0 ? (
                    <>
                      <span className="text-ink-700">•</span>
                      <span className="text-warn-500">{missingOdds} without a line</span>
                    </>
                  ) : null}
                  {pnl ? (
                    <>
                      <span className="text-ink-700">•</span>
                      <span
                        className={cx(
                          'font-bold',
                          pnl.profit > 0
                            ? 'text-brand-500'
                            : pnl.profit < 0
                              ? 'text-loss-500'
                              : 'text-ink-400',
                        )}
                      >
                        {formatMoney(pnl.profit, { sign: pnl.profit !== 0 })} on this card
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 text-xs sm:text-right">
                {sync.phase === 'loading' ? (
                  <span className="flex items-center gap-1.5 text-ink-400 sm:justify-end">
                    <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-brand-500" />
                    Checking odds &amp; results…
                  </span>
                ) : sync.phase === 'error' ? (
                  <span className="text-warn-500">Feed unreachable — pull down to retry</span>
                ) : (
                  <span className="text-ink-500">
                    Updated {fmtTime(sync.at)} · pull down to refresh
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="flex items-center gap-1">
        {(['all', 'open', 'final'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cx(
              'rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
              filter === f
                ? 'bg-ink-700 text-ink-200'
                : 'text-ink-500 hover:bg-ink-800 hover:text-ink-300',
            )}
          >
            {f === 'all' ? 'All' : f === 'open' ? 'Bettable' : 'Final'}
          </button>
        ))}
        <button
          onClick={() => setEditing((v) => !v)}
          className={cx(
            'ml-auto rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
            editing
              ? 'bg-ink-700 text-ink-200'
              : 'text-ink-600 hover:bg-ink-800 hover:text-ink-300',
          )}
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {SEGMENTS.map(({ key, label }) => {
        const rows = visible.filter((f) => f.segment === key);
        if (!rows.length) return null;
        return (
          <Panel key={key} className="overflow-hidden">
            <PanelHeader
              title={label}
              right={
                <span className="nums text-xs text-ink-500">
                  {rows.length} bout{rows.length === 1 ? '' : 's'}
                </span>
              }
            />
            <div className="divide-y divide-ink-700/50">
              {rows.map((f) => (
                <FightRow key={f.id} event={event} fight={f} editable={editing} />
              ))}
            </div>
          </Panel>
        );
      })}

      {visible.length === 0 ? (
        <Panel>
          <Empty
            title={
              filter === 'open'
                ? 'Every fight on this card is settled'
                : filter === 'final'
                  ? 'Nothing has finished yet'
                  : 'No fights on this card'
            }
            body={
              filter === 'all'
                ? 'Re-import the card from the fight cards page to pull its bouts.'
                : undefined
            }
            action={
              filter === 'all' ? (
                <Link href="/events/">
                  <Button variant="primary">Back to cards</Button>
                </Link>
              ) : undefined
            }
          />
        </Panel>
      ) : null}

      {eventBets.length ? (
        <Panel>
          <PanelHeader
            title="Your bets on this card"
            subtitle={`${eventBets.length} ticket${eventBets.length === 1 ? '' : 's'}`}
          />
          <div className="grid gap-2.5 p-3 md:grid-cols-2">
            {eventBets.map((b) => (
              <BetCard key={b.id} bet={b} />
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

export default function EventPage() {
  return (
    <Suspense
      fallback={
        <Panel>
          <Empty title="Loading…" />
        </Panel>
      }
    >
      <EventView />
    </Suspense>
  );
}
