'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/components/Store';
import { FightRow } from '@/components/FightRow';
import { OddsPasteDialog } from '@/components/OddsPasteDialog';
import { EditCardDialog } from '@/components/EditCardDialog';
import { BetCard } from '@/components/BetCard';
import { Button, Empty, Panel, PanelHeader } from '@/components/ui';
import { formatMoney } from '@/lib/odds';
import { cx, fmtDate } from '@/lib/format';
import type { Segment } from '@/lib/types';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'main', label: 'Main Card' },
  { key: 'prelim', label: 'Prelims' },
  { key: 'early', label: 'Early Prelims' },
];

function EventView() {
  const params = useSearchParams();
  const id = params.get('id') ?? '';
  const { state, act, busy, ready } = useStore();
  const router = useRouter();
  const [pasting, setPasting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'final'>('all');
  const [syncNote, setSyncNote] = useState<string[] | null>(null);

  const event = state.events.find((e) => e.id === id);

  const eventBets = useMemo(
    () => state.bets.filter((b) => b.legs.some((l) => l.eventId === id)),
    [state.bets, id],
  );

  const pnl = state.eventPnl.find((p) => p.eventId === id);

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

  async function refresh() {
    const res = await act('refreshResults', { eventId: event!.id });
    setSyncNote(res.ok ? (res.changes ?? []) : null);
  }

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

              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setPasting(true)}>
                  Paste odds
                </Button>
                <Button size="sm" className="flex-1 sm:flex-none" onClick={() => setEditing(true)}>
                  Edit card
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  className="flex-1 sm:flex-none"
                  disabled={busy}
                  onClick={refresh}
                >
                  {busy ? 'Checking…' : 'Refresh results'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {syncNote ? (
        <Panel className="border-brand-500/30">
          <div className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-brand-500">
                {syncNote.length ? 'Results synced' : 'No new results'}
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {syncNote.map((c, i) => (
                  <li key={i} className="text-xs text-ink-300">
                    {c}
                  </li>
                ))}
              </ul>
              {!syncNote.length ? (
                <div className="mt-1 text-xs text-ink-500">
                  Nothing has been called since the last check.
                </div>
              ) : null}
            </div>
            <button
              onClick={() => setSyncNote(null)}
              className="shrink-0 rounded px-2 py-1 text-[11px] font-semibold text-ink-500 hover:bg-ink-700"
            >
              Dismiss
            </button>
          </div>
        </Panel>
      ) : null}

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
                <FightRow key={f.id} event={event} fight={f} />
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
            body={filter === 'all' ? 'Add bouts from the Edit card panel.' : undefined}
            action={
              filter === 'all' ? (
                <Button variant="primary" onClick={() => setEditing(true)}>
                  Edit card
                </Button>
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

      <OddsPasteDialog open={pasting} onClose={() => setPasting(false)} event={event} />
      <EditCardDialog
        open={editing}
        onClose={() => setEditing(false)}
        event={event}
        onDeleted={() => router.push('/events/')}
      />
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
