'use client';

import Link from 'next/link';
import { useStore } from '@/components/Store';
import { BetCard } from '@/components/BetCard';
import { Badge, Button, Empty, Panel, PanelHeader, Stat } from '@/components/ui';
import { formatMoney } from '@/lib/odds';
import { cx, daysUntil, fmtDate, fmtPct } from '@/lib/format';

export default function Home() {
  const { state } = useStore();
  const { bankroll, stats, events, bets } = state;

  const openBets = bets.filter((b) => b.status === 'open');
  const recent = bets.filter((b) => b.status !== 'open').slice(0, 4);

  const upcoming = [...events].sort((a, b) => {
    const da = Math.abs(daysUntil(a.date));
    const db = Math.abs(daysUntil(b.date));
    return da - db;
  });
  const featured = upcoming[0];

  const netTone = stats.netProfit > 0 ? 'win' : stats.netProfit < 0 ? 'loss' : 'neutral';

  return (
    <div className="space-y-5">
      {/* bankroll hero */}
      <Panel className="overflow-hidden">
        <div className="relative px-5 py-5">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/[0.07] to-transparent" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-400">
                Bankroll
              </div>
              <div className="nums mt-1 text-4xl font-black tracking-tight text-ink-200">
                {formatMoney(bankroll.balance)}
              </div>
              <div className="nums mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
                <span>
                  Deposited{' '}
                  <span className="font-bold text-ink-300">
                    {formatMoney(bankroll.deposited)}
                  </span>
                </span>
                <span
                  className={cx(
                    'font-bold',
                    stats.netProfit > 0
                      ? 'text-brand-500'
                      : stats.netProfit < 0
                        ? 'text-loss-500'
                        : 'text-ink-300',
                  )}
                >
                  {formatMoney(stats.netProfit, { sign: stats.netProfit !== 0 })} all
                  time
                </span>
                {bankroll.exposure > 0 ? (
                  <span>
                    {formatMoney(bankroll.exposure)} at risk ·{' '}
                    {formatMoney(bankroll.potentialReturn)} to return
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/bank/">
                <Button variant="primary">Deposit</Button>
              </Link>
              <Link href="/events/">
                <Button>Fight cards</Button>
              </Link>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Record"
          value={`${stats.won}-${stats.lost}${stats.push ? `-${stats.push}` : ''}`}
          sub={stats.settled ? `${fmtPct(stats.winRate, 0)} win rate` : 'No settled bets'}
        />
        <Stat
          label="Net P/L"
          value={formatMoney(stats.netProfit, { sign: stats.netProfit !== 0 })}
          sub={stats.totalStaked ? `${fmtPct(stats.roi, 1)} ROI` : '—'}
          tone={netTone}
        />
        <Stat
          label="Open"
          value={stats.open}
          sub={`${formatMoney(bankroll.exposure)} at risk`}
        />
        <Stat
          label="Streak"
          value={
            stats.currentStreak.type
              ? `${stats.currentStreak.count}${stats.currentStreak.type}`
              : '—'
          }
          sub={`Best run ${stats.longestWinStreak}W`}
          tone={
            stats.currentStreak.type === 'W'
              ? 'win'
              : stats.currentStreak.type === 'L'
                ? 'loss'
                : 'neutral'
          }
        />
      </div>

      {featured ? (
        <Panel>
          <PanelHeader
            title="Next up"
            subtitle={`${fmtDate(featured.date)}${featured.location ? ` · ${featured.location}` : ''}`}
            right={
              <Link href={`/event/?id=${featured.id}`}>
                <Button size="sm" variant="primary">
                  Open card
                </Button>
              </Link>
            }
          />
          <div className="p-4">
            <div className="text-lg font-black tracking-tight text-ink-200">
              {featured.name}
            </div>
            <div className="mt-3 space-y-2">
              {[...featured.fights]
                .sort((a, b) => b.order - a.order)
                .slice(0, 3)
                .map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-ink-900/60 px-3 py-2"
                  >
                    <div className="min-w-0 truncate text-sm font-semibold text-ink-300">
                      {f.a.name}{' '}
                      <span className="text-ink-600">vs</span> {f.b.name}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {f.titleFight ? <Badge tone="gold">Title</Badge> : null}
                      {f.result ? (
                        <Badge tone="win">Final</Badge>
                      ) : f.status === 'live' ? (
                        <Badge tone="live">Live</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-3 text-xs text-ink-500">
              {featured.fights.length} bouts ·{' '}
              {featured.fights.filter((f) => f.result).length} final
            </div>
          </div>
        </Panel>
      ) : (
        <Panel>
          <Empty
            title="No events yet"
            body="Import a UFC card from the live feed, or build one by hand."
            action={
              <Link href="/events/">
                <Button variant="primary">Add an event</Button>
              </Link>
            }
          />
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Open bets"
            subtitle={openBets.length ? `${openBets.length} live` : undefined}
            right={
              <Link
                href="/bets/"
                className="text-xs font-semibold text-ink-400 hover:text-ink-200"
              >
                View all
              </Link>
            }
          />
          <div className="space-y-2.5 p-3">
            {openBets.length ? (
              openBets.slice(0, 4).map((b) => <BetCard key={b.id} bet={b} />)
            ) : (
              <Empty title="Nothing riding" body="Pick some odds off a fight card." />
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Recently settled" />
          <div className="space-y-2.5 p-3">
            {recent.length ? (
              recent.map((b) => <BetCard key={b.id} bet={b} />)
            ) : (
              <Empty title="No settled bets yet" />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
