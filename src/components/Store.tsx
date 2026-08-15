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
import type { AppState } from '@/lib/appState';
import type { Corner } from '@/lib/types';

export interface Selection {
  eventId: string;
  fightId: string;
  pick: Corner;
  fighterName: string;
  opponentName: string;
  eventName: string;
  odds: number;
}

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'err';
}

interface StoreValue {
  state: AppState;
  busy: boolean;
  /** Fires an action against /api/action and swaps in the returned state. */
  act: (type: string, payload?: Record<string, unknown>) => Promise<ActResult>;
  refresh: () => Promise<void>;
  toast: (text: string, tone?: 'ok' | 'err') => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;

  // bet slip
  slip: Selection[];
  toggleSelection: (sel: Selection) => void;
  removeSelection: (fightId: string) => void;
  clearSlip: () => void;
  isSelected: (fightId: string, pick: Corner) => boolean;
}

export interface ActResult {
  ok: boolean;
  error?: string;
  message?: string;
  eventId?: string;
  changes?: string[];
}

const Ctx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <Store>');
  return v;
}

export function Store({
  initial,
  children,
}: {
  initial: AppState;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AppState>(initial);
  const [busy, setBusy] = useState(false);
  const [slip, setSlip] = useState<Selection[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

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
        const res = await fetch('/api/action', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type, payload }),
        });
        const json = await res.json();
        // The server returns fresh state even on a rejected action.
        if (json.state) setState(json.state);
        if (!res.ok) {
          toast(json.error ?? 'Something went wrong', 'err');
          return { ok: false, error: json.error };
        }
        if (json.message) toast(json.message);
        return {
          ok: true,
          message: json.message,
          eventId: json.eventId,
          changes: json.changes,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        toast(msg, 'err');
        return { ok: false, error: msg };
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (res.ok) setState(await res.json());
    } catch {
      /* offline; keep showing what we have */
    }
  }, []);

  const toggleSelection = useCallback((sel: Selection) => {
    setSlip((cur) => {
      const existing = cur.find((s) => s.fightId === sel.fightId);
      if (!existing) return [...cur, sel];
      // Clicking the other side of a fight swaps the pick rather than adding a
      // second leg — you can't parlay both corners of one fight.
      if (existing.pick !== sel.pick) {
        return cur.map((s) => (s.fightId === sel.fightId ? sel : s));
      }
      return cur.filter((s) => s.fightId !== sel.fightId);
    });
  }, []);

  const removeSelection = useCallback((fightId: string) => {
    setSlip((cur) => cur.filter((s) => s.fightId !== fightId));
  }, []);

  const clearSlip = useCallback(() => setSlip([]), []);

  const isSelected = useCallback(
    (fightId: string, pick: Corner) =>
      slip.some((s) => s.fightId === fightId && s.pick === pick),
    [slip],
  );

  // Drop selections that stopped being bettable (fight graded elsewhere, odds pulled).
  useEffect(() => {
    setSlip((cur) =>
      cur.filter((s) => {
        const ev = state.events.find((e) => e.id === s.eventId);
        const f = ev?.fights.find((x) => x.id === s.fightId);
        return f && !f.result && (s.pick === 'a' ? f.oddsA : f.oddsB) !== null;
      }),
    );
  }, [state.events]);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      busy,
      act,
      refresh,
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
      state,
      busy,
      act,
      refresh,
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
