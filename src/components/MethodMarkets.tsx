'use client';

import { useStore } from './Store';
import {
  DOUBLE_CHANCE,
  METHOD_LABEL,
  METHOD_SHORT,
  SINGLE_METHODS,
  methodOddsFor,
  methodsLabel,
  priceForMethods,
} from '@/lib/markets';
import { formatAmerican } from '@/lib/odds';
import { cx } from '@/lib/format';
import type { Corner, Fight, Method, MmaEvent } from '@/lib/types';

function PriceCell({
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
  const price = priceForMethods(methodOddsFor(fight, corner), methods);
  const selected = isSelected(fight.id, corner, 'method', methods);

  if (price === null) {
    return (
      <div className="grid h-9 place-items-center rounded-md border border-dashed border-ink-700 text-[11px] text-ink-600">
        —
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="nums grid h-9 place-items-center rounded-md border border-ink-700 bg-ink-900/60 text-[13px] font-bold text-ink-600">
        {formatAmerican(price)}
      </div>
    );
  }

  const fighter = corner === 'a' ? fight.a : fight.b;
  const opponent = corner === 'a' ? fight.b : fight.a;

  return (
    <button
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
          odds: price,
        })
      }
      className={cx(
        'nums h-9 rounded-md border text-[13px] font-bold transition-all active:scale-[0.98]',
        selected
          ? 'border-brand-500 bg-brand-500 text-ink-950'
          : 'border-ink-600 bg-ink-800 text-brand-500 hover:border-brand-500/60 hover:bg-ink-700',
      )}
    >
      {formatAmerican(price)}
    </button>
  );
}

function Row({
  label,
  hint,
  event,
  fight,
  methods,
  disabled,
}: {
  label: string;
  hint?: string;
  event: MmaEvent;
  fight: Fight;
  methods: Method[];
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_72px_72px] items-center gap-2 sm:grid-cols-[1fr_92px_92px]">
      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold text-ink-300">{label}</div>
        {hint ? <div className="truncate text-[10px] text-ink-600">{hint}</div> : null}
      </div>
      <PriceCell
        event={event}
        fight={fight}
        corner="a"
        methods={methods}
        disabled={disabled}
      />
      <PriceCell
        event={event}
        fight={fight}
        corner="b"
        methods={methods}
        disabled={disabled}
      />
    </div>
  );
}

export function MethodMarkets({
  event,
  fight,
}: {
  event: MmaEvent;
  fight: Fight;
}) {
  const disabled = Boolean(fight.result);

  return (
    <div className="mt-3 rounded-lg border border-ink-700/70 bg-ink-900/50 p-3">
      <div className="mb-2 grid grid-cols-[1fr_72px_72px] items-end gap-2 sm:grid-cols-[1fr_92px_92px]">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
          Winning method
        </div>
        <div className="truncate text-center text-[10px] font-bold text-ink-400">
          {fight.a.name.split(' ').slice(-1)[0]}
        </div>
        <div className="truncate text-center text-[10px] font-bold text-ink-400">
          {fight.b.name.split(' ').slice(-1)[0]}
        </div>
      </div>

      <div className="space-y-1.5">
        {SINGLE_METHODS.map((m) => (
          <Row
            key={m}
            label={METHOD_LABEL[m]}
            event={event}
            fight={fight}
            methods={[m]}
            disabled={disabled}
          />
        ))}
      </div>

      <div className="my-2.5 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-500">
          Double chance
        </span>
        <span className="h-px flex-1 bg-ink-700/70" />
      </div>

      <div className="space-y-1.5">
        {DOUBLE_CHANCE.map((pair) => (
          <Row
            key={pair.join('-')}
            label={methodsLabel(pair)}
            hint={`Wins by ${pair.map((m) => METHOD_SHORT[m]).join(' or ')}`}
            event={event}
            fight={fight}
            methods={pair}
            disabled={disabled}
          />
        ))}
      </div>

      <p className="mt-2.5 text-[10px] leading-relaxed text-ink-600">
        Double chance prices are derived from the single-method lines above.
      </p>
    </div>
  );
}
