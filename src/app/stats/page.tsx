'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/components/Store';
import { BankrollChart } from '@/components/BankrollChart';
import { BetCard } from '@/components/BetCard';
import { Button, Empty, Modal, Panel, PanelHeader, Stat } from '@/components/ui';
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

/** One number with a caption, for the denser panels. */
function Cell({
  label,
  value,
  tone = 'neutral',
  sub,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'win' | 'loss';
  sub?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">{label}</div>
      <div
        className={cx(
          'nums text-lg font-bold',
          tone === 'win' ? 'text-brand-500' : tone === 'loss' ? 'text-loss-500' : 'text-ink-200',
        )}
      >
        {value}
      </div>
      {sub ? <div className="nums text-[11px] text-ink-500">{sub}</div> : null}
    </div>
  );
}

export default function StatsPage() {
  const { state, act, busy } = useStore();
  const { stats, allTime, bankroll, eventPnl } = state;
  const [resetting, setResetting] = useState(false);

  const netTone = stats.netProfit > 0 ? 'win' : stats.netProfit < 0 ? 'loss' : 'neutral';
  const co = stats.cashOut;
  // Positive delta = the offers taken beat what the tickets went on to do.
  const deltaTone = co.delta > 0 ? 'win' : co.delta < 0 ? 'loss' : 'neutral';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink-200">Stats</h1>
          <p className="mt-0.5 text-sm text-ink-400">
            {stats.since ? (
              <>
                Since {fmtDate(stats.since)} · all time{' '}
                <span
                  className={cx(
                    'nums font-semibold',
                    allTime.netProfit > 0
                      ? 'text-brand-500'
                      : allTime.netProfit < 0
                        ? 'text-loss-500'
                        : 'text-ink-300',
                  )}
                >
                  {formatMoney(allTime.netProfit, { sign: allTime.netProfit !== 0 })}
                </span>{' '}
                over {allTime.settled} bet{allTime.settled === 1 ? '' : 's'}
              </>
            ) : (
              'How the bankroll has actually gone over time.'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {stats.since ? (
            <Button size="sm" variant="ghost" onClick={() => act('clearStatsReset')}>
              Show all time
            </Button>
          ) : null}
          <Button size="sm" onClick={() => setResetting(true)}>
            {stats.since ? 'Reset again' : 'Reset stats'}
          </Button>
        </div>
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
          subtitle={
            stats.since
              ? 'Dashed line is where this tracking period started'
              : "Dashed line is break-even against everything you've deposited"
          }
        />
        <div className="p-3">
          <BankrollChart history={stats.history} baseline={stats.baseline} />
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
                  href={`/event/?id=${e.eventId}`}
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

      <Panel>
        <PanelHeader
          title="Cash out"
          subtitle="How often you take the offer, and what it has been worth"
          right={
            co.count ? (
              <span className="nums text-xs font-semibold text-ink-400">
                {fmtPct(co.rate, 0)} of settled tickets
              </span>
            ) : null
          }
        />
        {co.count ? (
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Cell
                label="Cashed out"
                value={String(co.count)}
                sub={`${formatMoney(co.staked)} staked`}
              />
              <Cell
                label="Taken early"
                value={formatMoney(co.taken)}
                sub={`${formatMoney(co.profit, { sign: co.profit !== 0 })} on those stakes`}
                tone={co.profit > 0 ? 'win' : co.profit < 0 ? 'loss' : 'neutral'}
              />
              <Cell
                label="Would have gone"
                value={co.resolved ? `${co.wouldHaveWon}-${co.wouldHaveLost}` : '—'}
                sub={
                  co.pending
                    ? `${co.pending} still to finish`
                    : co.resolved
                      ? `${formatMoney(co.wouldHaveReturned)} if left alone`
                      : 'Nothing finished yet'
                }
              />
              <Cell
                label="Vs riding it out"
                value={
                  co.resolved
                    ? formatMoney(co.delta, { sign: co.delta !== 0 })
                    : '—'
                }
                sub={co.resolved ? `over ${co.resolved} settled` : 'Nothing to compare yet'}
                tone={deltaTone}
              />
            </div>
            {co.resolved ? (
              <p className="border-t border-ink-700/60 pt-3 text-xs text-ink-400">
                {co.delta === 0
                  ? 'Taking the offer has come out exactly level with letting the tickets run.'
                  : co.delta > 0
                    ? `Taking the offer has been worth ${formatMoney(co.delta)} more than letting those tickets run.`
                    : `Letting those tickets run would have returned ${formatMoney(-co.delta)} more than the offers you took.`}
              </p>
            ) : null}
          </div>
        ) : (
          <Empty
            title="No cash outs yet"
            body="Settle an open ticket early and this starts keeping count — how often, and whether the offers beat riding it out."
          />
        )}
      </Panel>

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

      <Modal
        open={resetting}
        onClose={() => setResetting(false)}
        title={stats.since ? 'Start another period?' : 'Reset stats?'}
      >
        <p className="text-sm text-ink-300">
          Everything on this page starts counting from now: record, ROI, streaks, the
          curve and the cash-out numbers. Useful when you change how you bet and want
          the next stretch judged on its own.
        </p>
        <p className="mt-3 text-sm text-ink-400">
          Nothing is deleted. Your bankroll, bets and history all stay exactly as they
          are, and <span className="font-semibold text-ink-300">Show all time</span>{' '}
          brings the full record back whenever you want it.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setResetting(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              await act('resetStats');
              setResetting(false);
            }}
          >
            Start from now
          </Button>
        </div>
      </Modal>
    </div>
  );
}
