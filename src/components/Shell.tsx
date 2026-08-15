'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from './Store';
import { BetSlip } from './BetSlip';
import { formatMoney } from '@/lib/odds';
import { cx } from '@/lib/format';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/bets', label: 'My Bets' },
  { href: '/stats', label: 'Stats' },
  { href: '/bank', label: 'Bank' },
];

function Toasts() {
  const { toasts, dismissToast } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={cx(
            'toast-in pointer-events-auto rounded-lg border px-4 py-3 text-left text-sm font-medium shadow-xl backdrop-blur',
            t.tone === 'err'
              ? 'border-loss-500/40 bg-loss-500/15 text-loss-500'
              : 'border-brand-500/40 bg-ink-800/95 text-ink-200',
          )}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, slip } = useStore();
  const pathname = usePathname();
  const { bankroll } = state;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-500 text-sm font-black text-ink-950">
              F
            </span>
            <span className="hidden text-[15px] font-black tracking-tight text-ink-200 sm:block">
              focus<span className="text-brand-500">Bet</span>
            </span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
            {NAV.map((n) => {
              const active =
                n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cx(
                    'shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors',
                    active
                      ? 'bg-ink-700 text-ink-200'
                      : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200',
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/bank"
            className="shrink-0 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-right transition-colors hover:border-brand-500/50"
          >
            <div className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
              Balance
            </div>
            <div className="nums text-sm font-bold leading-tight text-brand-500">
              {formatMoney(bankroll.balance)}
            </div>
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-5 px-4 py-5">
        <main className="min-w-0 flex-1 pb-28 xl:pb-5">{children}</main>
        <aside className="hidden w-[340px] shrink-0 xl:block">
          <div className="sticky top-[76px]">
            <BetSlip />
          </div>
        </aside>
      </div>

      {/* Mobile / narrow: slip collapses to a bottom sheet. */}
      {slip.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto border-t border-ink-700 bg-ink-900/98 p-3 backdrop-blur xl:hidden">
          <BetSlip compact />
        </div>
      ) : null}

      <Toasts />
    </div>
  );
}
