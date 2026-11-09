import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import type { AuditEntry, Paged } from '@/lib/types';

const LABELS: Record<string, string> = {
  'auth.login': 'signed in',
  'user.create': 'added a person',
  'user.update': 'changed a person',
  'department.create': 'added a department',
  'visit.create': 'invited a visitor',
  'visit.cancel': 'cancelled a visit',
  'visit.resend': 'emailed a pass again',
  'walkin.approve': 'approved a walk-in',
  'walkin.reject': 'declined a walk-in',
  'gate.walk_in': 'registered a walk-in',
  'gate.check_in': 'checked a visitor in',
  'gate.check_out': 'checked a visitor out',
  'gate.scan.denied': 'turned a visitor away',
  'blacklist.add': 'added someone to the blacklist',
  'blacklist.remove': 'removed someone from the blacklist',
  'rollcall.start': 'started an emergency roll call',
  'rollcall.end': 'ended an emergency roll call',
};

function detail(a: AuditEntry): string | null {
  const m = a.metadata ?? {};
  if (typeof m.reason === 'string') return m.reason;
  if (typeof m.badge === 'string') return `Badge ${m.badge}`;
  if (typeof m.people === 'number') return `${m.people} ${m.people === 1 ? 'person' : 'people'} inside`;
  if (typeof m.missing === 'number') return m.missing === 0 ? 'Everyone accounted for' : `${m.missing} unaccounted for`;
  return null;
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data, isPending } = useQuery({
    queryKey: ['audit', page],
    queryFn: () => api<Paged<AuditEntry>>('/audit', { query: { page, pageSize: 25 } }),
    placeholderData: keepPreviousData,
  });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Audit trail" subtitle="Who did what, and when. Entries cannot be edited or deleted from the app." />
      <Card className="overflow-hidden">
        {isPending ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !data?.items.length ? (
          <EmptyState icon={<ScrollText className="size-6" />} title="Nothing recorded yet" />
        ) : (
          <ul>
            {data.items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line px-4 py-3 last:border-b-0 sm:px-5">
                <p className="min-w-0 flex-1 text-[15px]">
                  <span className="font-semibold">{a.user ?? 'The system'}</span> {LABELS[a.action] ?? a.action}
                  {detail(a) && <span className="text-soft"> &middot; {detail(a)}</span>}
                </p>
                <time dateTime={a.createdAt} className="text-sm text-soft tabular-nums">
                  {fmtDateTime(a.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {data && data.total > data.pageSize && (
        <nav className="mt-5 flex items-center justify-between" aria-label="Pagination">
          <p className="text-sm text-soft">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            <Button variant="soft" size="sm" icon={<ChevronLeft className="size-4" />} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Newer
            </Button>
            <Button variant="soft" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Older
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </nav>
      )}
    </>
  );
}
