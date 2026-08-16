'use client';

import { useEffect, useState } from 'react';
import { useStore } from './Store';
import { Button, Label, Modal, Select } from './ui';
import {
  DOUBLE_CHANCE,
  METHOD_LABEL,
  SINGLE_METHODS,
  methodsLabel,
  pairKeyFor,
} from '@/lib/markets';
import { cx } from '@/lib/format';
import type { Corner, Fight, MmaEvent } from '@/lib/types';

type Key = 'ko' | 'sub' | 'dec' | 'koSub' | 'koDec' | 'subDec';

interface Draft {
  spreadLine: string;
  spreadFavorite: Corner;
  spreadOddsA: string;
  spreadOddsB: string;
  totalLine: string;
  over: string;
  under: string;
  drawOdds: string;
  method: Record<Corner, Record<Key, string>>;
}

const s = (n: number | null | undefined) => (n == null ? '' : String(n));

function fromFight(fight: Fight): Draft {
  const read = (corner: Corner): Record<Key, string> => {
    const o = corner === 'a' ? fight.methodA : fight.methodB;
    return {
      ko: s(o?.ko),
      sub: s(o?.sub),
      dec: s(o?.dec),
      koSub: s(o?.koSub),
      koDec: s(o?.koDec),
      subDec: s(o?.subDec),
    };
  };
  return {
    spreadLine: s(fight.spread?.line),
    spreadFavorite: fight.spread?.favorite ?? 'a',
    spreadOddsA: s(fight.spread?.oddsA),
    spreadOddsB: s(fight.spread?.oddsB),
    totalLine: s(fight.totalRounds?.line),
    over: s(fight.totalRounds?.over),
    under: s(fight.totalRounds?.under),
    drawOdds: s(fight.drawOdds),
    method: { a: read('a'), b: read('b') },
  };
}

function Price({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      inputMode="text"
      placeholder={placeholder ?? '+150'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="nums h-10 w-full rounded-lg border border-ink-600 bg-ink-900 px-2.5 text-sm font-semibold text-ink-200 placeholder:text-ink-600 focus:border-brand-500/60 focus:outline-none"
    />
  );
}

/** Every non-moneyline line for one fight, laid out the way a book lists them. */
export function LinesDialog({
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
  const [tab, setTab] = useState<'fight' | 'method'>('fight');
  const [d, setD] = useState<Draft>(() => fromFight(fight));

  useEffect(() => {
    if (open) setD(fromFight(fight));
  }, [open, fight]);

  const setMethod = (corner: Corner, key: Key, value: string) =>
    setD((cur) => ({
      ...cur,
      method: { ...cur.method, [corner]: { ...cur.method[corner], [key]: value } },
    }));

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[−–—]/g, '-')));

  async function save() {
    const lines = await act('setFightLines', {
      eventId: event.id,
      fightId: fight.id,
      drawOdds: num(d.drawOdds),
      totalLine: num(d.totalLine),
      over: num(d.over),
      under: num(d.under),
      spreadLine: num(d.spreadLine),
      spreadFavorite: d.spreadFavorite,
      spreadOddsA: num(d.spreadOddsA),
      spreadOddsB: num(d.spreadOddsB),
    });
    if (!lines.ok) return;

    for (const corner of ['a', 'b'] as const) {
      const m = d.method[corner];
      const res = await act('setMethodOdds', {
        eventId: event.id,
        fightId: fight.id,
        corner,
        ko: num(m.ko),
        sub: num(m.sub),
        dec: num(m.dec),
        koSub: num(m.koSub),
        koDec: num(m.koDec),
        subDec: num(m.subDec),
      });
      if (!res.ok) return;
    }
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit lines" wide>
      <div className="mb-1 truncate text-xs text-ink-400">
        {fight.a.name} vs {fight.b.name}
      </div>

      <div className="my-3 flex gap-1 rounded-lg bg-ink-900 p-1">
        {(['fight', 'method'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cx(
              'flex-1 rounded-md py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors',
              tab === t ? 'bg-ink-700 text-ink-200' : 'text-ink-500 hover:text-ink-300',
            )}
          >
            {t === 'fight' ? 'Spread & rounds' : 'Winning method'}
          </button>
        ))}
      </div>

      {tab === 'fight' ? (
        <div className="space-y-4">
          <div>
            <Label>Point spread (judges&apos; cards)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="mb-1 block text-[10px] text-ink-500">Line</span>
                <Price
                  value={d.spreadLine}
                  onChange={(v) => setD({ ...d, spreadLine: v })}
                  placeholder="9.5"
                />
              </div>
              <div>
                <span className="mb-1 block text-[10px] text-ink-500">Favourite</span>
                <Select
                  value={d.spreadFavorite}
                  onChange={(e) =>
                    setD({ ...d, spreadFavorite: e.target.value as Corner })
                  }
                >
                  <option value="a">{fight.a.name}</option>
                  <option value="b">{fight.b.name}</option>
                </Select>
              </div>
              <div>
                <span className="mb-1 block truncate text-[10px] text-ink-500">
                  {fight.a.name}
                </span>
                <Price
                  value={d.spreadOddsA}
                  onChange={(v) => setD({ ...d, spreadOddsA: v })}
                  placeholder="-120"
                />
              </div>
              <div>
                <span className="mb-1 block truncate text-[10px] text-ink-500">
                  {fight.b.name}
                </span>
                <Price
                  value={d.spreadOddsB}
                  onChange={(v) => setD({ ...d, spreadOddsB: v })}
                  placeholder="-110"
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Total rounds</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="mb-1 block text-[10px] text-ink-500">Line</span>
                <Price
                  value={d.totalLine}
                  onChange={(v) => setD({ ...d, totalLine: v })}
                  placeholder="1.5"
                />
              </div>
              <div>
                <span className="mb-1 block text-[10px] text-ink-500">Over</span>
                <Price value={d.over} onChange={(v) => setD({ ...d, over: v })} />
              </div>
              <div>
                <span className="mb-1 block text-[10px] text-ink-500">Under</span>
                <Price value={d.under} onChange={(v) => setD({ ...d, under: v })} />
              </div>
            </div>
          </div>

          <div>
            <Label>Draw</Label>
            <Price
              value={d.drawOdds}
              onChange={(v) => setD({ ...d, drawOdds: v })}
              placeholder="+5000"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {(['a', 'b'] as const).map((corner) => (
            <div key={corner}>
              <div className="mb-2 truncate text-[12px] font-bold text-ink-200">
                {(corner === 'a' ? fight.a : fight.b).name}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SINGLE_METHODS.map((m) => (
                  <div key={m}>
                    <span className="mb-1 block truncate text-[10px] text-ink-500">
                      {METHOD_LABEL[m]}
                    </span>
                    <Price
                      value={d.method[corner][m]}
                      onChange={(v) => setMethod(corner, m, v)}
                    />
                  </div>
                ))}
                {DOUBLE_CHANCE.map((pair) => {
                  const key = pairKeyFor(pair) as Key;
                  return (
                    <div key={key}>
                      <span className="mb-1 block truncate text-[10px] text-ink-500">
                        {methodsLabel(pair)}
                      </span>
                      <Price
                        value={d.method[corner][key]}
                        onChange={(v) => setMethod(corner, key, v)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-ink-500">
            Leave a double chance empty and it&apos;s estimated from the three
            single-method prices instead, marked with a dot on the board.
          </p>
        </div>
      )}

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
