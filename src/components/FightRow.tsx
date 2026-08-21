'use client';

import { useState } from 'react';
import { useStore } from './Store';
import { Badge } from './ui';
import { GradeDialog } from './GradeDialog';
import { MethodMarkets } from './MethodMarkets';
import { LinesDialog } from './LinesDialog';
import {
  formatSpread,
  formatTotalLine,
  hasAnyExtraMarket,
  hasMethodMarkets,
  spreadFor,
} from '@/lib/markets';
import { formatAmerican } from '@/lib/odds';
import { cx, surname, weightAbbrev } from '@/lib/format';
import type { Corner, Fight, MmaEvent } from '@/lib/types';

/** A price button with an optional line above it, DraftKings style. */
export function PriceButton({
  line,
  price,
  selected,
  disabled,
  onClick,
  size = 'md',
}: {
  line?: string;
  price: number | null;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  size?: 'sm' | 'md';
}) {
  const height = size === 'sm' ? 'h-9' : 'h-[46px]';

  if (price === null) {
    return (
      <div
        className={cx(
          'grid w-full place-items-center rounded-md border border-dashed border-ink-700 text-[11px] text-ink-600',
          height,
        )}
      >
        —
      </div>
    );
  }

  if (disabled) {
    return (
      <div
        className={cx(
          'nums grid w-full place-items-center rounded-md border border-ink-700 bg-ink-900/60 text-[13px] font-bold text-ink-600',
          height,
        )}
      >
        {price === null ? '—' : formatAmerican(price)}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cx(
        'w-full rounded-md border leading-tight transition-all active:scale-[0.98]',
        height,
        selected
          ? 'border-brand-500 bg-brand-500'
          : 'border-ink-600 bg-ink-800 hover:border-brand-500/60 hover:bg-ink-700',
      )}
    >
      {line ? (
        <div
          className={cx(
            'nums text-[11px] font-semibold',
            selected ? 'text-ink-950/70' : 'text-ink-300',
          )}
        >
          {line}
        </div>
      ) : null}
      <div
        className={cx(
          'nums text-[14px] font-black',
          selected ? 'text-ink-950' : 'text-brand-500',
        )}
      >
        {formatAmerican(price)}
      </div>
    </button>
  );
}

function CornerRow({
  event,
  fight,
  corner,
  disabled,
}: {
  event: MmaEvent;
  fight: Fight;
  corner: Corner;
  disabled: boolean;
}) {
  const { isSelected, toggleSelection } = useStore();
  const fighter = corner === 'a' ? fight.a : fight.b;
  const opponent = corner === 'a' ? fight.b : fight.a;
  const r = fight.result;
  const won = r && r.outcome === corner;
  const lost = r && (r.outcome === 'a' || r.outcome === 'b') && r.outcome !== corner;

  const base = {
    eventId: event.id,
    fightId: fight.id,
    pick: corner,
    fighterName: fighter.name,
    opponentName: opponent.name,
    eventName: event.name,
  };

  const ml = corner === 'a' ? fight.oddsA : fight.oddsB;
  const spreadValue = spreadFor(fight, corner);
  const spreadOdds = fight.spread
    ? corner === 'a'
      ? fight.spread.oddsA
      : fight.spread.oddsB
    : null;

  // DraftKings puts the over on the top fighter's row and the under below it.
  const side = corner === 'a' ? 'over' : 'under';
  const total = fight.totalRounds;
  const totalOdds = total ? (side === 'over' ? total.over : total.under) : null;

  return (
    <div className="grid grid-cols-[1fr_repeat(3,minmax(0,62px))] items-center gap-1 min-[400px]:grid-cols-[1fr_repeat(3,minmax(0,72px))] min-[400px]:gap-1.5 sm:grid-cols-[1fr_repeat(3,minmax(0,92px))] sm:gap-2">
      <div className="min-w-0">
        <div
          title={fighter.name}
          className={cx(
            'truncate text-[15px] font-bold leading-tight',
            won
              ? 'text-brand-500'
              : lost
                ? 'text-ink-500 line-through decoration-ink-600'
                : 'text-ink-200',
          )}
        >
          {surname(fighter.name)}
        </div>
        <div className="nums mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-500">
          {fighter.record ? <span>{fighter.record}</span> : null}
          {won ? <Badge tone="win">W</Badge> : null}
          {lost ? <Badge tone="loss">L</Badge> : null}
        </div>
      </div>

      <PriceButton
        line={spreadValue !== null ? formatSpread(spreadValue) : undefined}
        price={spreadOdds}
        disabled={disabled}
        selected={isSelected(fight.id, corner, 'spread')}
        onClick={() =>
          toggleSelection({
            ...base,
            market: 'spread',
            line: spreadValue ?? undefined,
            odds: spreadOdds as number,
          })
        }
      />

      <PriceButton
        line={total ? formatTotalLine(total.line, side) : undefined}
        price={totalOdds}
        disabled={disabled}
        selected={isSelected(fight.id, corner, 'total')}
        onClick={() =>
          toggleSelection({
            ...base,
            market: 'total',
            side,
            line: total?.line,
            odds: totalOdds as number,
          })
        }
      />

      <PriceButton
        price={ml}
        disabled={disabled}
        selected={isSelected(fight.id, corner, 'moneyline')}
        onClick={() =>
          toggleSelection({ ...base, market: 'moneyline', odds: ml as number })
        }
      />
    </div>
  );
}

