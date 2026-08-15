'use client';

import Link from 'next/link';
import { useStore } from '@/components/Store';
import { BankrollChart } from '@/components/BankrollChart';
import { BetCard } from '@/components/BetCard';
import { Empty, Panel, PanelHeader, Stat } from '@/components/ui';
import { formatMoney } from '@/lib/odds';
import { cx, fmtDate, fmtPct } from '@/lib/format';

function Bar({
  label,
  won,
  lost,
  profit,
}: {
  label: string;
  won: number;
  lost: number;
  profit: number;
}) {
  const total = won + lost;
  const pct = total ? (won / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-ink-300">{label}</span>
        <span className="nums text-ink-400">
          {won}-{lost}
          {total ? ` · ${pct.toFixed(0)}%` : ''}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={cx(
          'nums mt-1 text-[11px] font-bold',
          profit > 0 ? 'text-brand-500' : profit < 0 ? 'text-loss-500' : 'text-ink-500',
        )}
      >
        {formatMoney(profit, { sign: profit !== 0 })}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { state } = useStore();
  const { stats, bankroll, eventPnl } = state;

  const netTone = stats.netProfit > 0 ? 'win' : stats.netProfit < 0 ? 'loss' : 'neutral';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink-200">Stats</h1>
        <p className="mt-0.5 text-sm text-ink-400">
          How the bankroll has actually gone over time.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Balance"
          value={formatMoney(bankroll.balance)}
          sub={`${formatMoney(bankroll.deposited)} deposited`}
        />
        <Stat
          label="Net P/L"
          value={formatMoney(stats.netProfit, { sign: stats.netProfit !== 0 })}
          sub={stats.totalStaked ? `${fmtPct(stats.roi, 1)} ROI` : 'No settled bets'}
          tone={netTone}
        />
        <Stat
          label="Record"
          value={`${stats.won}-${stats.lost}${stats.push ? `-${stats.push}` : ''}`}
          sub={stats.settled ? `${fmtPct(stats.winRate, 1)} win rate` : '—'}
        />
        <Stat
          label="Legs"
          value={`${stats.legRecord.won}-${stats.legRecord.lost}`}
          sub={
            stats.legRecord.void
              ? `${stats.legRecord.void} voided`
              : 'Individual picks'
          }
        />
      </div>

      <Panel>
        <PanelHeader
          title="Bankroll over time"
          subtitle="Dashed line is break-even against everything you've deposited"
        />
        <div className="p-3">
          <BankrollChart history={stats.history} deposited={bankroll.deposited} />
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Straights vs parlays" />
          <div className="space-y-4 p-4">
            <Bar
              label="Straight bets"
              won={stats.singles.won}
              lost={stats.singles.lost}
              profit={stats.singles.profit}
            />
            <Bar
              label="Parlays"
              won={stats.parlays.won}
              lost={stats.parlays.lost}
              profit={stats.parlays.profit}
            />
            <div className="grid grid-cols-2 gap-3 border-t border-ink-700/60 pt-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  Longest win streak
                </div>
                <div className="nums text-lg font-bold text-ink-200">
                  {stats.longestWinStreak}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
                  Current streak
                </div>
                <div
                  className={cx(
                    'nums text-lg font-bold',
                    stats.currentStreak.type === 'W'
                      ? 'text-brand-500'
                      : stats.currentStreak.type === 'L'
                        ? 'text-loss-500'
                        : 'text-ink-300',
                  )}
                >
                  {stats.currentStreak.type
                    ? `${stats.currentStreak.count}${stats.currentStreak.type}`
                    : '—'}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="By event" />
          {eventPnl.length ? (
            <div className="divide-y divide-ink-700/50">
              {eventPnl.map((e) => (
                <Link
                  key={e.eventId}
                  href={`/events/${e.eventId}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-ink-800/50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink-300">
                      {e.name}
                    </div>
                    <div className="nums text-[11px] text-ink-500">
                      {fmtDate(e.date)} · {e.bets} bet{e.bets === 1 ? '' : 's'} ·{' '}
                      {formatMoney(e.staked)} wagered
                    </div>
                  </div>
                  <div
                    className={cx(
                      'nums shrink-0 text-sm font-bold',
                      e.profit > 0
                        ? 'text-brand-500'
                        : e.profit < 0
                          ? 'text-loss-500'
                          : 'text-ink-400',
                    )}
                  >
                    {formatMoney(e.profit, { sign: e.profit !== 0 })}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Empty title="No settled bets yet" />
          )}
        </Panel>
      </div>

      {stats.biggestWin || stats.biggestLoss ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {stats.biggestWin ? (
            <Panel>
              <PanelHeader
                title="Biggest win"
                subtitle={formatMoney(stats.biggestWin.profit, { sign: true })}
              />
              <div className="p-3">
                <BetCard bet={stats.biggestWin} />
              </div>
            </Panel>
          ) : null}
          {stats.biggestLoss ? (
            <Panel>
              <PanelHeader
                title="Biggest loss"
                subtitle={formatMoney(-stats.biggestLoss.stake, { sign: true })}
              />
              <div className="p-3">
                <BetCard bet={stats.biggestLoss} />
              </div>
            </Panel>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
