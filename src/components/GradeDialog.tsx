'use client';

import { useEffect, useState } from 'react';
import { useStore } from './Store';
import { Button, Input, Label, Modal, Select } from './ui';
import { cx } from '@/lib/format';
import type { Fight, MmaEvent, Outcome } from '@/lib/types';

const METHODS = [
  'KO/TKO',
  'Submission',
  'Decision - Unanimous',
  'Decision - Split',
  'Decision - Majority',
  'Disqualification',
  'Doctor Stoppage',
];

export function GradeDialog({
  open,
  onClose,
  event,
  fight,
}: {
  open: boolean;
  onClose: () => void;
  event: MmaEvent;
  fight: Fight;
}) {
  const { act, busy } = useStore();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [round, setRound] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    if (open) {
      setOutcome(fight.result?.outcome ?? null);
      setMethod(fight.result?.method ?? METHODS[0]);
      setRound(fight.result?.round ? String(fight.result.round) : '');
      setTime(fight.result?.time ?? '');
    }
  }, [open, fight]);

  const isDecision = method.startsWith('Decision');

  async function save() {
    if (!outcome) return;
    const res = await act('gradeFight', {
      eventId: event.id,
      fightId: fight.id,
      outcome,
      method: outcome === 'draw' || outcome === 'nc' ? undefined : method,
      round: isDecision ? fight.rounds : round ? Number(round) : undefined,
      time: isDecision ? '5:00' : time || undefined,
    });
    if (res.ok) onClose();
  }

  const winnerBtn = (o: Outcome, label: string, sub?: string) => (
    <button
      key={o}
      onClick={() => setOutcome(o)}
      className={cx(
        'rounded-lg border px-3 py-2.5 text-left transition-colors',
        outcome === o
          ? 'border-brand-500 bg-brand-500/15'
          : 'border-ink-600 bg-ink-800 hover:border-ink-500',
      )}
    >
      <div
        className={cx(
          'truncate text-sm font-bold',
          outcome === o ? 'text-brand-500' : 'text-ink-200',
        )}
      >
        {label}
      </div>
      {sub ? <div className="text-[11px] text-ink-500">{sub}</div> : null}
    </button>
  );

  return (
    <Modal open={open} onClose={onClose} title="Set result">
      <div className="mb-3 text-xs text-ink-400">
        {fight.a.name} vs {fight.b.name}
      </div>

      <Label>Winner</Label>
      <div className="grid grid-cols-2 gap-2">
        {winnerBtn('a', fight.a.name, 'wins')}
        {winnerBtn('b', fight.b.name, 'wins')}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {winnerBtn('draw', 'Draw', 'refunds bets')}
        {winnerBtn('nc', 'No Contest', 'refunds bets')}
      </div>

      {outcome === 'a' || outcome === 'b' ? (
        <>
          <div className="mt-4">
            <Label>Method</Label>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </div>

          {!isDecision ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <Label>Round</Label>
                <Select value={round} onChange={(e) => setRound(e.target.value)}>
                  <option value="">—</option>
                  {Array.from({ length: fight.rounds }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Time</Label>
                <Input
                  placeholder="3:20"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="mt-5 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={!outcome || busy}
          onClick={save}
        >
          Save & settle bets
        </Button>
      </div>
    </Modal>
  );
}
