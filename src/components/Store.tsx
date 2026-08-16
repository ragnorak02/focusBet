'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { buildAppState, type AppState } from '@/lib/appState';
import { ActionError, applyAction } from '@/lib/actions';
import { loadDb, saveDb } from '@/lib/storage';
import { seedDb } from '@/lib/seed';
import { methodOddsFor, priceForMethods } from '@/lib/markets';
import type { Corner, DB, Fight, Market, Method } from '@/lib/types';

export interface Selection {
  eventId: string;
  fightId: string;
  pick: Corner;
  market: Market;
  /** Present for method markets; one finish, or two for a double chance. */
  methods?: Method[];
  /** Which way, for totals. */
  side?: 'over' | 'under';
  /** The handicap or total this pick is against. */
  line?: number;
  fighterName: string;
  opponentName: string;
  eventName: string;
  odds: number;
}

/** Two selections are the same pick only if every dimension matches. */
export function sameSelection(a: Selection, b: Selection): boolean {
  return (
    a.fightId === b.fightId &&
    a.pick === b.pick &&
    a.market === b.market &&
    a.side === b.side &&
    (a.methods ?? []).join('/') === (b.methods ?? []).join('/')
  );
}

/** Current price for a selection, so a slip tracks the board as lines move. */
function livePrice(fight: Fight, s: Selection): number | null | undefined {
  switch (s.market) {
    case 'method':
      return priceForMethods(methodOddsFor(fight, s.pick), s.methods ?? []);
    case 'draw':
      return fight.drawOdds;
    case 'total':
      return s.side === 'under' ? fight.totalRounds?.under : fight.totalRounds?.over;
    case 'spread':
      return s.pick === 'a' ? fight.spread?.oddsA : fight.spread?.oddsB;
    default:
      return s.pick === 'a' ? fight.oddsA : fight.oddsB;
  }
}

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'err';
}

export interface ActResult {
  ok: boolean;
  error?: string;
  message?: string;
  eventId?: string;
  changes?: string[];
}

interface StoreValue {
  db: DB;
  state: AppState;
  /** False until localStorage has been read on the client. */
  ready: boolean;
  busy: boolean;
  act: (type: string, payload?: Record<string, unknown>) => Promise<ActResult>;
  toast: (text: string, tone?: 'ok' | 'err') => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;

  slip: Selection[];
  toggleSelection: (sel: Selection) => void;
  removeSelection: (fightId: string) => void;
  clearSlip: () => void;
  isSelected: (
    fightId: string,
    pick: Corner,
    market?: Market,
    methods?: Method[],
  ) => boolean;
}

const Ctx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <Store>');
  return v;
}

export function Store({ children }: { children: React.ReactNode }) {
  // Server render and first client render must agree, so both start from the
  // seed; the real DB is swapped in from localStorage right after mount.
  const [db, setDb] = useState<DB>(() => seedDb());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slip, setSlip] = useState<Selection[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    setDb(loadDb());
    setReady(true);
  }, []);

  // Persist after every change, but not the placeholder before the load lands.
  useEffect(() => {
    if (ready) saveDb(db);
  }, [db, ready]);

  const state = useMemo(() => buildAppState(db), [db]);

  const toast = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const act = useCallback<StoreValue['act']>(
    async (type, payload = {}) => {
      setBusy(true);
      try {
        // Read through a setter so concurrent actions can't work off stale state.
        const current = await new Promise<DB>((resolve) => {
          setDb((cur) => {
            resolve(cur);
            return cur;
          });
        });

        const out = await applyAction(current, type, payload);
        setDb(out.db);
        if (out.message) toast(out.message);
        return {
          ok: true,
          message: out.message,
          eventId: out.eventId,
          changes: out.changes,
        };
      } catch (err) {
        const msg =
          err instanceof ActionError
            ? err.message
            : err instanceof Error
              ? `Something went wrong: ${err.message}`
              : 'Something went wrong';
        if (!(err instanceof ActionError)) console.error('[action]', type, err);
        toast(msg, 'err');
        return { ok: false, error: msg };
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const toggleSelection = useCallback((sel: Selection) => {
    setSlip((cur) => {
      const existing = cur.find((s) => s.fightId === sel.fightId);
      if (!existing) return [...cur, sel];
      // Tapping the same price again clears it.
      if (sameSelection(existing, sel)) {
        return cur.filter((s) => s.fightId !== sel.fightId);
      }
      // Any other pick on the same fight replaces it — one fight, one leg,
      // since correlated picks can't share a parlay.
      return cur.map((s) => (s.fightId === sel.fightId ? sel : s));
    });
  }, []);

  const removeSelection = useCallback((fightId: string) => {
    setSlip((cur) => cur.filter((s) => s.fightId !== fightId));
  }, []);

  const clearSlip = useCallback(() => setSlip([]), []);

  const isSelected = useCallback(
    (fightId: string, pick: Corner, market: Market = 'moneyline', methods?: Method[]) =>
      slip.some(
        (s) =>
          s.fightId === fightId &&
          s.pick === pick &&
          s.market === market &&
          (s.methods ?? []).join('/') === (methods ?? []).join('/'),
      ),
    [slip],
  );

  // Drop selections that stopped being bettable (graded elsewhere, line pulled),
  // and keep prices in step with the card as odds move.
  useEffect(() => {
    setSlip((cur) => {
      let dirty = false;
      const next: Selection[] = [];

      for (const s of cur) {
        const ev = db.events.find((e) => e.id === s.eventId);
        const f = ev?.fights.find((x) => x.id === s.fightId);
        if (!f || f.result) {
          dirty = true;
          continue;
        }
        const price = livePrice(f, s);
        if (price === null || price === undefined) {
          dirty = true;
          continue;
        }
        if (price !== s.odds) {
          dirty = true;
          next.push({ ...s, odds: price });
        } else {
          next.push(s);
        }
      }

      return dirty ? next : cur;
    });
  }, [db.events]);

  const value = useMemo<StoreValue>(
    () => ({
      db,
      state,
      ready,
      busy,
      act,
      toast,
      toasts,
      dismissToast,
      slip,
      toggleSelection,
      removeSelection,
      clearSlip,
      isSelected,
    }),
    [
      db,
      state,
      ready,
      busy,
      act,
      toast,
      toasts,
      dismissToast,
      slip,
      toggleSelection,
      removeSelection,
      clearSlip,
      isSelected,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
