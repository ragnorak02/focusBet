'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from './Store';
import { BetSlip } from './BetSlip';
import { formatMoney } from '@/lib/odds';
import { cx } from '@/lib/format';

type IconProps = { active: boolean };

const Icon = {
  home: ({ active }: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3.5 10.5 12 4l8.5 6.5V20a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
      />
    </svg>
  ),
  events: ({ active }: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="5"
        width="18"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
      />
      <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  bets: ({ active }: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
      />
      <path d="M8 9.5h8M8 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  stats: ({ active }: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 19V9M10 19V5M16 19v-6M22 19H2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {active ? <circle cx="10" cy="5" r="2" fill="currentColor" /> : null}
    </svg>
  ),
  bank: ({ active }: IconProps) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="7"
        width="18"
        height="12"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.18 : 0}
      />
      <path d="M3 11h18" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="15" r="1.4" fill="currentColor" />
    </svg>
  ),
};

const NAV = [
  { href: '/', label: 'Home', icon: Icon.home },
  { href: '/events/', label: 'Cards', icon: Icon.events },
  { href: '/bets/', label: 'My Bets', icon: Icon.bets },
  { href: '/stats/', label: 'Stats', icon: Icon.stats },
  { href: '/bank/', label: 'Bank', icon: Icon.bank },
] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function Toasts() {
  const { toasts, dismissToast, slip } = useStore();
  if (!toasts.length) return null;
  return (
    <div
      className={cx(
        'toast-stack pointer-events-none fixed left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4',
      )}
      // Clear the tab bar, and the slip sheet too when it's open.
      style={{
        bottom: `calc(${slip.length ? 268 : 68}px + env(safe-area-inset-bottom))`,
      }}
    >
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

function BottomNav() {
  const isActive = useActive();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700/70 bg-ink-900/98 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {NAV.map((n) => {
          const active = isActive(n.href);
          const IconCmp = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                'flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 transition-colors',
                active ? 'text-brand-500' : 'text-ink-500 active:text-ink-300',
              )}
            >
              <IconCmp active={active} />
              <span className="truncate text-[10px] font-bold tracking-wide">
                {n.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, slip } = useStore();
  const isActive = useActive();
  const { bankroll } = state;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-ink-700/70 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-500 text-sm font-black text-ink-950">
              F
            </span>
            <span className="text-[15px] font-black tracking-tight text-ink-200">
              focus<span className="text-brand-500">Bet</span>
            </span>
          </Link>

          {/* Wide screens keep the links up top; phones use the bottom bar. */}
          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cx(
                  'shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors',
                  isActive(n.href)
                    ? 'bg-ink-700 text-ink-200'
                    : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200',
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/bank/"
            className="ml-auto shrink-0 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-right transition-colors hover:border-brand-500/50 md:ml-0"
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
        <main
          className="page-main min-w-0 flex-1"
          // Room for the bottom tab bar, plus the slip sheet when it's open.
          // Zeroed out again at md+ in globals.css, where there is no tab bar.
          style={
            {
              '--main-pb': `calc(${slip.length ? 320 : 76}px + env(safe-area-inset-bottom))`,
            } as React.CSSProperties
          }
        >
          {children}
        </main>
        <aside className="hidden w-[340px] shrink-0 xl:block">
          <div className="sticky top-[76px]">
            <BetSlip />
          </div>
        </aside>
      </div>

      {/* Narrow screens: the slip rides above the tab bar as a sheet. */}
      {slip.length > 0 ? (
        <div
          className="fixed inset-x-0 z-40 max-h-[62vh] overflow-y-auto border-t border-ink-700 bg-ink-900/98 p-3 backdrop-blur xl:hidden"
          style={{ bottom: 'calc(56px + env(safe-area-inset-bottom))' }}
        >
          <BetSlip compact />
        </div>
      ) : null}

      <BottomNav />
      <Toasts />
    </div>
  );
}
