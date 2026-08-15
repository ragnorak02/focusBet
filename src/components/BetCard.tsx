'use client';

import { useState } from 'react';
import { useStore } from './Store';
import { Badge, Button, Input, Modal } from './ui';
import { formatAmerican, formatMoney, round2, toAmerican } from '@/lib/odds';
import { cx, fmtDateTime } from '@/lib/format';
import type { GradedBet } from '@/lib/types';

const STATUS_TONE = {
  open: 'open',
  won: 'win',
  lost: 'loss',
  push: 'neutral',
  cashed: 'gold',
} as const;

const STATUS_LABEL = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
  push: 'Push',
  cashed: 'Cashed out',
} as const;

function LegRow({ leg }: { leg: GradedBet['legs'][number] }) {
  const dot =
    leg.status === 'won'
      ? 'bg-brand-500'
      : leg.status === 'lost'
        ? 'bg-loss-500'
        : leg.status === 'void'
          ? 'bg-ink-500'
          : 'bg-ink-600';

  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot)} />
      <div className="min-w-0 flex-1">
        <div
          className={cx(
            'truncate text-[13px] font-bold',
            leg.status === 'lost'
              ? 'text-ink-500 line-through decoration-ink-600'
              : leg.status === 'won'
                ? 'text-brand-500'
                : 'text-ink-200',
          )}
        >
          {leg.fighterName}
        </div>
        <div className="truncate text-[11px] text-ink-500">
          vs {leg.opponentName}
          {leg.status === 'void' ? ' · voided' : ''}
        </div>
      </div>
      <span className="nums shrink-0 text-xs font-bold text-ink-400">
        {formatAmerican(leg.odds)}
      </span>
    </div>
  );
}

export function BetCard({ bet }: { bet: GradedBet }) {
  const { act, busy } = useStore();
  const [cashing, setCashing] = useState(false);
  const [amount, setAmount] = useState('');

  const won = bet.status === 'won' || bet.status === 'cashed';
  const lost = bet.status === 'lost';

  // A rough live value: stake weighted by how much of the ticket is already good.
  const settledLegs = bet.legs.filter((l) => l.status === 'won').length;
  const suggested = round2(
    bet.stake *
      (1 + (bet.decimal - 1) * (settledLegs / Math.max(1, bet.legs.length)) * 0.7),
  );

  function openCashOut() {
    setAmount(String(suggested));
    setCashing(true);
  }

  return (
    <div
      className={cx(
        'rounded-xl border bg-ink-850 p-3.5',
        won
          ? 'border-brand-500/35'
          : lost
            ? 'border-ink-700/70 opacity-75'
            : 'border-ink-700/70',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[bet.status]}>{STATUS_LABEL[bet.status]}</Badge>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            {bet.isParlay ? `${bet.legs.length}-leg parlay` : 'Straight'}
          </span>
        </div>
        <span className="nums text-sm font-bold text-ink-300">
          {formatAmerican(toAmerican(bet.decimal))}
        </span>
      </div>

      <div className="divide-y divide-ink-700/50 border-y border-ink-700/50 py-0.5">
        {bet.legs.map((leg, i) => (
          <LegRow key={`${leg.fightId}-${i}`} leg={leg} />
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-ink-500">
            Stake
          </div>
          <div className="nums text-sm font-bold text-ink-200">
            {formatMoney(bet.stake)}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-ink-500">
            {bet.status === 'open' ? 'To pay' : 'Returned'}
          </div>
          <div className="nums text-sm font-bold text-ink-200">
            {formatMoney(bet.status === 'open' ? bet.potentialReturn : bet.returned)}
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-ink-500">
            {bet.status === 'open' ? 'To win' : 'P/L'}
          </div>
          <div
            className={cx(
              'nums text-sm font-bold',
              bet.status === 'open'
                ? 'text-brand-500'
                : bet.profit > 0
                  ? 'text-brand-500'
                  : bet.profit < 0
                    ? 'text-loss-500'
                    : 'text-ink-300',
            )}
          >
            {bet.status === 'open'
              ? formatMoney(bet.potentialProfit)
              : formatMoney(bet.profit, { sign: bet.profit !== 0 })}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-ink-700/50 pt-2">
        <span className="text-[10px] text-ink-600">
          {fmtDateTime(bet.placedAt)}
          {bet.legs[0]?.eventName ? ` · ${bet.legs[0].eventName}` : ''}
        </span>
        <div className="flex gap-1">
          {bet.status === 'open' ? (
            <button
              onClick={openCashOut}
              className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warn-500 hover:bg-ink-700"
            >
              Cash out
            </button>
          ) : null}
          <button
            onClick={() => act('deleteBet', { betId: bet.id })}
            disabled={busy}
            className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-600 hover:bg-ink-700 hover:text-loss-500"
          >
            Delete
          </button>
        </div>
      </div>

      <Modal open={cashing} onClose={() => setCashing(false)} title="Cash out">
        <p className="mb-3 text-xs text-ink-400">
          Settle this ticket now for a fixed amount. Suggested value is based on how
          many legs have already landed — override it with whatever you think it&apos;s
          worth.
        </p>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="nums"
        />
        <div className="nums mt-2 text-xs text-ink-500">
          Stake {formatMoney(bet.stake)} · full win pays{' '}
          {formatMoney(bet.potentialReturn)}
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setCashing(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={busy || !(Number(amount) > 0)}
            onClick={async () => {
              const res = await act('cashOutBet', {
                betId: bet.id,
                amount: Number(amount),
              });
              if (res.ok) setCashing(false);
            }}
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  );
}
