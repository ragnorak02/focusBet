'use client';

import { useState } from 'react';
import { useStore } from '@/components/Store';
import { Button, Empty, Input, Label, Modal, Panel, PanelHeader, Stat } from '@/components/ui';
import { formatMoney } from '@/lib/odds';
import { cx, fmtDateTime } from '@/lib/format';

const PRESETS = [10, 25, 50, 100];

export default function BankPage() {
  const { state, act, busy } = useStore();
  const { bankroll, stats } = state;

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [resetting, setResetting] = useState(false);

  const value = Number(amount) || 0;
  const tooMuch = mode === 'withdraw' && value > bankroll.balance;

  async function submit() {
    const res = await act(mode, { amount: value, note: note.trim() || undefined });
    if (res.ok) {
      setAmount('');
      setNote('');
    }
  }

  // Interleave cash movements with settled bets into one readable ledger.
  const ledger = [
    ...state.cash.map((c) => ({
      id: c.id,
      at: c.at,
      label: c.type === 'deposit' ? 'Deposit' : 'Cash out',
      detail: c.note ?? '',
      delta: c.type === 'deposit' ? c.amount : -c.amount,
    })),
    ...state.bets.flatMap((b) => {
      const rows = [
        {
          id: `${b.id}-stake`,
          at: b.placedAt,
          label: b.isParlay ? `${b.legs.length}-leg parlay` : 'Bet placed',
          detail: b.legs.map((l) => l.fighterName).join(' + '),
          delta: -b.stake,
        },
      ];
      if (b.status !== 'open' && b.returned !== 0) {
        rows.push({
          id: `${b.id}-return`,
          at: b.settledAt ?? b.placedAt,
          label:
            b.status === 'won'
              ? 'Bet won'
              : b.status === 'push'
                ? 'Push refund'
                : 'Cashed out',
          detail: b.legs.map((l) => l.fighterName).join(' + '),
          delta: b.returned,
        });
      }
      return rows;
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-ink-200">Bank</h1>
        <p className="mt-0.5 text-sm text-ink-400">
          Play money. Deposit whatever you want, cash out whenever you want.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Balance" value={formatMoney(bankroll.balance)} />
        <Stat label="Deposited" value={formatMoney(bankroll.deposited)} />
        <Stat label="Cashed out" value={formatMoney(bankroll.withdrawn)} />
        <Stat
          label="Net P/L"
          value={formatMoney(stats.netProfit, { sign: stats.netProfit !== 0 })}
          tone={stats.netProfit > 0 ? 'win' : stats.netProfit < 0 ? 'loss' : 'neutral'}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Panel className="h-fit">
          <div className="flex gap-1 border-b border-ink-700/70 p-2">
            {(['deposit', 'withdraw'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cx(
                  'flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition-colors',
                  mode === m ? 'bg-ink-700 text-ink-200' : 'text-ink-500 hover:text-ink-300',
                )}
              >
                {m === 'deposit' ? 'Deposit' : 'Cash out'}
              </button>
            ))}
          </div>

          <div className="p-4">
            <Label>Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-ink-500">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="nums h-14 w-full rounded-lg border border-ink-600 bg-ink-900 pl-8 pr-3 text-2xl font-black text-ink-200 focus:border-brand-500/60 focus:outline-none"
              />
            </div>

            <div className="mt-2 flex gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(String(p))}
                  className="nums flex-1 rounded-md border border-ink-600 bg-ink-800 py-2 text-xs font-bold text-ink-300 hover:border-ink-500 hover:text-ink-200"
                >
                  ${p}
                </button>
              ))}
              {mode === 'withdraw' ? (
                <button
                  onClick={() => setAmount(String(bankroll.balance))}
                  className="flex-1 rounded-md border border-ink-600 bg-ink-800 py-2 text-xs font-bold text-ink-300 hover:border-ink-500 hover:text-ink-200"
                >
                  All
                </button>
              ) : null}
            </div>

            <div className="mt-3">
              <Label>Note (optional)</Label>
              <Input
                placeholder={mode === 'deposit' ? 'Topping up for UFC 330' : 'Booking a profit'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              className="mt-4 w-full"
              disabled={busy || value <= 0 || tooMuch}
              onClick={submit}
            >
              {tooMuch
                ? 'More than your balance'
                : mode === 'deposit'
                  ? `Deposit ${formatMoney(value)}`
                  : `Cash out ${formatMoney(value)}`}
            </Button>

            {bankroll.exposure > 0 && mode === 'withdraw' ? (
              <p className="nums mt-2 text-[11px] text-ink-500">
                {formatMoney(bankroll.exposure)} is tied up in open bets and
                isn&apos;t withdrawable.
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Ledger"
            subtitle={`${ledger.length} entr${ledger.length === 1 ? 'y' : 'ies'}`}
          />
          {ledger.length ? (
            <div className="max-h-[560px] divide-y divide-ink-700/50 overflow-y-auto">
              {ledger.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink-300">
                      {r.label}
                    </div>
                    <div className="truncate text-[11px] text-ink-500">
                      {r.detail ? `${r.detail} · ` : ''}
                      {fmtDateTime(r.at)}
                    </div>
                  </div>
                  <div
                    className={cx(
                      'nums shrink-0 text-sm font-bold',
                      r.delta > 0 ? 'text-brand-500' : 'text-ink-400',
                    )}
                  >
                    {formatMoney(r.delta, { sign: true })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No activity yet" body="Make a deposit to get started." />
          )}
        </Panel>
      </div>

      <Panel className="border-loss-500/20">
        <PanelHeader
          title="Danger zone"
          subtitle="Wipes every bet, event and cash entry and restores the sample card"
          right={
            <Button variant="danger" size="sm" onClick={() => setResetting(true)}>
              Reset everything
            </Button>
          }
        />
      </Panel>

      <Modal open={resetting} onClose={() => setResetting(false)} title="Reset everything?">
        <p className="text-sm text-ink-300">
          This deletes all bets, events and cash history, then restores the starting
          $50 bankroll and the UFC 330 sample card. There&apos;s no undo.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setResetting(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            disabled={busy}
            onClick={async () => {
              await act('resetAll');
              setResetting(false);
            }}
          >
            Yes, reset
          </Button>
        </div>
      </Modal>
    </div>
  );
}
