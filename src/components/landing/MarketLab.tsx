'use client';

/**
 * MarketLab — the hero instrument.
 *
 * An interactive, illustrative model of how three formation strategies respond
 * to different demand scenarios. It is deliberately a *shape* demo: the real,
 * deterministic simulation (DBC math) lives in the Simulate and Compare steps.
 * Nothing here claims to be a forecast, and the panel says so.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

type ScenarioKey = 'weak' | 'strong' | 'whale';

const N = 48; // trades per run

const SCENARIOS: { key: ScenarioKey; label: string; blurb: string }[] = [
  { key: 'weak',   label: 'Weak demand',   blurb: 'Early volume comes in lower than planned.' },
  { key: 'strong', label: 'Strong demand', blurb: 'Demand outruns every assumption.' },
  { key: 'whale',  label: 'Whale',         blurb: 'One large buy dominates early price action.' },
];

const DESIGNS = [
  { key: 'lf',  name: 'Liquidity First',       short: 'Liquidity First', a: 1.55, b: 1.2,  color: '#6A3DF0' },
  { key: 'bal', name: 'Balanced Formation',    short: 'Balanced',        a: 2.25, b: 1.0,  color: '#F0368C' },
  { key: 'pdf', name: 'Price Discovery First', short: 'Price Discovery', a: 3.0,  b: 0.82, color: '#FF6A3D' },
] as const;

/** Cumulative share of the graduation target filled after trade t. */
function demandAt(s: ScenarioKey, t: number): number {
  const u = t / N;
  if (s === 'weak')   return 0.42 * Math.pow(u, 0.9);
  if (s === 'strong') return 1.0  * Math.pow(u, 0.85);
  const base = 0.5 * Math.pow(u, 1.1);
  return Math.min(1, base + (u >= 0.3 ? 0.3 : 0));
}

const price = (a: number, b: number, x: number) => Math.exp(a * Math.pow(x, b));

// Chart geometry
const PX = 8, PT = 16, PB = 26;

