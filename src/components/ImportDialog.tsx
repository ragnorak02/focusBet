'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from './Store';
import { Badge, Button, Empty, Modal } from './ui';
import { fetchScoreboard } from '@/lib/espn';
import { fmtDate } from '@/lib/format';

interface Row {
  espnId: string;
  name: string;
  date: string;
  venue?: string;
  location?: string;
  boutCount: number;
  finished: number;
}

export function ImportDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { act, busy, state } = useStore();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Roughly three weeks back to two months ahead, plus whatever the plain
    // scoreboard is showing right now.
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
        d.getUTCDate(),
      ).padStart(2, '0')}`;
    const now = new Date();
    const range = `${fmt(new Date(now.getTime() - 21 * 864e5))}-${fmt(
      new Date(now.getTime() + 60 * 864e5),
    )}`;

    Promise.all([
      fetchScoreboard(range).catch(() => []),
      fetchScoreboard().catch(() => []),
    ])
      .then(([ranged, current]) => {
        if (cancelled) return;
        const byId = new Map<string, Row>();
        for (const e of [...current, ...ranged]) {
          byId.set(e.espnId, {
            espnId: e.espnId,
            name: e.name,
            date: e.date,
            venue: e.venue,
            location: e.location,
            boutCount: e.bouts.length,
            finished: e.bouts.filter((b) => b.status === 'final').length,
          });
        }
        setRows([...byId.values()].sort((a, b) => a.date.localeCompare(b.date)));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Request failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function importEvent(espnId: string) {
    const res = await act('importEspnEvent', { espnId });
    if (res.ok) {
      onClose();
      if (res.eventId) router.push(`/event/?id=${res.eventId}`);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import a UFC card" wide>
      <p className="mb-3 text-xs text-ink-400">
        Cards come from ESPN&apos;s live MMA feed — fighters, records, weight classes,
        bout order and finishes. Moneylines aren&apos;t in the feed, so you&apos;ll add
        those on the card page (there&apos;s a bulk paste for that).
      </p>

      {loading ? (
        <div className="py-10 text-center text-sm text-ink-400">Loading schedule…</div>
      ) : error ? (
        <div className="rounded-lg border border-loss-500/30 bg-loss-500/10 p-3 text-sm text-loss-500">
          {error}
        </div>
      ) : !rows?.length ? (
        <Empty
          title="No UFC events in range"
          body="The feed covers roughly three weeks back to two months ahead."
        />
      ) : (
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {rows.map((r) => {
            const already = state.events.find((e) => e.espnId === r.espnId);
            return (
              <div
                key={r.espnId}
                className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-800 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-ink-200">
                    {r.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-ink-500">
                    {fmtDate(r.date)}
                    {r.location ? ` · ${r.location}` : ''}
                  </div>
                  <div className="nums mt-1 flex items-center gap-2 text-[11px] text-ink-600">
                    <span>{r.boutCount} bouts</span>
                    {r.finished > 0 ? (
                      <Badge tone="win">{r.finished} final</Badge>
                    ) : null}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={already ? 'outline' : 'primary'}
                  disabled={busy}
                  onClick={() => importEvent(r.espnId)}
                  className="shrink-0"
                >
                  {already ? 'Sync results' : 'Import'}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink-700 pt-3">
        <span className="text-[11px] text-ink-600">
          Tapology blocks automated requests, so results are pulled from ESPN instead.
        </span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
