'use client';

import { cx } from '@/lib/format';

export function Panel({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cx(
        'rounded-xl border border-ink-700/70 bg-ink-850 shadow-[0_1px_0_0_rgba(255,255,255,0.03)_inset]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-700/70 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold tracking-wide text-ink-200">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-0.5 truncate text-xs text-ink-400">{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
};

export function Button({
  variant = 'outline',
  size = 'md',
  className,
  ...rest
}: ButtonProps) {
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-5 text-[15px]',
  }[size];

  const variants = {
    primary:
      'bg-brand-500 text-ink-950 font-bold hover:bg-brand-400 disabled:bg-ink-700 disabled:text-ink-400',
    outline:
      'border border-ink-600 bg-ink-800 text-ink-200 hover:border-ink-500 hover:bg-ink-700 disabled:opacity-40',
    ghost: 'text-ink-300 hover:bg-ink-800 hover:text-ink-200 disabled:opacity-40',
    subtle: 'bg-ink-700 text-ink-200 hover:bg-ink-600 disabled:opacity-40',
    danger:
      'border border-loss-500/40 bg-loss-500/10 text-loss-500 hover:bg-loss-500/20 disabled:opacity-40',
  }[variant];

  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60',
        'disabled:cursor-not-allowed',
        sizes,
        variants,
        className,
      )}
    />
  );
}

export function Input({
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cx(
        'h-10 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 text-sm text-ink-200',
        'placeholder:text-ink-500 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/40',
        className,
      )}
    />
  );
}

export function Select({
  className,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cx(
        'h-10 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 text-sm text-ink-200',
        'focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/40',
        className,
      )}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">
      {children}
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'win' | 'loss' | 'live' | 'gold' | 'open';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-ink-700 text-ink-300',
    win: 'bg-brand-500/15 text-brand-500 ring-1 ring-brand-500/30',
    loss: 'bg-loss-500/15 text-loss-500 ring-1 ring-loss-500/30',
    live: 'bg-live-500/15 text-live-500 ring-1 ring-live-500/30',
    gold: 'bg-warn-500/15 text-warn-500 ring-1 ring-warn-500/30',
    open: 'bg-ink-600/60 text-ink-300 ring-1 ring-ink-500/40',
  }[tone];

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        tones,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'neutral' | 'win' | 'loss';
}) {
  const color =
    tone === 'win' ? 'text-brand-500' : tone === 'loss' ? 'text-loss-500' : 'text-ink-200';
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-850 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        {label}
      </div>
      <div className={cx('nums mt-1 text-xl font-bold', color)}>{value}</div>
      {sub ? <div className="nums mt-0.5 text-xs text-ink-400">{sub}</div> : null}
    </div>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="text-sm font-semibold text-ink-300">{title}</div>
      {body ? <div className="max-w-sm text-xs text-ink-500">{body}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <Panel
        className={cx(
          'slip-in relative z-10 w-full',
          wide ? 'max-w-3xl' : 'max-w-md',
        )}
      >
        <PanelHeader
          title={title}
          right={
            <button
              onClick={onClose}
              className="rounded p-1 text-ink-400 hover:bg-ink-700 hover:text-ink-200"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 4l8 8M12 4l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          }
        />
        <div className="p-4">{children}</div>
      </Panel>
    </div>
  );
}
