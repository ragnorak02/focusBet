'use client';

import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/odds';
import { fmtDateTime } from '@/lib/format';

interface Point {
  at: string;
  balance: number;
  label: string;
}

/**
 * Inline SVG so there's no charting dependency. Renders the bankroll curve with
 * a break-even reference line at the total deposited.
 */
export function BankrollChart({
  history,
  deposited,
  height = 200,
}: {
  history: Point[];
  deposited: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 800;
  const H = height;
  const PAD = { top: 14, right: 12, bottom: 20, left: 48 };

  const geom = useMemo(() => {
    if (history.length === 0) return null;

    // Duplicate a single point so the line has something to draw.
    const pts = history.length === 1 ? [history[0], history[0]] : history;

    const values = pts.map((p) => p.balance).concat(deposited);
    const rawMin = Math.min(...values, 0);
    const rawMax = Math.max(...values);
    const span = rawMax - rawMin || 1;
    const min = rawMin - span * 0.08;
    const max = rawMax + span * 0.08;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) =>
      PAD.left + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.balance)}`).join(' ');
    const area = `${line} L${x(pts.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`;

    const ticks = [max, (max + min) / 2, min].map((v) => ({ v, y: y(v) }));

    return { pts, x, y, line, area, ticks, breakEvenY: y(deposited), min, max };
  }, [history, deposited, H]);

  if (!geom) {
    return (
      <div className="grid h-[200px] place-items-center text-sm text-ink-500">
        No activity yet
      </div>
    );
  }

  const last = geom.pts[geom.pts.length - 1];
  const up = last.balance >= deposited;
  const stroke = up ? 'var(--color-brand-500)' : 'var(--color-loss-500)';
  const active = hover !== null ? geom.pts[hover] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - rect.left) / rect.width) * W;
          const innerW = W - PAD.left - PAD.right;
          const frac = Math.min(1, Math.max(0, (rel - PAD.left) / innerW));
          setHover(Math.round(frac * (geom.pts.length - 1)));
        }}
      >
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {geom.ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.y}
              y2={t.y}
              stroke="var(--color-ink-700)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={t.y + 4}
              textAnchor="end"
              className="nums"
              fontSize="11"
              fill="var(--color-ink-500)"
            >
              ${Math.round(t.v)}
            </text>
          </g>
        ))}

        {/* break-even = everything you've put in */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={geom.breakEvenY}
          y2={geom.breakEvenY}
          stroke="var(--color-ink-500)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        <path d={geom.area} fill="url(#fill)" />
        <path
          d={geom.line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {active ? (
          <>
            <line
              x1={geom.x(hover!)}
              x2={geom.x(hover!)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--color-ink-500)"
              strokeWidth="1"
            />
            <circle
              cx={geom.x(hover!)}
              cy={geom.y(active.balance)}
              r="4"
              fill={stroke}
              stroke="var(--color-ink-950)"
              strokeWidth="2"
            />
          </>
        ) : null}
      </svg>

      {active ? (
        <div className="pointer-events-none absolute left-2 top-2 rounded-lg border border-ink-600 bg-ink-900/95 px-2.5 py-1.5 shadow-lg">
          <div className="nums text-sm font-bold text-ink-200">
            {formatMoney(active.balance)}
          </div>
          <div className="text-[10px] text-ink-500">
            {active.label} · {fmtDateTime(active.at)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