export function FightRow({
  event,
  fight,
  editable = true,
}: {
  event: MmaEvent;
  fight: Fight;
  editable?: boolean;
}) {
  const { act, busy } = useStore();
  const [grading, setGrading] = useState(false);
  const [showMethods, setShowMethods] = useState(false);
  const [editingLines, setEditingLines] = useState(false);

  const settled = Boolean(fight.result);
  const live = fight.status === 'live' && !settled;
  const r = fight.result;
  const methods = hasMethodMarkets(fight);

  const resultLine = r
    ? r.outcome === 'draw'
      ? 'Draw'
      : r.outcome === 'nc'
        ? 'No Contest'
        : [r.method, r.round ? `R${r.round}` : null, r.time && r.round ? r.time : null]
            .filter(Boolean)
            .join(' · ')
    : null;

  return (
    <div
      className={cx(
        'relative px-3 py-3 transition-colors sm:px-4',
        settled ? 'bg-ink-900/40' : live ? 'bg-live-500/[0.06]' : 'hover:bg-ink-800/40',
      )}
    >
      {/* One line per bout: division, both names in full, and how it ended.
          The bout number, the rounds label and the editing controls used to sit
          on a row of their own above this — two rows of chrome per fight, and
          thirteen fights of scrolling on a phone. */}
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="shrink-0 rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
          {weightAbbrev(fight.weightClass)}
        </span>
        {fight.titleFight ? <Badge tone="gold">Title</Badge> : null}
        {/* Only worth saying when it isn't the usual three, since the rounds
            market prices off it. */}
        {fight.rounds !== 3 ? (
          <span className="nums text-[10px] font-bold text-ink-500">{fight.rounds}R</span>
        ) : null}

        <span className="min-w-0 text-[13px] font-bold leading-snug text-ink-300">
          {fight.a.name}
          <span className="px-1.5 text-[11px] font-semibold uppercase text-ink-600">vs</span>
          {fight.b.name}
        </span>

        {live ? (
          <Badge tone="live">
            <span className="live-dot mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
            Live
          </Badge>
        ) : null}
        {settled ? (
          <span className="text-[11px] font-semibold text-ink-400">{resultLine}</span>
        ) : null}
        {settled && r?.scoreA != null && r?.scoreB != null ? (
          <span className="nums text-[11px] text-ink-500">
            {r.scoreA}–{r.scoreB}
          </span>
        ) : null}

        {editable ? (
          <div className="ml-auto flex items-center gap-1">
            {settled ? (
              <>
                <button
                  onClick={() => setGrading(true)}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-ink-500 hover:bg-ink-700 hover:text-brand-500 sm:px-1.5 sm:py-0.5 sm:text-[10px]"
                >
                  Edit result
                </button>
                <button
                  onClick={() => act('clearResult', { eventId: event.id, fightId: fight.id })}
                  disabled={busy}
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-ink-500 hover:bg-ink-700 hover:text-ink-300"
                >
                  Undo
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() =>
                    act('setFightStatus', {
                      eventId: event.id,
                      fightId: fight.id,
                      status: live ? 'scheduled' : 'live',
                    })
                  }
                  disabled={busy}
                  className={cx(
                    'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                    live
                      ? 'text-live-500 hover:bg-ink-700'
                      : 'text-ink-500 hover:bg-ink-700 hover:text-ink-300',
                  )}
                >
                  {live ? 'End live' : 'Go live'}
                </button>
                <button
                  onClick={() => setGrading(true)}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-ink-500 hover:bg-ink-700 hover:text-brand-500 sm:px-1.5 sm:py-0.5 sm:text-[10px]"
                >
                  Set result
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>

      {/* column headers */}
      <div className="mb-1 grid grid-cols-[1fr_repeat(3,minmax(0,62px))] gap-1 min-[400px]:grid-cols-[1fr_repeat(3,minmax(0,72px))] min-[400px]:gap-1.5 sm:grid-cols-[1fr_repeat(3,minmax(0,92px))] sm:gap-2">
        <div />
        {['Spread', 'Rounds', 'Money'].map((h) => (
          <div
            key={h}
            className="text-center text-[9px] font-bold uppercase tracking-wider text-ink-600"
          >
            {h}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <CornerRow event={event} fight={fight} corner="a" disabled={settled} />
        <CornerRow event={event} fight={fight} corner="b" disabled={settled} />
      </div>

      {methods ? (
        <>
          <button
            onClick={() => setShowMethods((v) => !v)}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800/60 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-400 transition-colors hover:border-ink-600 hover:text-ink-200"
          >
            {showMethods ? 'Hide' : 'Winning method'}
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              className={cx('transition-transform', showMethods && 'rotate-180')}
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {showMethods ? <MethodMarkets event={event} fight={fight} /> : null}
        </>
      ) : null}

      {editable ? (
        <button
          onClick={() => setEditingLines(true)}
          className={cx(
            'mt-1.5 w-full text-center text-[10px] font-semibold uppercase tracking-wider text-ink-600 hover:text-ink-300',
            !hasAnyExtraMarket(fight) &&
              !settled &&
              'rounded-lg border border-dashed border-ink-700 py-1.5 hover:border-ink-600',
          )}
        >
          {hasAnyExtraMarket(fight) ? 'Edit lines' : '+ Add spread, rounds & method lines'}
        </button>
      ) : null}

      <GradeDialog
        open={grading}
        onClose={() => setGrading(false)}
        event={event}
        fight={fight}
      />
      <LinesDialog
        open={editingLines}
        onClose={() => setEditingLines(false)}
        event={event}
        fight={fight}
      />
    </div>
  );
}