export function MarketLab({ className }: { className?: string }) {
  const [scenario, setScenario] = useState<ScenarioKey>('strong');
  const [selected, setSelected] = useState(1);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Taller aspect on phones so the curves have room to breathe
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  const W = narrow ? 360 : 760;
  const H = narrow ? 340 : 300;

  const series = useMemo(
    () => DESIGNS.map(d =>
      Array.from({ length: N + 1 }, (_, t) => price(d.a, d.b, demandAt(scenario, t)))
    ),
    [scenario]
  );

  const yMax = useMemo(() => Math.max(...series.flat()) * 1.06, [series]);
  const px = (t: number) => PX + (t / N) * (W - PX * 2);
  const py = (v: number) => PT + (1 - (v - 1) / (yMax - 1)) * (H - PT - PB);

  const pathFor = (vals: number[]) =>
    vals.map((v, t) => `${t === 0 ? 'M' : 'L'}${px(t).toFixed(1)},${py(v).toFixed(1)}`).join(' ');

  const sel = (series[selected] ?? series[0]) as number[];
  const areaPath = `${pathFor(sel)} L${px(N)},${H - PB} L${px(0)},${H - PB} Z`;

  const metrics = useMemo(() => {
    const end = sel[N] as number;
    let maxStep = 0;
    for (let t = 1; t <= N; t++) maxStep = Math.max(maxStep, (sel[t] as number) / (sel[t - 1] as number) - 1);
    return {
      multiple: end,
      graduation: Math.min(100, demandAt(scenario, N) * 100),
      maxStep: maxStep * 100,
    };
  }, [sel, scenario]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(N, Math.round(((x - PX) / (W - PX * 2)) * N))));
  };

  const active = SCENARIOS.find(s => s.key === scenario)!;
  const h = hover ?? N;

  return (
    <div className={cn('glass rounded-[32px] p-3 md:p-4 text-left', className)}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-2 md:px-3 pt-1 pb-3">
        <div className="inline-flex p-1 rounded-full bg-bg-muted/80 self-start" role="tablist" aria-label="Demand scenario">
          {SCENARIOS.map(s => (
            <button
              key={s.key}
              role="tab"
              aria-selected={scenario === s.key}
              onClick={() => setScenario(s.key)}
              className={cn(
                'h-8 px-4 rounded-full text-[13px] font-medium whitespace-nowrap',
                'transition-[background-color,color,box-shadow] duration-300 ease-cinema',
                scenario === s.key
                  ? 'bg-ink text-white shadow-[0_6px_16px_-6px_rgba(11,11,16,0.6)]'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 md:justify-end">
          <p className="text-xs text-text-secondary">{active.blurb}</p>
          <span className="shrink-0 inline-flex items-center h-6 px-2.5 rounded-full bg-bg-muted font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
            Illustrative
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative rounded-[22px] bg-white/85 ring-1 ring-inset ring-border-subtle overflow-hidden">
        <div className="absolute top-3 left-4 z-10 eyebrow">Price multiple vs. trades</div>
        <div className="absolute top-3 right-4 z-10 font-mono text-[11px] text-text-tertiary tabular-nums">
          trade {String(h).padStart(2, '0')}/{N}
        </div>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto block touch-none select-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`Simulated price curves for three formation strategies under ${active.label.toLowerCase()}`}
        >
          <defs>
            <linearGradient id="lab-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor={DESIGNS[selected]!.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={DESIGNS[selected]!.color} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* grid */}
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={PX} x2={W - PX} y1={PT + f * (H - PT - PB)} y2={PT + f * (H - PT - PB)}
              stroke="rgba(12,12,20,0.06)" strokeDasharray="2 5" />
          ))}
          <line x1={PX} x2={W - PX} y1={H - PB} y2={H - PB} stroke="rgba(12,12,20,0.14)" />

          {/* selected area */}
          <path key={`area-${scenario}-${selected}`} d={areaPath} fill="url(#lab-area)" className="animate-fade-in" />

          {/* series */}
          {DESIGNS.map((d, i) => (
            <path
              key={`${d.key}-${scenario}`}
              d={pathFor(series[i] as number[])}
              fill="none"
              stroke={d.color}
              strokeWidth={i === selected ? 3 : 1.75}
              strokeOpacity={i === selected ? 1 : 0.42}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              className="animate-draw"
              style={{ animationDelay: `${i * 90}ms` }}
            />
          ))}

          {/* scrubber */}
          {hover !== null && (
            <g>
              <line x1={px(hover)} x2={px(hover)} y1={PT} y2={H - PB} stroke="rgba(12,12,20,0.35)" strokeDasharray="3 3" />
              {DESIGNS.map((d, i) => (
                <circle key={d.key} cx={px(hover)} cy={py((series[i] as number[])[hover] as number)} r={i === selected ? 5 : 3.5}
                  fill="#fff" stroke={d.color} strokeWidth="2.5" />
              ))}
            </g>
          )}
          {/* live end-point on the selected series */}
          {hover === null && (
            <circle cx={px(N)} cy={py(sel[N] as number)} r="5" fill="#fff" stroke={DESIGNS[selected]!.color} strokeWidth="3" />
          )}
        </svg>
      </div>

      {/* Metrics + legend */}
      <div className="grid md:grid-cols-[1fr_auto] gap-4 items-end px-2 md:px-3 pt-4 pb-2">
        <div className="grid grid-cols-3 gap-4">
          <Metric label="Price multiple" value={`×${metrics.multiple.toFixed(1)}`} />
          <Metric label="Graduation" value={`${metrics.graduation.toFixed(0)}%`} />
          <Metric label="Largest single step" value={`+${metrics.maxStep.toFixed(1)}%`} />
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Formation strategy">
          {DESIGNS.map((d, i) => (
            <button
              key={d.key}
              role="tab"
              aria-selected={selected === i}
              onClick={() => setSelected(i)}
              className={cn(
                'inline-flex items-center gap-2 h-8 pl-2.5 pr-3.5 rounded-full text-xs font-medium',
                'transition-[background-color,box-shadow,color] duration-300 ease-cinema',
                selected === i
                  ? 'bg-white shadow-sm ring-1 ring-inset ring-border-strong text-text-primary'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/70'
              )}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
              {d.short}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div key={value} className="font-mono text-2xl md:text-[28px] font-medium tracking-tight text-text-primary tabular-nums animate-fade-in">
        {value}
      </div>
    </div>
  );
}
