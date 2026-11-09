import { useQueryClient } from '@tanstack/react-query';
import { Ban, Building2, CalendarClock, Car, IdCard, LogOut, Mail, Phone, Printer, Send, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react';
import { useState } from 'react';
import { photoUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, fmtWindow } from '@/lib/format';
import { useVisitAction, visitActions } from '@/lib/queries';
import type { Visit } from '@/lib/types';
import { Sheet, Modal } from './overlays';
import { PassCard } from './PassCard';
import { printBadge } from './PrintBadge';
import { useToast } from './toast';
import { Avatar, Button, StatusBadge } from './ui';

function Line({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 text-soft">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-soft">{label}</p>
        <div className="text-[15px] font-medium break-words">{children}</div>
      </div>
    </div>
  );
}

/** Everything about one visit, with the actions the signed-in person is allowed to take. */
export function VisitSheet({ visit, onClose }: { visit: Visit | null; onClose: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<'cancel' | 'checkout' | null>(null);

  const done = (message: string, close = true) => () => {
    toast.success(message);
    setConfirm(null);
    void qc.invalidateQueries({ queryKey: ['visits'] });
    if (close) onClose();
  };
  const fail = (e: Error) => toast.error(e.message);

  const cancel = useVisitAction((id: string) => visitActions.cancel(id), { onSuccess: done('Visit cancelled.') });
  const approve = useVisitAction((id: string) => visitActions.approve(id), { onSuccess: done('Walk-in approved.') });
  const reject = useVisitAction((id: string) => visitActions.reject(id), { onSuccess: done('Walk-in declined.') });
  const resend = useVisitAction((id: string) => visitActions.resend(id), { onSuccess: done('Pass sent by email.', false) });
  const checkOut = useVisitAction((id: string) => visitActions.checkOut(id), { onSuccess: done('Checked out.') });

  const v = visit;
  const role = user?.role;
  const canHost = role === 'HOST' || role === 'ADMIN';
  const canGate = role === 'GUARD' || role === 'ADMIN';
  const open = v?.status === 'SCHEDULED' || v?.status === 'APPROVED' || v?.status === 'PENDING_APPROVAL';

  const footer = v && (
    <div className="flex flex-wrap gap-2">
      {canHost && v.status === 'PENDING_APPROVAL' && (
        <>
          <Button variant="accent" icon={<ThumbsUp className="size-4" />} loading={approve.isPending} onClick={() => approve.mutate(v.id, { onError: fail })}>
            Approve
          </Button>
          <Button variant="danger" icon={<ThumbsDown className="size-4" />} loading={reject.isPending} onClick={() => reject.mutate(v.id, { onError: fail })}>
            Decline
          </Button>
        </>
      )}
      {canHost && v.passToken && v.visitor.email && (
        <Button variant="soft" icon={<Send className="size-4" />} loading={resend.isPending} onClick={() => resend.mutate(v.id, { onError: fail })}>
          Email pass again
        </Button>
      )}
      {canGate && v.status === 'CHECKED_IN' && (
        <>
          <Button variant="primary" icon={<LogOut className="size-4" />} onClick={() => setConfirm('checkout')}>
            Check out
          </Button>
          <Button variant="soft" icon={<Printer className="size-4" />} onClick={() => printBadge(v)}>
            Print badge
          </Button>
        </>
      )}
      {canHost && open && (
        <Button variant="ghost" icon={<Ban className="size-4" />} className="ml-auto text-danger" onClick={() => setConfirm('cancel')}>
          Cancel visit
        </Button>
      )}
    </div>
  );

  const hasFooter =
    v &&
    ((canHost && (open || Boolean(v.passToken))) || (canGate && v.status === 'CHECKED_IN'));

  return (
    <>
      <Sheet open={Boolean(v)} onClose={onClose} title="Visit details" footer={hasFooter ? footer : undefined}>
        {v && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={v.visitor.fullName} src={photoUrl(v.entryPhotoUrl)} size={64} />
              <div className="min-w-0">
                <h3 className="text-2xl leading-tight font-bold">{v.visitor.fullName}</h3>
                <div className="mt-1.5">
                  <StatusBadge status={v.status} />
                </div>
              </div>
            </div>

            {(v.status === 'SCHEDULED' || v.status === 'APPROVED') && (
              <div className="rounded-3xl bg-sunken p-4">
                <PassCard
                  swing={false}
                  pass={{
                    name: v.visitor.fullName,
                    company: v.visitor.company,
                    hostName: v.host.name,
                    expectedFrom: v.expectedFrom,
                    expectedTo: v.expectedTo,
                    status: v.status,
                    passToken: v.passToken,
                    passCode: v.passCode,
                  }}
                />
              </div>
            )}

            <div className="divide-y divide-line rounded-2xl border border-line px-4">
              <Line icon={<UserRound className="size-[18px]" />} label="Visiting">
                {v.host.name}
              </Line>
              <Line icon={<CalendarClock className="size-[18px]" />} label="Pass window">
                {fmtWindow(v.expectedFrom, v.expectedTo)}
              </Line>
              {v.checkInAt && (
                <Line icon={<CalendarClock className="size-[18px]" />} label="Checked in">
                  {fmtDateTime(v.checkInAt)}
                  {v.badgeNumber && <span className="ml-2 text-soft">Badge {v.badgeNumber}</span>}
                </Line>
              )}
              {v.checkOutAt && (
                <Line icon={<LogOut className="size-[18px]" />} label="Checked out">
                  {fmtDateTime(v.checkOutAt)}
                </Line>
              )}
              <Line icon={<Building2 className="size-[18px]" />} label="Purpose">
                {v.purpose}
              </Line>
              {v.visitor.company && (
                <Line icon={<Building2 className="size-[18px]" />} label="Company">
                  {v.visitor.company}
                </Line>
              )}
              <Line icon={<Phone className="size-[18px]" />} label="Phone">
                <a href={`tel:${v.visitor.phone}`} className="underline decoration-line-strong underline-offset-4 hover:decoration-accent">
                  {v.visitor.phone}
                </a>
              </Line>
              {v.visitor.email && (
                <Line icon={<Mail className="size-[18px]" />} label="Email">
                  {v.visitor.email}
                </Line>
              )}
              {v.visitor.idNumber && (
                <Line icon={<IdCard className="size-[18px]" />} label={v.visitor.idType ?? 'ID number'}>
                  {v.visitor.idNumber}
                </Line>
              )}
              {v.vehiclePlate && (
                <Line icon={<Car className="size-[18px]" />} label="Vehicle">
                  {v.vehiclePlate}
                </Line>
              )}
            </div>
          </div>
        )}
      </Sheet>

      <Modal
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        title="Cancel this visit?"
        footer={
          <>
            <Button variant="soft" onClick={() => setConfirm(null)}>
              Keep visit
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={() => v && cancel.mutate(v.id, { onError: fail })}>
              Cancel visit
            </Button>
          </>
        }
      >
        {v?.visitor.fullName}&rsquo;s pass will stop working straight away. The visitor is not notified, so let them know yourself.
      </Modal>

      <Modal
        open={confirm === 'checkout'}
        onClose={() => setConfirm(null)}
        title="Check this visitor out?"
        footer={
          <>
            <Button variant="soft" onClick={() => setConfirm(null)}>
              Not yet
            </Button>
            <Button variant="primary" loading={checkOut.isPending} onClick={() => v && checkOut.mutate(v.id, { onError: fail })}>
              Check out
            </Button>
          </>
        }
      >
        {v?.visitor.fullName} will no longer count as inside the building.
      </Modal>
    </>
  );
}
