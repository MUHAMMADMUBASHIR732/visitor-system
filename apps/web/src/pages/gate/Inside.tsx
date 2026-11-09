import { LogOut, Search, Siren, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/toast';
import { Button, PageHeader } from '@/components/ui';
import { VisitList } from '@/components/VisitList';
import { VisitSheet } from '@/components/VisitSheet';
import { CountUp } from '@/components/CountUp';
import { useInside, useVisitAction, visitActions } from '@/lib/queries';
import type { Visit } from '@/lib/types';

export default function Inside() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isPending } = useInside();
  const [open, setOpen] = useState<Visit | null>(null);
  const [q, setQ] = useState('');
  const [, tick] = useState(0);

  // Re-render every minute so "time inside" stays current without refetching.
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const checkOut = useVisitAction((id: string) => visitActions.checkOut(id), { onSuccess: () => toast.success('Checked out.') });

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data?.filter((v) => [v.visitor.fullName, v.visitor.company, v.host.name, v.badgeNumber].some((s) => s?.toLowerCase().includes(term)));
  }, [data, q]);

  return (
    <>
      <PageHeader
        title="Inside now"
        subtitle="Everyone checked in and not yet checked out."
        actions={
          <Button variant="danger" icon={<Siren className="size-4" />} onClick={() => navigate('/gate/roll-call')}>
            Emergency roll call
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 rounded-full bg-primary py-2 pr-5 pl-2 text-primary-ink">
          <span className="flex size-10 items-center justify-center rounded-full bg-white/15">
            <Users className="size-5" />
          </span>
          <span className="text-[15px] font-medium">
            <CountUp value={data?.length ?? 0} className="font-display text-2xl font-bold" /> {data?.length === 1 ? 'visitor' : 'visitors'} inside
          </span>
        </div>
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-soft" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find by name, host or badge"
            aria-label="Find a visitor inside"
            className="h-11 w-full rounded-control border border-line-strong bg-surface pr-4 pl-10 text-[15px] transition hover:border-soft focus:border-accent focus:ring-4 focus:ring-accent/20 focus:outline-none"
          />
        </div>
      </div>

      <VisitList
        visits={shown}
        loading={isPending}
        onOpen={setOpen}
        showHost
        showElapsed
        emptyTitle={q ? 'No one inside matches that' : 'The building is empty of visitors'}
        emptyBody={q ? 'Check the spelling or clear the search.' : 'People show up here as soon as you check them in.'}
        trailing={(v) => (
          <Button size="sm" variant="soft" className="mr-1 shrink-0" icon={<LogOut className="size-4" />} loading={checkOut.isPending && checkOut.variables === v.id} onClick={() => checkOut.mutate(v.id, { onError: (e) => toast.error(e.message) })}>
            <span className="hidden sm:inline">Check out</span>
          </Button>
        )}
      />

      <VisitSheet visit={open} onClose={() => setOpen(null)} />
    </>
  );
}
