'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/components/Store';
import { BetCard } from '@/components/BetCard';
import { Button, Empty, Panel, Stat } from '@/components/ui';
import { formatMoney } from '@/lib/odds';
import { cx, fmtPct } from '@/lib/format';

type Filter = 'all' | 'open' | 'won' | 'lost' | 'settled';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'settled', label: 'Settled' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

export default function BetsPage() {
  const { state } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [kind, setKind] = useState<'all' | 'single' | 'parlay'>('all');

  const { stats, bankroll } = state;

  const bets = state.bets
    .filter((b) => {
      if (filter === 'open') return b.status === 'open';
      if (filter === 'settled') return b.status !== 'open';
      if (filter === 'won') return b.status === 'won' || b.status === 'cashed';
      if (filter === 'lost') return b.status === 'lost';
      return true;
    })
    .filter((b) =>
      kind === 'all' ? true : kind === 'parlay' ? b.isParlay : !b.isParlay,
    );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink-200">My bets</h1>
        <p className="mt-0.5 text-sm text-ink-400">
          Every ticket you&apos;ve placed, graded automatically as fights finish.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Record"
          value={`${stats.won}-${stats.lost}${stats.push ? `-${stats.push}` : ''}`}
          sub={stats.settled ? fmtPct(stats.winRate, 0) : '—'}
        />
        <Stat
          label="Wagered"
          value={formatMoney(stats.totalStaked)}
          sub={`${stats.settled} settled`}
        />
        <Stat
          label="Net P/L"
          value={formatMoney(stats.netProfit, { sign: stats.netProfit !== 0 })}
          tone={stats.netProfit > 0 ? 'win' : stats.netProfit < 0 ? 'loss' : 'neutral'}
          sub={stats.totalStaked ? `${fmtPct(stats.roi, 1)} ROI` : '—'}
        />
        <Stat
          label="At risk"
          value={formatMoney(bankroll.exposure)}
          sub={`${formatMoney(bankroll.potentialReturn)} to return`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cx(
                'rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
                filter === f.key
                  ? 'bg-ink-700 text-ink-200'
                  : 'text-ink-500 hover:bg-ink-800 hover:text-ink-300',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {(['all', 'single', 'parlay'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={cx(
                'rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors',
                kind === k
                  ? 'bg-ink-700 text-ink-200'
                  : 'text-ink-600 hover:text-ink-300',
              )}
            >
              {k === 'all' ? 'Both' : k === 'single' ? 'Straights' : 'Parlays'}
            </button>
          ))}
        </div>
      </div>

      {bets.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {bets.map((b) => (
            <BetCard key={b.id} bet={b} />
          ))}
        </div>
      ) : (
        <Panel>
          <Empty
            title={filter === 'all' ? 'No bets yet' : `No ${filter} bets`}
            body={
              filter === 'all'
                ? 'Open a fight card and tap some odds to get started.'
                : undefined
            }
            action={
              filter === 'all' ? (
                <Link href="/events/">
                  <Button variant="primary">Browse fight cards</Button>
                </Link>
              ) : undefined
            }
          />
        </Panel>
      )}
    </div>
  );
}
