'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useStore } from '@/components/Store';
import { ImportDialog } from '@/components/ImportDialog';
import { Badge, Button, Empty, Input, Label, Modal, Panel, PanelHeader } from '@/components/ui';
import { formatMoney } from '@/lib/odds';
import { daysUntil, fmtDate } from '@/lib/format';

export default function EventsPage() {
  const { state, act, busy } = useStore();
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
      if (res.eventId) window.location.href = `/events/${res.eventId}`;
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
            Import a UFC card from the live feed, or build one from a screenshot.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreating(true)}>Blank card</Button>
          <Button variant="primary" onClick={() => setImporting(true)}>
            Import UFC card
          </Button>
        </div>
      </div>

      {state.events.length === 0 ? (
        <Panel>
          <Empty
            title="No cards yet"
            body="Pull the current UFC schedule straight from the live feed — fighters, records and bout order come with it. You just add the moneylines."
            action={
              <Button variant="primary" onClick={() => setImporting(true)}>
                Import UFC card
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

            return (
              <Link key={ev.id} href={`/events/${ev.id}`}>
                <Panel className="h-full transition-colors hover:border-brand-500/40">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-base font-black tracking-tight text-ink-200">
                          {ev.name}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-400">
                          {fmtDate(ev.date)}
                          {ev.location ? ` · ${ev.location}` : ''}
                        </div>
                      </div>
                      {live ? (
                        <Badge tone="live">
                          <span className="live-dot mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-live-500" />
                          Live
                        </Badge>
                      ) : finals === ev.fights.length && ev.fights.length > 0 ? (
                        <Badge tone="neutral">Complete</Badge>
                      ) : days >= 0 ? (
                        <Badge tone="win">{days === 0 ? 'Today' : `${days}d`}</Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-ink-700/60 pt-3">
                      <div className="nums text-xs text-ink-500">
                        {ev.fights.length} bouts · {finals} final
                      </div>
                      {pnl ? (
                        <div
                          className={`nums text-sm font-bold ${
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
