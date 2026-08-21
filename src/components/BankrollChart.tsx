'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '@/lib/odds';
import { fmtDateTime } from '@/lib/format';

interface Point {
  at: string;
  balance: number;
  label: string;
}

/**
 * Inline SVG so there's no charting dependency. The viewBox is sized to the
 * measured container width so one SVG unit is one CSS pixel — stretching a
 * fixed viewBox instead would squash the axis labels on a phone.
 */
export function BankrollChart({
  history,
  baseline,
  height = 200,
}: {
  history: Point[];
  baseline: number;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = width < 480;
  const H = narrow ? 160 : height;
  const PAD = {
    top: 14,
    right: 12,
    bottom: 18,
    left: narrow ? 40 : 52,
  };

  const geom = useMemo(() => {
    if (history.length === 0) return null;

    // Duplicate a lone point so the line has something to draw.
    const pts = history.length === 1 ? [history[0], history[0]] : history;

    const values = pts.map((p) => p.balance).concat(baseline, 0);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = rawMax - rawMin || 1;
    const min = rawMin - span * 0.08;
    const max = rawMax + span * 0.08;

    const innerW = width - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const x = (i: number) =>
      PAD.left + (pts.length === 1 ? innerW / 2 : (i / (pts.length - 1)) * innerW);
    const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;

    const line = pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`)
      .join(' ');
    const area = `${line} L${x(pts.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

    const ticks = [max, (max + min) / 2, min].map((v) => ({ v, y: y(v) }));

    return { pts, x, y, line, area, ticks, breakEvenY: y(baseline) };
  }, [history, baseline, width, H, PAD.left, PAD.right, PAD.top, PAD.bottom]);

  if (!geom) {
    return (
      <div ref={wrapRef} className="grid h-40 place-items-center text-sm text-ink-500">
        No activity yet
      </div>
    );
  }

  const last = geom.pts[geom.pts.length - 1];
  const up = last.balance >= baseline;
  const stroke = up ? 'var(--color-brand-500)' : 'var(--color-loss-500)';
  const active = hover !== null ? geom.pts[hover] : null;

  function pick(clientX: number, rect: DOMRect) {
    const rel = clientX - rect.left;
    const innerW = width - PAD.left - PAD.right;
    const frac = Math.min(1, Math.max(0, (rel - PAD.left) / innerW));
    setHover(Math.round(frac * (geom!.pts.length - 1)));
  }

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${width} ${H}`}
        width="100%"
        height={H}
        className="touch-pan-y select-none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onTouchStart={(e) => pick(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        onTouchMove={(e) => pick(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id="bankroll-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {geom.ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={t.y}
              y2={t.y}
              stroke="var(--color-ink-700)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={t.y + 4}
              textAnchor="end"
              fontSize={narrow ? 10 : 11}
              fill="var(--color-ink-500)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              ${Math.round(t.v)}
            </text>
          </g>
        ))}

        {/* break-even against the baseline */}
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={geom.breakEvenY}
          y2={geom.breakEvenY}
          stroke="var(--color-ink-500)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        <path d={geom.area} fill="url(#bankroll-fill)" />
        <path
          d={geom.line}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
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
              r="4.5"
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
