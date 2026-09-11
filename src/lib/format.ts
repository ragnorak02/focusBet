export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function fmtTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

/**
 * Everything after the first name — "Reinier de Ridder" → "de Ridder". Used
 * beside the price buttons, where a full name has nowhere near enough room on
 * a phone and truncates mid-word. The bout header above carries both names in
 * full, so nothing is actually lost.
 */
export function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
}

/**
 * "UFC 331: Van vs. Pantoja 2" → { series: 'UFC 331', headliner: 'Van vs.
 * Pantoja 2' }. One line holding both is far too long for a phone, and it was
 * the title that would not truncate that pushed the card list off the side of
 * the screen. Stacked, the numbered card reads first and the headliner sits
 * under it, which is the order they're spoken in anyway.
 *
 * A name with no colon — a hand-built card, usually — has no headliner to
 * split off and stays on the one line.
 */
export function splitEventName(name: string): { series: string; headliner: string | null } {
  const at = name.indexOf(':');
  if (at < 0) return { series: name.trim(), headliner: null };
  const series = name.slice(0, at).trim();
  const headliner = name.slice(at + 1).trim();
  return series && headliner ? { series, headliner } : { series: name.trim(), headliner: null };
}

const WEIGHT_ABBREV: [string, string][] = [
  ['strawweight', 'SW'],
  ['flyweight', 'FLY'],
  ['bantamweight', 'BW'],
  ['featherweight', 'FW'],
  ['lightweight', 'LW'],
  ['welterweight', 'WW'],
  ['middleweight', 'MW'],
  ['light heavyweight', 'LHW'],
  ['heavyweight', 'HW'],
  ['catchweight', 'CW'],
];

/**
 * "Light Heavyweight" → "LHW", "Women's Flyweight" → "WFLY". Spelt out, the
 * division needed a row of its own; abbreviated, it fits beside the names.
 */
export function weightAbbrev(weightClass: string): string {
  const raw = weightClass.trim().toLowerCase();
  const women = /^(women'?s)\s+/.test(raw);
  const base = raw.replace(/^(women'?s)\s+/, '');

  const hit = WEIGHT_ABBREV.find(([name]) => base.startsWith(name))?.[1];
  const abbr =
    hit ??
    base
      .split(/\s+/)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 3);

  return abbr ? (women ? `W${abbr}` : abbr) : '—';
}

export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

/** Days until an event; negative once it's in the past. */
export function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  return Math.ceil((d - Date.now()) / 864e5);
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
