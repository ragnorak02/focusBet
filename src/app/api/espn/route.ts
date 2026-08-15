import { NextResponse } from 'next/server';
import { fetchScoreboard } from '@/lib/espn';

export const dynamic = 'force-dynamic';

/**
 * Lists UFC events ESPN knows about, for the "import a card" picker.
 * ?dates=YYYYMMDD-YYYYMMDD narrows the window; default is a 60-day span.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dates = url.searchParams.get('dates');

  try {
    const fmt = (d: Date) =>
      `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
    const now = new Date();
    const range =
      dates ??
      `${fmt(new Date(now.getTime() - 21 * 864e5))}-${fmt(new Date(now.getTime() + 60 * 864e5))}`;

    const [ranged, current] = await Promise.all([
      fetchScoreboard(range).catch(() => []),
      fetchScoreboard().catch(() => []),
    ]);

    const byId = new Map<string, (typeof current)[number]>();
    for (const e of [...current, ...ranged]) byId.set(e.espnId, e);

    const events = [...byId.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) => ({
        espnId: e.espnId,
        name: e.name,
        date: e.date,
        venue: e.venue,
        location: e.location,
        boutCount: e.bouts.length,
        finished: e.bouts.filter((b) => b.status === 'final').length,
      }));

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'ESPN request failed', events: [] },
      { status: 502 },
    );
  }
}
