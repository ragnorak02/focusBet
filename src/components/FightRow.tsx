'use client';

import { useState } from 'react';
import { useStore } from './Store';
import { Badge, Button } from './ui';
import { GradeDialog } from './GradeDialog';
import { formatAmerican, impliedProbability } from '@/lib/odds';
import { cx, fmtPct } from '@/lib/format';
import type { Corner, Fight, MmaEvent } from '@/lib/types';

function OddsButton({
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
  const odds = corner === 'a' ? fight.oddsA : fight.oddsB;
  const selected = isSelected(fight.id, corner);
  const fighter = corner === 'a' ? fight.a : fight.b;
  const opponent = corner === 'a' ? fight.b : fight.a;

  if (odds === null) {
    return (
      <div className="grid h-[52px] w-full place-items-center rounded-lg border border-dashed border-ink-700 text-xs text-ink-600">
        No line
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="nums grid h-[52px] w-full place-items-center rounded-lg border border-ink-700 bg-ink-900/60 text-sm font-bold text-ink-600">
        {formatAmerican(odds)}
      </div>
    );
  }

  return (
    <button
      onClick={() =>
        toggleSelection({
          eventId: event.id,
          fightId: fight.id,
          pick: corner,
          fighterName: fighter.name,
          opponentName: opponent.name,
          eventName: event.name,
          odds,
        })
      }
      className={cx(
        'group h-[52px] w-full rounded-lg border transition-all active:scale-[0.98]',
        selected
          ? 'border-brand-500 bg-brand-500 text-ink-950'
          : 'border-ink-600 bg-ink-800 text-ink-200 hover:border-brand-500/60 hover:bg-ink-700',
      )}
    >
      <div
        className={cx(
          'nums text-base font-black leading-none',
          selected ? 'text-ink-950' : 'text-brand-500',
        )}
      >
        {formatAmerican(odds)}
      </div>
      <div
        className={cx(
          'nums mt-0.5 text-[10px] font-semibold leading-none',
          selected ? 'text-ink-950/70' : 'text-ink-500',
        )}
      >
        {fmtPct(impliedProbability(odds), 0)}
      </div>
    </button>
  );
}

function CornerName({
  fight,
  corner,
  align = 'left',
}: {
  fight: Fight;
  corner: Corner;
  align?: 'left' | 'right';
}) {
  const fighter = corner === 'a' ? fight.a : fight.b;
  const r = fight.result;
  const won = r && r.outcome === corner;
  const lost = r && (r.outcome === 'a' || r.outcome === 'b') && r.outcome !== corner;

  return (
    <div className={cx('min-w-0', align === 'right' && 'text-right')}>
      <div
        className={cx(
          'truncate text-[15px] font-bold leading-tight',
          won ? 'text-brand-500' : lost ? 'text-ink-500 line-through decoration-ink-600' : 'text-ink-200',
        )}
      >
        {fighter.name}
      </div>
      <div
        className={cx(
          'nums mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-500',
          align === 'right' && 'justify-end',
        )}
      >
        {fighter.record ? <span>{fighter.record}</span> : null}
        {won ? <Badge tone="win">W</Badge> : null}
        {lost ? <Badge tone="loss">L</Badge> : null}
      </div>
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

  const settled = Boolean(fight.result);
  const live = fight.status === 'live' && !settled;
  const r = fight.result;

  const resultLine = r
    ? r.outcome === 'draw'
      ? 'Draw'
      : r.outcome === 'nc'
        ? 'No Contest'
        : [
            r.method,
            r.round ? `R${r.round}` : null,
            r.time && r.round ? r.time : null,
          ]
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
      {/* meta strip */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="nums rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-bold text-ink-400">
          #{fight.order}
        </span>
        {fight.titleFight ? <Badge tone="gold">Title</Badge> : null}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          {fight.weightClass}
        </span>
        <span className="nums text-[11px] text-ink-600">{fight.rounds}×5</span>
        {live ? (
          <Badge tone="live">
            <span className="live-dot mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
            Live
          </Badge>
        ) : null}
        {settled ? (
          <span className="text-[11px] font-semibold text-ink-400">{resultLine}</span>
        ) : null}
        {r?.source === 'espn' ? (
          <span className="text-[10px] text-ink-600">auto</span>
        ) : null}

        {editable ? (
          <div className="ml-auto flex items-center gap-1">
            {settled ? (
              <button
                onClick={() =>
                  act('clearResult', { eventId: event.id, fightId: fight.id })
                }
                disabled={busy}
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-ink-500 hover:bg-ink-700 hover:text-ink-300"
              >
                Undo
              </button>
            ) : (
              <>
                {/* Niche toggle — hidden on phones to keep the row uncluttered. */}
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
                    'hidden rounded px-1.5 py-0.5 text-[10px] font-semibold sm:block',
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

      {/* Narrow: one stacked row per corner. Wide: name | odds | vs | odds | name. */}
      <div className="hidden items-center gap-3 sm:grid sm:grid-cols-[1fr_92px_28px_92px_1fr]">
        <CornerName fight={fight} corner="a" />
        <OddsButton event={event} fight={fight} corner="a" disabled={settled} />
        <div className="text-center text-[10px] font-bold uppercase tracking-wider text-ink-600">
          vs
        </div>
        <OddsButton event={event} fight={fight} corner="b" disabled={settled} />
        <CornerName fight={fight} corner="b" align="right" />
      </div>

      <div className="space-y-1.5 sm:hidden">
        <div className="grid grid-cols-[1fr_88px] items-center gap-2">
          <CornerName fight={fight} corner="a" />
          <OddsButton event={event} fight={fight} corner="a" disabled={settled} />
        </div>
        <div className="grid grid-cols-[1fr_88px] items-center gap-2">
          <CornerName fight={fight} corner="b" />
          <OddsButton event={event} fight={fight} corner="b" disabled={settled} />
        </div>
      </div>

      <GradeDialog
        open={grading}
        onClose={() => setGrading(false)}
        event={event}
        fight={fight}
      />
    </div>
  );
}
