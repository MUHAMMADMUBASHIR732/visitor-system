import { ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/toast';
import { Button, PageHeader, Segmented, Select } from '@/components/ui';
import { VisitList } from '@/components/VisitList';
import { VisitSheet } from '@/components/VisitSheet';
import { downloadFile } from '@/lib/api';
import { dayBound } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { useHosts, useVisits } from '@/lib/queries';
import type { Visit } from '@/lib/types';

type Tab = 'all' | 'upcoming' | 'inside' | 'past' | 'attention';
type Range = 'any' | 'today' | '7d' | '30d';

const TAB_STATUS: Record<Tab, string | undefined> = {
  all: undefined,
  upcoming: 'SCHEDULED,APPROVED',
  inside: 'CHECKED_IN',
  past: 'CHECKED_OUT',
  attention: 'PENDING_APPROVAL,NO_SHOW,REJECTED,CANCELLED',
};

function rangeBounds(r: Range): { from?: string; to?: string } {
  if (r === 'today') return { from: dayBound(0), to: dayBound(1) };
  if (r === '7d') return { from: dayBound(-6), to: dayBound(1) };
  if (r === '30d') return { from: dayBound(-29), to: dayBound(1) };
  return {};
}

export default function VisitsPage({ mode }: { mode: 'host' | 'admin' }) {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('all');
  const [range, setRange] = useState<Range>('any');
  const [hostId, setHostId] = useState('');
  const [text, setText] = useState(params.get('q') ?? '');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Visit | null>(null);
  const [exporting, setExporting] = useState(false);
  const { user: me } = useAuth();
  const hosts = useHosts(me?.role === 'ADMIN' ? undefined : 'team');

  // Wait for a pause in typing before searching.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(text.trim());
      setPage(1);
      const next = new URLSearchParams(params);
      if (text.trim()) next.set('q', text.trim());
      else next.delete('q');
      setParams(next, { replace: true });
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const bounds = rangeBounds(range);
  const filters = { status: TAB_STATUS[tab], q: q || undefined, hostId: mode === 'admin' && hostId ? hostId : undefined, order: tab === 'upcoming' ? ('asc' as const) : ('desc' as const), page, pageSize: 15, ...bounds };
  const { data, isPending, isFetching } = useVisits(filters);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = Boolean(q || hostId || range !== 'any' || tab !== 'all');

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile('/reports/export.csv', 'foyer-visits.csv', { from: bounds.from ?? dayBound(-365), to: bounds.to ?? dayBound(1) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'The export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title={mode === 'admin' ? 'Visit log' : 'My visits'}
        subtitle={mode === 'admin' ? (me?.role === 'ADMIN' ? 'Every visit in the building, searchable and exportable.' : 'Every visit for you and your team, searchable and exportable.') : 'Everyone you have invited, past and upcoming.'}
        actions={
          mode === 'admin' && (
            <Button variant="soft" icon={<Download className="size-4" />} loading={exporting} onClick={exportCsv}>
              Export CSV
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented<Tab>
            label="Filter by status"
            value={tab}
            onChange={(t) => {
              setTab(t);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'inside', label: 'Inside' },
              { value: 'past', label: 'Left' },
              { value: 'attention', label: 'Needs attention' },
            ]}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-soft" aria-hidden />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search by name, phone or company"
              aria-label="Search visits"
              className="h-11 w-full rounded-control border border-line-strong bg-surface pr-10 pl-10 text-[15px] transition hover:border-soft focus:border-accent focus:ring-4 focus:ring-accent/20 focus:outline-none"
            />
            {text && (
              <button onClick={() => setText('')} aria-label="Clear search" className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-soft hover:bg-sunken">
                <X className="size-4" />
              </button>
            )}
          </div>
          <Select
            label="Date"
            fieldClassName="[&>label]:sr-only"
            value={range}
            onChange={(e) => {
              setRange(e.target.value as Range);
              setPage(1);
            }}
          >
            <option value="any">Any date</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </Select>
          {mode === 'admin' && (
            <Select
              label="Host"
              fieldClassName="[&>label]:sr-only"
              value={hostId}
              onChange={(e) => {
                setHostId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All hosts</option>
              {hosts.data?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <div className={isFetching && !isPending ? 'opacity-70 transition-opacity' : 'transition-opacity'}>
        <VisitList
          visits={data?.items}
          loading={isPending}
          onOpen={setOpen}
          showHost={mode === 'admin'}
          emptyTitle={filtered ? 'No visits match these filters' : 'No visits yet'}
          emptyBody={filtered ? 'Try a different search, date range or status.' : 'Visits appear here once they are created.'}
          emptyAction={
            filtered ? (
              <Button
                variant="soft"
                size="sm"
                onClick={() => {
                  setTab('all');
                  setRange('any');
                  setHostId('');
                  setText('');
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      </div>

      {data && data.total > data.pageSize && (
        <nav className="mt-5 flex items-center justify-between" aria-label="Pagination">
          <p className="text-sm text-soft">
            Page {page} of {pages} &middot; {data.total} visits
          </p>
          <div className="flex gap-2">
            <Button variant="soft" size="sm" icon={<ChevronLeft className="size-4" />} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="soft" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </nav>
      )}

      <VisitSheet visit={open} onClose={() => setOpen(null)} />
    </>
  );
}
