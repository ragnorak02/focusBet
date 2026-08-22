/**
 * Just enough of ESPN's MMA feed to put an id and a canonical name on a
 * BestFightOdds card. The app does its own, richer read of the same feed in
 * `src/lib/espn.ts`; this is the build-time half.
 */

/** Kept in step with LEAGUES in src/lib/espn.ts. */
const LEAGUES = ['ufc', 'pfl'];

const scoreboard = (league) =>
  `https://site.api.espn.com/apis/site/v2/sports/mma/${league}/scoreboard`;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function stamp(d) {
  return (
    `${d.getUTCFullYear()}` +
    `${String(d.getUTCMonth() + 1).padStart(2, '0')}` +
    `${String(d.getUTCDate()).padStart(2, '0')}`
  );
}

function mapEvent(ev) {
  const bouts = (ev.competitions ?? []).map((c) => {
    const sorted = [...(c.competitors ?? [])].sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
    const name = (c) => c?.athlete?.displayName ?? c?.athlete?.fullName ?? '';
    return { a: name(sorted[0]), b: name(sorted[1]) };
  });
  return {
    espnId: String(ev.id ?? ''),
    name: ev.name ?? 'UFC Event',
    date: ev.date ?? '',
    bouts: bouts.filter((b) => b.a && b.b),
  };
}

/** Every card ESPN knows about within `days` either side of today. */
export async function fetchEvents(days = 45) {
  const now = Date.now();
  const range = `${stamp(new Date(now - days * 864e5))}-${stamp(new Date(now + days * 864e5))}`;

  const perLeague = await Promise.all(
    LEAGUES.map(async (league) => {
      const res = await fetch(`${scoreboard(league)}?dates=${range}`, {
        headers: { 'user-agent': UA, accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`ESPN ${league} returned ${res.status}`);
      const json = await res.json();
      return (json.events ?? []).map(mapEvent);
    }),
  );

  return perLeague.flat().filter((e) => e.bouts.length);
}
