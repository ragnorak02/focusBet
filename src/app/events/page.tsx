'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/Store';
import { ImportDialog } from '@/components/ImportDialog';
import { Button, Empty, Input, Label, Modal, Panel } from '@/components/ui';
import { formatMoney } from '@/lib/odds';
import { daysUntil, fmtDate, splitEventName } from '@/lib/format';

export default function EventsPage() {
  const { state, act, busy } = useStore();
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');

  const pnlByEvent = new Map(state.eventPnl.map((p) => [p.eventId, p]));

  async function createEvent() {
    const res = await act('createEvent', {
      name,
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
      location,
    });
    if (res.ok) {
      setCreating(false);
      setName('');
      setDate('');
      setLocation('');
      if (res.eventId) router.push(`/event/?id=${res.eventId}`);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-ink-200">
            Fight cards
          </h1>
          <p className="mt-0.5 text-sm text-ink-400">
            Import a UFC or PFL card from the live feed, or build one from a screenshot.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreating(true)}>Blank card</Button>
          <Button variant="primary" onClick={() => setImporting(true)}>
            Import card
          </Button>
        </div>
      </div>

      {state.events.length === 0 ? (
        <Panel>
          <Empty
            title="No cards yet"
            body="Pull the UFC and PFL schedules straight from the live feed — fighters, records and bout order come with it. Odds land on their own."
            action={
              <Button variant="primary" onClick={() => setImporting(true)}>
                Import card
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {state.events.map((ev) => {
            const finals = ev.fights.filter((f) => f.result).length;
            const live = ev.fights.some((f) => f.status === 'live' && !f.result);
            const days = daysUntil(ev.date);
            const pnl = pnlByEvent.get(ev.id);

            const { series, headliner } = splitEventName(ev.name);

            return (
              // min-w-0 on the grid item: without it the track sizes to the
              // title's max-content and the whole row hangs off the side of a
              // phone, taking the truncate below with it.
              <Link key={ev.id} href={`/event/?id=${ev.id}`} className="min-w-0">
                <Panel className="h-full transition-colors hover:border-brand-500/40">
                  <div className="min-w-0 p-4">
                    <div className="truncate text-[11px] font-bold uppercase tracking-wider text-brand-500">
                      {series}
                    </div>
                    {headliner ? (
                      <div className="truncate text-base font-black tracking-tight text-ink-200">
                        {headliner}
                      </div>
                    ) : null}
                    <div className="mt-0.5 truncate text-xs text-ink-400">
                      {fmtDate(ev.date)}
                      {ev.location ? ` · ${ev.location}` : ''}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-700/60 pt-3">
                      <div className="nums min-w-0 truncate text-xs text-ink-500">
                        {ev.fights.length} bouts · {finals} final
                        {/* The Live / Complete / days-away pill used to sit up
                            beside the title and was the first thing a narrow
                            screen cut off. Live is the only one of the three
                            worth keeping, and down here it costs no width. */}
                        {live ? (
                          <>
                            {' · '}
                            <span className="font-bold text-live-500">
                              <span className="live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
                              Live
                            </span>
                          </>
                        ) : days === 0 ? (
                          <>
                            {' · '}
                            <span className="font-bold text-brand-500">Today</span>
                          </>
                        ) : null}
                      </div>
                      {pnl ? (
                        <div
                          className={`nums shrink-0 text-sm font-bold ${
                            pnl.profit > 0
                              ? 'text-brand-500'
                              : pnl.profit < 0
                                ? 'text-loss-500'
                                : 'text-ink-400'
                          }`}
                        >
                          {formatMoney(pnl.profit, { sign: pnl.profit !== 0 })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Panel>
              </Link>
            );
          })}
        </div>
      )}

      <ImportDialog open={importing} onClose={() => setImporting(false)} />

      <Modal open={creating} onClose={() => setCreating(false)} title="New blank card">
        <div className="space-y-3">
          <div>
            <Label>Event name</Label>
            <Input
              placeholder="UFC 331: Someone vs. Someone"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Location</Label>
            <Input
              placeholder="Las Vegas, NV"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={busy || !name.trim()}
            onClick={createEvent}
          >
            Create
          </Button>
        </div>
      </Modal>
    </div>
  );
}
