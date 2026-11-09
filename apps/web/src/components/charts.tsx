import { clsx } from 'clsx';
import { Table2 } from 'lucide-react';
import { useId, useState } from 'react';

export interface ChartDatum {
  key: string;
  /** Short label under the column. */
  label: string;
  value: number;
  /** Extra lines shown in the tooltip, value first. */
  detail?: string[];
  /** Full label for the tooltip and table. */
  title: string;
}

function niceMax(max: number) {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 4, 5, 8, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

function TableView({ rows, valueLabel, caption }: { rows: ChartDatum[]; valueLabel: string; caption: string }) {
  return (
    <div className="mt-4 max-h-64 overflow-auto rounded-2xl border border-line">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-sunken text-soft">
          <tr>
            <th className="px-4 py-2 font-semibold">Group</th>
            <th className="px-4 py-2 text-right font-semibold">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <td className="px-4 py-2">{r.title}</td>
              <td className="px-4 py-2 text-right font-semibold tabular-nums">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableToggle({ shown, onToggle, controls }: { shown: boolean; onToggle: () => void; controls: string }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={shown}
      aria-controls={controls}
      className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition', shown ? 'bg-primary text-primary-ink' : 'text-soft hover:bg-sunken hover:text-ink')}
    >
      <Table2 className="size-4" aria-hidden />
      Table
    </button>
  );
}

interface ColumnProps {
  data: ChartDatum[];
  valueLabel: string;
  /** Index of the column to emphasise; the others turn neutral. */
  emphasis?: number;
  /** Show a label under every Nth column so labels never collide. */
  labelEvery?: number;
  height?: number;
  caption: string;
}

/** Column chart: one series, thin rounded columns on a single baseline, recessive grid. */
export function ColumnChart({ data, valueLabel, emphasis, labelEvery = 1, height = 220, caption }: ColumnProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const tableId = useId();
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f * 10) / 10);
  const hasEmphasis = emphasis !== undefined && emphasis >= 0;

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <TableToggle shown={table} onToggle={() => setTable((t) => !t)} controls={tableId} />
      </div>
      <div className="flex gap-3" role="img" aria-label={caption}>
        <div className="relative w-7 shrink-0 text-right text-xs text-soft tabular-nums" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {ticks.map((t) => (
              <div key={t} className={clsx('absolute inset-x-0 border-t', t === 0 ? 'border-line-strong' : 'border-line')} style={{ bottom: `${(t / max) * 100}%` }} aria-hidden />
            ))}
            <div className="absolute inset-0 flex" onPointerLeave={() => setHover(null)}>
              {data.map((d, i) => {
                const pct = (d.value / max) * 100;
                const dim = hasEmphasis && i !== emphasis;
                const active = hover === i;
                return (
                  <div
                    key={d.key}
                    tabIndex={0}
                    role="img"
                    aria-label={`${d.title}: ${d.value} ${valueLabel}`}
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="group relative flex h-full flex-1 items-end justify-center outline-none"
                  >
                    {/* Hit area is the full slot, far bigger than the painted column. */}
                    <span
                      className={clsx(
                        'w-full max-w-6 rounded-t-[4px] transition-[height,filter,background-color] duration-500 ease-out',
                        dim ? 'bg-line-strong' : 'bg-accent',
                        active && 'brightness-110',
                        d.value === 0 && 'opacity-0',
                      )}
                      style={{ height: `${Math.max(pct, d.value > 0 ? 1.5 : 0)}%`, marginInline: 1 }}
                    />
                    {active && (
                      <div
                        role="tooltip"
                        className={clsx(
                          'pointer-events-none absolute bottom-full z-10 mb-2 min-w-32 rounded-xl border border-line bg-surface px-3 py-2 text-left shadow-lift',
                          i > data.length * 0.65 ? 'right-0' : i < data.length * 0.35 ? 'left-0' : 'left-1/2 -translate-x-1/2',
                        )}
                        style={{ bottom: `calc(${Math.min(pct, 100)}% + 8px)` }}
                      >
                        <p className="font-display text-xl leading-none font-bold tabular-nums">{d.value}</p>
                        <p className="mt-0.5 text-xs whitespace-nowrap text-soft">{d.title}</p>
                        {d.detail?.map((line) => (
                          <p key={line} className="text-xs whitespace-nowrap text-soft">
                            {line}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex" aria-hidden>
            {data.map((d, i) => (
              <span key={d.key} className="relative h-4 flex-1 text-xs text-soft">
                {i % labelEvery === 0 && <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{d.label}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
      {table && (
        <div id={tableId}>
          <TableView rows={data} valueLabel={valueLabel} caption={caption} />
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars, one hue, value at the tip, largest first. */
export function BarList({ data, valueLabel, caption }: { data: ChartDatum[]; valueLabel: string; caption: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ol className="space-y-3.5" aria-label={caption}>
      {data.map((d, i) => (
        <li key={d.key} className="group">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[15px]">
            <span className="truncate font-medium">{d.title}</span>
            <span className="font-display text-lg font-bold tabular-nums">{d.value}</span>
          </div>
          <div className="h-3 rounded-full bg-sunken" title={`${d.title}: ${d.value} ${valueLabel}`}>
            <div
              className="h-full origin-left rounded-full bg-accent transition-[filter] duration-200 group-hover:brightness-110"
              style={{ width: `${(d.value / max) * 100}%`, animation: `bar-grow 0.7s cubic-bezier(0.22,1,0.36,1) ${i * 60}ms both` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
