import { CalendarCheck, CalendarPlus, DoorOpen, Hourglass, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StatTile } from '@/components/StatTile';
import { useToast } from '@/components/toast';
import { Avatar, Button, Card, LinkButton, PageHeader, SectionTitle } from '@/components/ui';
import { VisitList } from '@/components/VisitList';
import { VisitSheet } from '@/components/VisitSheet';
import { useAuth } from '@/lib/auth';
import { dayBound, fmtTime, greeting } from '@/lib/format';
import { useSummary, useVisitAction, useVisits, visitActions } from '@/lib/queries';
import type { Visit } from '@/lib/types';

function Approvals({ visits, onOpen }: { visits: Visit[]; onOpen: (v: Visit) => void }) {
  const toast = useToast();
  const approve = useVisitAction((id: string) => visitActions.approve(id), { onSuccess: () => toast.success('Walk-in approved. The front desk can check them in.') });
  const reject = useVisitAction((id: string) => visitActions.reject(id), { onSuccess: () => toast.info('Walk-in declined.') });
  const fail = (e: Error) => toast.error(e.message);

  return (
    <section aria-label="Walk-ins waiting for you" className="mb-8">
      <SectionTitle title="Waiting at reception" className="mb-3" />
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {visits.map((v) => (
            <motion.li
              key={v.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            >
              <Card className="border-warning/40 bg-warning-wash/60 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <button onClick={() => onOpen(v)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
                    <Avatar name={v.visitor.fullName} size={48} />
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-semibold">{v.visitor.fullName}</span>
                      <span className="block truncate text-[15px] text-soft">
                        {[v.visitor.company, v.purpose].filter(Boolean).join(' · ')}
                      </span>
                      <span className="mt-0.5 block text-sm text-soft">Arrived at {fmtTime(v.createdAt)}</span>
                    </span>
                  </button>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Button variant="accent" className="flex-1 sm:flex-none" loading={approve.isPending && approve.variables === v.id} onClick={() => approve.mutate(v.id, { onError: fail })}>
                      Let them in
                    </Button>
                    <Button variant="danger" className="flex-1 sm:flex-none" loading={reject.isPending && reject.variables === v.id} onClick={() => reject.mutate(v.id, { onError: fail })}>
                      Decline
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

export default function HostToday() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState<Visit | null>(null);

  const today = useMemo(() => ({ from: dayBound(0), to: dayBound(1) }), []);
  const summary = useSummary();
  const pending = useVisits({ status: 'PENDING_APPROVAL', pageSize: 20, order: 'asc' });
  const inside = useVisits({ status: 'CHECKED_IN', pageSize: 20, order: 'asc' });
  const expected = useVisits({ status: 'SCHEDULED,APPROVED', ...today, pageSize: 30, order: 'asc' });

  const firstName = user?.name.split(' ')[0] ?? '';
  const pendingItems = pending.data?.items ?? [];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        subtitle="Who is here, who is on the way, and who is waiting for you."
        actions={
          <LinkButton to="/host/new" variant="primary">
            <CalendarPlus className="size-5" aria-hidden />
            Invite a visitor
          </LinkButton>
        }
      />

      {pendingItems.length > 0 && <Approvals visits={pendingItems} onOpen={setOpen} />}

      <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatTile label="Expected today" value={summary.data?.expectedToday} icon={CalendarCheck} />
        <StatTile label="Inside now" value={summary.data?.insideNow} icon={DoorOpen} tone="accent" />
        <StatTile label="Visited today" value={summary.data?.completedToday} icon={UserCheck} />
        <StatTile label="Need your answer" value={summary.data?.pendingApproval} icon={Hourglass} tone={summary.data?.pendingApproval ? 'warning' : 'default'} />
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle title="Inside now" className="mb-3" />
          <VisitList
            visits={inside.data?.items}
            loading={inside.isPending}
            onOpen={setOpen}
            showElapsed
            emptyTitle="Nobody is inside"
            emptyBody="Visitors appear here the moment the front desk checks them in."
          />
        </section>
        <section>
          <SectionTitle
            title="Expected today"
            className="mb-3"
            action={
              <Link to="/host/visits" className="text-sm font-semibold text-accent-text underline-offset-4 hover:underline">
                All visits
              </Link>
            }
          />
          <VisitList
            visits={expected.data?.items}
            loading={expected.isPending}
            onOpen={setOpen}
            emptyTitle="No one else is expected today"
            emptyBody="Invite a visitor and they get a pass with a QR code by email."
            emptyAction={
              <Button variant="accent" size="sm" onClick={() => navigate('/host/new')}>
                Invite a visitor
              </Button>
            }
          />
        </section>
      </div>

      <VisitSheet visit={open} onClose={() => setOpen(null)} />
    </>
  );
}
