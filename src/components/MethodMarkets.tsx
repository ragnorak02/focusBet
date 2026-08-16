'use client';

import { useState } from 'react';
import { useStore } from './Store';
import { PriceButton } from './FightRow';
import {
  DOUBLE_CHANCE,
  METHOD_LABEL,
  SINGLE_METHODS,
  isExplicitPair,
  methodOddsFor,
  methodsLabel,
  priceForMethods,
} from '@/lib/markets';
import { cx } from '@/lib/format';
import type { Corner, Fight, Method, MmaEvent } from '@/lib/types';

function MethodCell({
  event,
  fight,
  corner,
  methods,
  disabled,
}: {
  event: MmaEvent;
  fight: Fight;
  corner: Corner;
  methods: Method[];
  disabled: boolean;
}) {
  const { isSelected, toggleSelection } = useStore();
  const odds = methodOddsFor(fight, corner);
  const price = priceForMethods(odds, methods);
  const derived = methods.length === 2 && price !== null && !isExplicitPair(odds, methods);

  const fighter = corner === 'a' ? fight.a : fight.b;
  const opponent = corner === 'a' ? fight.b : fight.a;

  return (
    <div className="relative">
      <PriceButton
        size="sm"
        price={price}
        disabled={disabled}
        selected={isSelected(fight.id, corner, 'method', methods)}
        onClick={() =>
          toggleSelection({
            eventId: event.id,
            fightId: fight.id,
            pick: corner,
            market: 'method',
            methods,
            fighterName: fighter.name,
            opponentName: opponent.name,
            eventName: event.name,
            odds: price as number,
          })
        }
      />
      {derived ? (
        <span
          title="Estimated from the single-method prices — no book line entered"
          className="pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-warn-500"
        />
      ) : null}
    </div>
  );
}

function Grid({
  event,
  fight,
  rows,
  disabled,
}: {
  event: MmaEvent;
  fight: Fight;
  rows: { key: string; label: string; methods: Method[] }[];
  disabled: boolean;
}) {
  return (
    <>
      <div className="mb-1.5 grid grid-cols-[1fr_72px_72px] items-end gap-2 sm:grid-cols-[1fr_92px_92px]">
        <div />
        {(['a', 'b'] as const).map((c) => (
          <div
            key={c}
            className="truncate text-center text-[10px] font-bold text-ink-400"
          >
            {(c === 'a' ? fight.a : fight.b).name.split(' ').slice(-1)[0]}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[1fr_72px_72px] items-center gap-2 sm:grid-cols-[1fr_92px_92px]"
          >
            <div className="truncate text-[12px] font-semibold text-ink-300">
              {row.label}
            </div>
            <MethodCell
              event={event}
              fight={fight}
              corner="a"
              methods={row.methods}
              disabled={disabled}
            />
            <MethodCell
              event={event}
              fight={fight}
              corner="b"
              methods={row.methods}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export function MethodMarkets({ event, fight }: { event: MmaEvent; fight: Fight }) {
  const { isSelected, toggleSelection } = useStore();
  const [tab, setTab] = useState<'single' | 'double'>('single');
  const disabled = Boolean(fight.result);

  const rows =
    tab === 'single'
      ? SINGLE_METHODS.map((m) => ({ key: m, label: METHOD_LABEL[m], methods: [m] }))
      : DOUBLE_CHANCE.map((pair) => ({
          key: pair.join('-'),
          label: methodsLabel(pair),
          methods: pair,
        }));

  return (
    <div className="mt-2.5 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3">
      <div className="mb-3 flex gap-1 rounded-lg bg-ink-900 p-1">
        {(['single', 'double'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              'flex-1 rounded-md py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
              tab === t ? 'bg-ink-700 text-ink-200' : 'text-ink-500 hover:text-ink-300',
            )}
          >
            {t === 'single' ? 'Method of victory' : 'Double chance'}
          </button>
        ))}
      </div>

      <Grid event={event} fight={fight} rows={rows} disabled={disabled} />

      {fight.drawOdds != null ? (
        <div className="mt-2.5 grid grid-cols-[1fr_72px_72px] items-center gap-2 border-t border-ink-700/70 pt-2.5 sm:grid-cols-[1fr_92px_92px]">
          <div className="truncate text-[12px] font-semibold text-ink-300">Draw</div>
          <div className="col-span-2">
            <PriceButton
              size="sm"
              price={fight.drawOdds}
              disabled={disabled}
              selected={isSelected(fight.id, 'a', 'draw')}
              onClick={() =>
                toggleSelection({
                  eventId: event.id,
                  fightId: fight.id,
                  pick: 'a',
                  market: 'draw',
                  fighterName: fight.a.name,
                  opponentName: fight.b.name,
                  eventName: event.name,
                  odds: fight.drawOdds as number,
                })
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
