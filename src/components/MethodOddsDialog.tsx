'use client';

import { useEffect, useState } from 'react';
import { useStore } from './Store';
import { Button, Modal } from './ui';
import { METHOD_LABEL, SINGLE_METHODS } from '@/lib/markets';
import type { Corner, Fight, Method, MmaEvent } from '@/lib/types';

type Draft = Record<Corner, Record<Method, string>>;

const blank = (): Draft => ({
  a: { ko: '', sub: '', dec: '' },
  b: { ko: '', sub: '', dec: '' },
});

function fromFight(fight: Fight): Draft {
  const read = (corner: Corner) => {
    const o = corner === 'a' ? fight.methodA : fight.methodB;
    return {
      ko: o?.ko != null ? String(o.ko) : '',
      sub: o?.sub != null ? String(o.sub) : '',
      dec: o?.dec != null ? String(o.dec) : '',
    };
  };
  return { a: read('a'), b: read('b') };
}

/**
 * Six prices — KO/TKO, submission and decision for each corner. Double chances
 * are derived from these, so they aren't entered separately.
 */
export function MethodOddsDialog({
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
  const [draft, setDraft] = useState<Draft>(blank);

  useEffect(() => {
    if (open) setDraft(fromFight(fight));
  }, [open, fight]);

  const set = (corner: Corner, method: Method, value: string) =>
    setDraft((d) => ({ ...d, [corner]: { ...d[corner], [method]: value } }));

  async function save() {
    for (const corner of ['a', 'b'] as const) {
      const v = draft[corner];
      const res = await act('setMethodOdds', {
        eventId: event.id,
        fightId: fight.id,
        corner,
        ko: v.ko.trim() === '' ? null : Number(v.ko),
        sub: v.sub.trim() === '' ? null : Number(v.sub),
        dec: v.dec.trim() === '' ? null : Number(v.dec),
      });
      if (!res.ok) return;
    }
    onClose();
  }

  const column = (corner: Corner) => {
    const fighter = corner === 'a' ? fight.a : fight.b;
    return (
      <div>
        <div className="mb-2 truncate text-[12px] font-bold text-ink-200">
          {fighter.name}
        </div>
        <div className="space-y-2">
          {SINGLE_METHODS.map((m) => (
            <div key={m}>
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {METHOD_LABEL[m]}
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="+150"
                value={draft[corner][m]}
                onChange={(e) => set(corner, m, e.target.value)}
                className="nums h-10 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 text-sm font-semibold text-ink-200 placeholder:text-ink-600 focus:border-brand-500/60 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Winning method lines">
      <p className="mb-3 text-xs text-ink-400">
        From a book&apos;s <em>Winning Method</em> market. Leave a box empty if
        there&apos;s no line for it. Double chance prices (KO or Sub, and so on) are
        worked out from these automatically.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {column('a')}
        {column('b')}
      </div>

      <div className="mt-5 flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" className="flex-1" disabled={busy} onClick={save}>
          Save lines
        </Button>
      </div>
    </Modal>
  );
}
