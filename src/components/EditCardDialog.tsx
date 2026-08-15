'use client';

import { useState } from 'react';
import { useStore } from './Store';
import { Button, Input, Label, Modal, Select } from './ui';
import { formatAmerican } from '@/lib/odds';
import type { MmaEvent, Segment } from '@/lib/types';

export function EditCardDialog({
  open,
  onClose,
  event,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  event: MmaEvent;
  onDeleted: () => void;
}) {
  const { act, busy } = useStore();
  const [tab, setTab] = useState<'fights' | 'details'>('fights');

  // new fight form
  const [aName, setAName] = useState('');
  const [bName, setBName] = useState('');
  const [weightClass, setWeightClass] = useState('');
  const [segment, setSegment] = useState<Segment>('main');
  const [oddsA, setOddsA] = useState('');
  const [oddsB, setOddsB] = useState('');

  // event details
  const [name, setName] = useState(event.name);
  const [location, setLocation] = useState(event.location ?? '');
  const [espnId, setEspnId] = useState(event.espnId ?? '');

  const [confirmDelete, setConfirmDelete] = useState(false);

  const fights = [...event.fights].sort((a, b) => b.order - a.order);

  async function addFight() {
    const res = await act('addFight', {
      eventId: event.id,
      aName,
      bName,
      weightClass: weightClass || 'Catchweight',
      segment,
      oddsA: oddsA ? Number(oddsA) : null,
      oddsB: oddsB ? Number(oddsB) : null,
    });
    if (res.ok) {
      setAName('');
      setBName('');
      setOddsA('');
      setOddsB('');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit card" wide>
      <div className="mb-4 flex gap-1 rounded-lg bg-ink-900 p-1">
        {(['fights', 'details'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              tab === t ? 'bg-ink-700 text-ink-200' : 'text-ink-500 hover:text-ink-300'
            }`}
          >
            {t === 'fights' ? 'Bouts' : 'Event details'}
          </button>
        ))}
      </div>

      {tab === 'fights' ? (
        <>
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-2">
            {fights.length ? (
              fights.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-ink-800"
                >
                  <span className="nums w-6 shrink-0 text-[11px] font-bold text-ink-600">
                    #{f.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-ink-300">
                      {f.a.name} <span className="text-ink-600">vs</span> {f.b.name}
                    </div>
                    <div className="nums truncate text-[10px] text-ink-600">
                      {f.weightClass} · {f.segment === 'main' ? 'Main' : 'Prelim'} ·{' '}
                      {formatAmerican(f.oddsA)} / {formatAmerican(f.oddsB)}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      act('deleteFight', { eventId: event.id, fightId: f.id })
                    }
                    disabled={busy}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-600 hover:bg-ink-700 hover:text-loss-500"
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-ink-600">
                No bouts on this card yet
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-ink-700 p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">
              Add a bout
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label>Corner A</Label>
                <Input
                  placeholder="Fighter name"
                  value={aName}
                  onChange={(e) => setAName(e.target.value)}
                />
              </div>
              <div>
                <Label>Corner B</Label>
                <Input
                  placeholder="Fighter name"
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                />
              </div>
              <div>
                <Label>Odds A</Label>
                <Input
                  placeholder="-150"
                  value={oddsA}
                  onChange={(e) => setOddsA(e.target.value)}
                  className="nums"
                />
              </div>
              <div>
                <Label>Odds B</Label>
                <Input
                  placeholder="+130"
                  value={oddsB}
                  onChange={(e) => setOddsB(e.target.value)}
                  className="nums"
                />
              </div>
              <div>
                <Label>Weight class</Label>
                <Input
                  placeholder="Lightweight"
                  value={weightClass}
                  onChange={(e) => setWeightClass(e.target.value)}
                />
              </div>
              <div>
                <Label>Card</Label>
                <Select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value as Segment)}
                >
                  <option value="main">Main Card</option>
                  <option value="prelim">Prelims</option>
                  <option value="early">Early Prelims</option>
                </Select>
              </div>
            </div>
            <Button
              variant="primary"
              className="mt-3 w-full"
              disabled={busy || !aName.trim() || !bName.trim()}
              onClick={addFight}
            >
              Add bout
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>Event name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <Label>ESPN event id</Label>
            <Input
              value={espnId}
              onChange={(e) => setEspnId(e.target.value)}
              placeholder="600059185"
              className="nums"
            />
            <p className="mt-1 text-[11px] text-ink-500">
              Links this card to the live feed so &quot;Refresh results&quot; can find
              it. Set automatically when you import.
            </p>
          </div>

          <Button
            variant="primary"
            className="w-full"
            disabled={busy}
            onClick={async () => {
              await act('updateEvent', {
                eventId: event.id,
                name,
                location,
              });
              if (espnId !== (event.espnId ?? '')) {
                await act('importEspnEvent', { espnId });
              }
            }}
          >
            Save details
          </Button>

          <div className="border-t border-ink-700 pt-3">
            {confirmDelete ? (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep card
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={busy}
                  onClick={async () => {
                    const res = await act('deleteEvent', { eventId: event.id });
                    if (res.ok) {
                      onClose();
                      onDeleted();
                    }
                  }}
                >
                  Delete permanently
                </Button>
              </div>
            ) : (
              <Button
                variant="danger"
                className="w-full"
                onClick={() => setConfirmDelete(true)}
              >
                Delete this card
              </Button>
            )}
            <p className="mt-2 text-[11px] text-ink-500">
              Bets on a deleted card are voided and their stakes refunded.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
