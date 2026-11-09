import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { DoorOpen, Footprints, Lightbulb, Timer, UserX, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BarList, ColumnChart, type ChartDatum } from '@/components/charts';
import { StatTile } from '@/components/StatTile';
import { Card, PageHeader, Segmented, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { dayBound, fmtDuration } from '@/lib/format';
import type { ReportSummary } from '@/lib/types';

type Range = '7' | '30' | '90';

const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const dayLong = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

function hourLabel(h: number) {
  const suffix = h < 12 ? 'am' : 'pm';
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}

function buildDays(report: ReportSummary, span: number): ChartDatum[] {
  const byDay = new Map(report.byDay.map((d) => [d.day, d]));
  const out: ChartDatum[] = [];
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const row = byDay.get(key);
    out.push({
      key,
      label: dayFmt.format(d),
      title: dayLong.format(d),
      value: row?.arrived ?? 0,
      detail: row ? [`${row.visits} booked`] : ['Nothing booked'],
    });
  }
  return out;
}

function buildHours(report: ReportSummary): ChartDatum[] {
  const byHour = new Map(report.byHour.map((h) => [h.hour, h.arrivals]));
  const out: ChartDatum[] = [];
  for (let h = 7; h <= 20; h++) out.push({ key: String(h), label: hourLabel(h), title: `${hourLabel(h)} to ${hourLabel(h + 1)}`, value: byHour.get(h) ?? 0 });
  return out;
}

/** Plain-language findings so admins do not have to read charts to learn something. */
function insights(report: ReportSummary, hours: ChartDatum[]): string[] {
  const t = report.totals;
  const list: string[] = [];
  const peak = hours.reduce((a, b) => (b.value > a.value ? b : a), hours[0]!);
  if (peak.value > 0) list.push(`Most visitors arrive between ${peak.title}. Make sure the front desk is staffed then.`);
  if (t.total > 0) {
    const noShow = Math.round((t.noShows / t.total) * 100);
    if (noShow >= 10) list.push(`${noShow}% of passes went unused. Reminding visitors the day before usually helps.`);
    const walk = Math.round((t.walkIns / t.total) * 100);
    if (walk >= 15) list.push(`${walk}% of visitors came without an appointment. Hosts could pre-register regular guests to speed up the desk.`);
  }
  if (t.avgMinutes > 0) list.push(`Visitors stay ${fmtDuration(t.avgMinutes)} on average.`);
  const top = report.topHosts[0];
  if (top) list.push(`${top.name} hosted the most visitors (${top.visits}).`);
  return list.slice(0, 4);
}

export default function Overview() {
  const { user: me } = useAuth();
  const [range, setRange] = useState<Range>('30');
  const span = Number(range);
  const bounds = useMemo(() => ({ from: dayBound(-(span - 1)), to: dayBound(1) }), [span]);

  const { data, isPending } = useQuery({
    queryKey: ['report', bounds],
    queryFn: () => api<ReportSummary>('/reports/summary', { query: bounds }),
    refetchInterval: 60_000,
  });

  const days = useMemo(() => (data ? buildDays(data, span) : []), [data, span]);
  const hours = useMemo(() => (data ? buildHours(data) : []), [data]);
  const peakHour = hours.length ? hours.reduce((best, h, i) => (h.value > hours[best]!.value ? i : best), 0) : -1;
  const findings = useMemo(() => (data ? insights(data, hours) : []), [data, hours]);
  const hosts: ChartDatum[] = (data?.topHosts ?? []).map((h) => ({ key: h.id, label: h.name, title: h.name, value: h.visits }));
  const t = data?.totals;

  return (
    <>
      <PageHeader
        title={me?.role === 'ADMIN' ? 'Overview' : 'Team dashboard'}
        subtitle={me?.role === 'ADMIN' ? 'How visitors move through your building.' : 'How visitors move through your team.'}
        actions={
          <Segmented<Range>
            label="Time range"
            value={range}
            onChange={setRange}
            options={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 max-md:[&>*:last-child]:col-span-2 md:grid-cols-3 md:gap-4 xl:grid-cols-5">
        <StatTile label="Inside now" value={t?.insideNow} icon={DoorOpen} tone="accent" />
        <StatTile label="Visitors arrived" value={t?.arrived} icon={Users} note={t ? `of ${t.total} booked` : undefined} />
        <StatTile label="Walk-ins" value={t?.walkIns} icon={Footprints} />
        <StatTile label="No-shows" value={t?.noShows} icon={UserX} tone={t && t.noShows > 0 ? 'warning' : 'default'} />
        <StatTile label="Average stay (min)" value={t?.avgMinutes} icon={Timer} />
      </div>

      {findings.length > 0 && (
        <Card className="mb-6 border-accent/30 bg-accent-wash/60 p-5">
          <div className="flex items-center gap-2 text-accent-text">
            <Lightbulb className="size-5" aria-hidden />
            <h2 className="text-lg font-semibold">What stands out</h2>
          </div>
          <ul className="mt-3 grid gap-x-8 gap-y-2 text-[15px] md:grid-cols-2">
            {findings.map((f) => (
              <li key={f} className="flex gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 sm:p-6 lg:col-span-3">
          <h2 className="text-xl font-semibold">Visitors per day</h2>
          <p className="mt-0.5 text-sm text-soft">People who actually arrived. Hover a column to see how many were booked.</p>
          <div className="mt-5">
            {isPending ? <Skeleton className="h-60 w-full" /> : <ColumnChart data={days} valueLabel="visitors" labelEvery={span <= 7 ? 1 : span <= 30 ? 5 : 15} caption={`Visitors who arrived per day over the last ${span} days`} />}
          </div>
        </Card>

        <Card className="p-5 sm:p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold">Busiest hours</h2>
          <p className="mt-0.5 text-sm text-soft">Check-ins by hour of the day.</p>
          <div className="mt-5">
            {isPending ? <Skeleton className="h-60 w-full" /> : <ColumnChart data={hours} valueLabel="check-ins" emphasis={hours[peakHour] && hours[peakHour]!.value > 0 ? peakHour : undefined} labelEvery={2} caption="Check-ins by hour of the day" />}
          </div>
        </Card>

        <Card className="p-5 sm:p-6 lg:col-span-5">
          <h2 className="text-xl font-semibold">Most visited people</h2>
          <p className="mt-0.5 mb-5 text-sm text-soft">Hosts with the most visits in this period.</p>
          {isPending ? <Skeleton className="h-40 w-full" /> : hosts.length ? <BarList data={hosts} valueLabel="visits" caption="Hosts ranked by number of visits" /> : <p className="py-6 text-center text-[15px] text-soft">No visits in this period yet.</p>}
        </Card>
      </div>
    </>
  );
}
