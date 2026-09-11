/**
 * Name matching, kept in step with `src/lib/espn.ts`. It is duplicated rather
 * than imported because the odds job runs as plain `node` with no build step,
 * and the app's copy is TypeScript.
 */

export function normalizeName(s) {
  return s
    .normalize('NFD')
    .toLowerCase()
    // A hyphen is a word break, and the two sources disagree about writing it:
    // BestFightOdds has "Waldo Cortes-Acosta" where ESPN has "Waldo Cortes
    // Acosta". Deleting it welds the surname into one token and the two names
    // stop matching, so it has to survive as the space it stands for.
    .replace(/[-‐-―]/g, ' ')
    // Everything else that isn't a letter goes, which keeps an apostrophe
    // silent: "O'Malley" and "OMalley" both land on "omalley".
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lastName(s) {
  const parts = normalizeName(s).split(' ');
  return parts[parts.length - 1] ?? '';
}

/** 0 = no match, 1 = exact. Surname agreement is the strong signal. */
export function nameScore(x, y) {
  const a = normalizeName(x);
  const b = normalizeName(y);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const la = lastName(x);
  const lb = lastName(y);
  if (la && la === lb) return 0.8;
  const at = new Set(a.split(' '));
  const bt = new Set(b.split(' '));
  const shared = [...at].filter((t) => bt.has(t) && t.length > 2).length;
  if (shared >= 1) return 0.5 + 0.1 * shared;
  return 0;
}

/** How well two bouts describe the same fight, corners in either order. */
export function boutScore(a1, a2, b1, b2) {
  const straight = (nameScore(a1, b1) + nameScore(a2, b2)) / 2;
  const flipped = (nameScore(a1, b2) + nameScore(a2, b1)) / 2;
  return { score: Math.max(straight, flipped), flipped: flipped > straight };
}
