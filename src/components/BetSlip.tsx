'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from './Store';
import { Button, Panel, PanelHeader } from './ui';
import {
  formatAmerican,
  formatMoney,
  parlayDecimal,
  round2,
  toAmerican,
} from '@/lib/odds';
import { methodsLabel } from '@/lib/markets';
import { cx } from '@/lib/format';

const QUICK = [1, 5, 10, 25];

export function BetSlip({ compact = false }: { compact?: boolean }) {
  const { slip, removeSelection, clearSlip, act, busy, state } = useStore();
  const [mode, setMode] = useState<'single' | 'parlay'>('parlay');
  const [parlayStake, setParlayStake] = useState('');
  const [singleStakes, setSingleStakes] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(false);

  const balance = state.bankroll.balance;

  // One leg is always a straight bet, no matter which tab is showing.
  const effectiveMode = slip.length < 2 ? 'single' : mode;

  useEffect(() => {
    if (slip.length === 0) {
      setParlayStake('');
      setSingleStakes({});
      setCollapsed(false);
    }
  }, [slip.length]);

  const parlayDec = useMemo(
    () => parlayDecimal(slip.map((s) => s.odds)),
    [slip],
  );

  const parlayStakeNum = Number(parlayStake) || 0;
  const parlayReturn = round2(parlayStakeNum * parlayDec);

  const singlesTotal = useMemo(
    () =>
      slip.reduce((sum, s) => sum + (Number(singleStakes[s.fightId]) || 0), 0),
    [slip, singleStakes],
  );

  const totalStake = effectiveMode === 'parlay' ? parlayStakeNum : singlesTotal;
  const overBalance = totalStake > balance + 1e-9;

  async function placeParlay() {
    if (parlayStakeNum <= 0) return;
    const res = await act('placeBet', {
      stake: parlayStakeNum,
      legs: slip.map((s) => ({
        eventId: s.eventId,
        fightId: s.fightId,
        pick: s.pick,
        market: s.market,
        methods: s.methods,
      })),
    });
    if (res.ok) clearSlip();
  }

  async function placeSingles() {
    const toPlace = slip.filter((s) => (Number(singleStakes[s.fightId]) || 0) > 0);
    if (!toPlace.length) return;

    let placed = 0;
    for (const s of toPlace) {
      const res = await act('placeBet', {
        stake: Number(singleStakes[s.fightId]),
        legs: [
          {
            eventId: s.eventId,
            fightId: s.fightId,
            pick: s.pick,
            market: s.market,
            methods: s.methods,
          },
        ],
      });
      if (res.ok) {
        placed++;
        removeSelection(s.fightId);
      } else {
        // Stop on the first rejection so the user can fix it.
        break;
      }
    }
    if (placed > 0) {
      setSingleStakes({});
    }
  }

  if (slip.length === 0) {
    if (compact) return null;
    return (
      <Panel>
        <PanelHeader title="Bet Slip" />
        <div className="px-4 py-10 text-center">
          <div className="text-sm font-semibold text-ink-300">Slip is empty</div>
          <div className="mt-1 text-xs text-ink-500">
            Tap any odds on a fight card to add a selection.
          </div>
        </div>
      </Panel>
    );
  }

  const header = (
    <div className="flex items-center gap-2">
      <span className="grid h-5 min-w-5 place-items-center rounded bg-brand-500 px-1 text-[11px] font-black text-ink-950">
        {slip.length}
      </span>
      <span>Bet Slip</span>
    </div>
  );

  return (
    <Panel className={cx(compact && 'border-0 bg-transparent shadow-none')}>
      <PanelHeader
        title={header}
        right={
          <div className="flex items-center gap-1">
            {compact ? (
              <button
                onClick={() => setCollapsed((c) => !c)}
                className="rounded px-2 py-1 text-[11px] font-semibold text-ink-400 hover:bg-ink-700 hover:text-ink-200"
              >
                {collapsed ? 'Show' : 'Hide'}
              </button>
            ) : null}
            <button
              onClick={clearSlip}
              className="rounded px-2 py-1 text-[11px] font-semibold text-ink-400 hover:bg-ink-700 hover:text-loss-500"
            >
              Clear
            </button>
          </div>
        }
      />

      {collapsed ? null : (
        <>
          {slip.length > 1 ? (
            <div className="flex gap-1 border-b border-ink-700/70 p-2">
              {(['single', 'parlay'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cx(
                    'flex-1 rounded-lg py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
                    effectiveMode === m
                      ? 'bg-ink-700 text-ink-200'
                      : 'text-ink-500 hover:text-ink-300',
                  )}
                >
                  {m === 'single' ? `Singles (${slip.length})` : 'Parlay'}
                </button>
              ))}
            </div>
          ) : null}

          <div className="max-h-[42vh] divide-y divide-ink-700/60 overflow-y-auto">
            {slip.map((s) => (
              <div key={s.fightId} className="slip-in p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-ink-200">
                      {s.fighterName}
                    </div>
                    {s.market === 'method' && s.methods?.length ? (
                      <div className="truncate text-[11px] font-semibold text-warn-500">
                        by {methodsLabel(s.methods)}
                      </div>
                    ) : null}
                    <div className="truncate text-[11px] text-ink-500">
                      vs {s.opponentName}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-ink-600">
                      {s.eventName}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="nums text-sm font-bold text-brand-500">
                      {formatAmerican(s.odds)}
                    </span>
                    <button
                      onClick={() => removeSelection(s.fightId)}
                      className="rounded p-1 text-ink-500 hover:bg-ink-700 hover:text-loss-500"
                      aria-label={`Remove ${s.fighterName}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M4 4l8 8M12 4l-8 8"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {effectiveMode === 'single' ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500">
                        $
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={singleStakes[s.fightId] ?? ''}
                        onChange={(e) =>
                          setSingleStakes((cur) => ({
                            ...cur,
                            [s.fightId]: e.target.value,
                          }))
                        }
                        className="nums h-9 w-full rounded-lg border border-ink-600 bg-ink-900 pl-6 pr-2 text-sm font-semibold text-ink-200 focus:border-brand-500/60 focus:outline-none"
                      />
                    </div>
                    <div className="nums shrink-0 text-right">
                      <div className="text-[9px] uppercase tracking-wider text-ink-500">
                        To win
                      </div>
                      <div className="text-xs font-bold text-brand-500">
                        {formatMoney(
                          round2(
                            (Number(singleStakes[s.fightId]) || 0) *
                              parlayDecimal([s.odds]) -
                              (Number(singleStakes[s.fightId]) || 0),
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="border-t border-ink-700/70 p-3">
            {effectiveMode === 'parlay' ? (
              <>
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-ink-400">
                    {slip.length}-leg parlay
                  </span>
                  <span className="nums font-bold text-brand-500">
                    {formatAmerican(toAmerican(parlayDec))}
                  </span>
                </div>

                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-500">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={parlayStake}
                      onChange={(e) => setParlayStake(e.target.value)}
                      className="nums h-11 w-full rounded-lg border border-ink-600 bg-ink-900 pl-7 pr-3 text-base font-bold text-ink-200 focus:border-brand-500/60 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-2 flex gap-1.5">
                  {QUICK.map((q) => (
                    <button
                      key={q}
                      onClick={() =>
                        setParlayStake(String(round2(parlayStakeNum + q)))
                      }
                      className="nums flex-1 rounded-md border border-ink-600 bg-ink-800 py-1.5 text-[11px] font-bold text-ink-300 hover:border-ink-500 hover:text-ink-200"
                    >
                      +${q}
                    </button>
                  ))}
                  <button
                    onClick={() => setParlayStake(String(round2(balance)))}
                    className="flex-1 rounded-md border border-ink-600 bg-ink-800 py-1.5 text-[11px] font-bold text-ink-300 hover:border-ink-500 hover:text-ink-200"
                  >
                    Max
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-lg bg-ink-900 px-3 py-2">
                  <span className="text-xs font-semibold text-ink-400">
                    Total payout
                  </span>
                  <span className="nums text-base font-black text-brand-500">
                    {formatMoney(parlayReturn)}
                  </span>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="mt-2 w-full"
                  disabled={busy || parlayStakeNum <= 0 || overBalance}
                  onClick={placeParlay}
                >
                  {overBalance
                    ? 'Not enough funds'
                    : `Place ${formatMoney(parlayStakeNum)} parlay`}
                </Button>
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between rounded-lg bg-ink-900 px-3 py-2">
                  <span className="text-xs font-semibold text-ink-400">
                    Total stake
                  </span>
                  <span className="nums text-base font-black text-ink-200">
                    {formatMoney(singlesTotal)}
                  </span>
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={busy || singlesTotal <= 0 || overBalance}
                  onClick={placeSingles}
                >
                  {overBalance
                    ? 'Not enough funds'
                    : `Place ${slip.filter((s) => (Number(singleStakes[s.fightId]) || 0) > 0).length || ''} bet${
                        slip.filter((s) => (Number(singleStakes[s.fightId]) || 0) > 0)
                          .length === 1
                          ? ''
                          : 's'
                      }`}
                </Button>
              </>
            )}

            <div className="nums mt-2 text-center text-[11px] text-ink-500">
              Balance {formatMoney(balance)}
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}
