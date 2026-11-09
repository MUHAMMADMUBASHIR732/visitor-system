import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Phone, Siren, Undo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Modal } from '@/components/overlays';
import { useToast } from '@/components/toast';
import { Avatar, Button, Card, EmptyState, Input, PageHeader, SectionTitle, Skeleton } from '@/components/ui';
import { api, photoUrl } from '@/lib/api';
import { fmtTime } from '@/lib/format';
import { useInside, useRollCall } from '@/lib/queries';
import type { RollCall, RollCallEntry } from '@/lib/types';

function ProgressRing({ safe, total }: { safe: number; total: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 1 : safe / total;
  return (
    <div className="relative size-36 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-line" />
        <motion.circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round" className={pct === 1 ? 'stroke-success' : 'stroke-danger'} strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }} transition={{ type: 'spring', damping: 24, stiffness: 90 }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-bold tabular-nums">{safe}</span>
        <span className="text-sm text-soft">of {total} safe</span>
      </div>
    </div>
  );
}

function EntryRow({ entry, onMark, pending }: { entry: RollCallEntry; onMark: (e: RollCallEntry, safe: boolean) => void; pending: boolean }) {
  const safe = Boolean(entry.safeAt);
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ type: 'spring', damping: 26, stiffness: 320 }} className="flex items-center gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5">
      <Avatar name={entry.fullName} src={photoUrl(entry.photo)} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{entry.fullName}</p>
        <p className="truncate text-sm text-soft">
          {entry.badgeNumber ? `${entry.badgeNumber} · ` : ''}
          Host {entry.hostName}
        </p>
      </div>
      {!safe && (
        <a href={`tel:${entry.phone}`} aria-label={`Call ${entry.fullName}`} className="hidden size-11 items-center justify-center rounded-full bg-sunken text-soft transition hover:bg-line hover:text-ink sm:flex">
          <Phone className="size-[18px]" />
        </a>
      )}
      {safe ? (
        <div className="flex items-center gap-2">
          <span className="hidden text-sm font-medium text-success sm:inline">Safe at {fmtTime(entry.safeAt)}</span>
          <button onClick={() => onMark(entry, false)} disabled={pending} aria-label={`Undo safe mark for ${entry.fullName}`} className="flex size-11 items-center justify-center rounded-full text-soft transition hover:bg-sunken hover:text-ink">
            <Undo2 className="size-[18px]" />
          </button>
        </div>
      ) : (
        <Button variant="accent" size="md" icon={<CheckCircle2 className="size-5" />} disabled={pending} onClick={() => onMark(entry, true)}>
          Safe
        </Button>
      )}
    </motion.li>
  );
}

function Active({ call }: { call: RollCall }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [confirmEnd, setConfirmEnd] = useState(false);

  const mark = useMutation({
    mutationFn: ({ entry, safe }: { entry: RollCallEntry; safe: boolean }) => api<RollCall>(`/roll-call/entries/${entry.entryId}/${safe ? 'safe' : 'undo'}`, { method: 'POST' }),
    onSuccess: (c) => qc.setQueryData(['rollcall'], c),
    onError: (e: Error) => toast.error(e.message),
  });
  const end = useMutation({
    mutationFn: () => api<RollCall>('/roll-call/end', { method: 'POST' }),
    onSuccess: () => {
      setConfirmEnd(false);
      qc.setQueryData(['rollcall'], null);
      void qc.invalidateQueries({ queryKey: ['rollcall'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const missing = call.entries.filter((e) => !e.safeAt);
  const safe = call.entries.filter((e) => e.safeAt);
  const onMark = (entry: RollCallEntry, s: boolean) => mark.mutate({ entry, safe: s });

  return (
    <>
      <PageHeader title="Emergency roll call" subtitle={`Started at ${fmtTime(call.startedAt)}${call.reason ? `. Reason: ${call.reason}` : ''}`} actions={<Button variant="primary" onClick={() => setConfirmEnd(true)}>End roll call</Button>} />

      <Card className="mb-8 flex flex-wrap items-center gap-6 p-6">
        <ProgressRing safe={call.safe} total={call.total} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-3xl font-bold">{call.missing === 0 ? 'Everyone is accounted for' : `${call.missing} still to find`}</p>
          <p className="mt-1.5 max-w-md text-[15px] text-soft">
            {call.missing === 0 ? 'You can end the roll call.' : 'At the assembly point, tap Safe next to each person you see. Call anyone who is missing.'}
          </p>
        </div>
      </Card>

      <section className="mb-8">
        <SectionTitle title={`Not yet accounted for (${missing.length})`} className="mb-3" />
        <Card className="overflow-hidden">
          {missing.length === 0 ? (
            <p className="px-6 py-10 text-center text-[15px] font-medium text-success">Nobody is missing.</p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {missing.map((e) => (
                  <EntryRow key={e.entryId} entry={e} onMark={onMark} pending={mark.isPending} />
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      </section>

      {safe.length > 0 && (
        <section>
          <SectionTitle title={`Safe (${safe.length})`} className="mb-3" />
          <Card className="overflow-hidden">
            <ul>
              <AnimatePresence initial={false}>
                {safe.map((e) => (
                  <EntryRow key={e.entryId} entry={e} onMark={onMark} pending={mark.isPending} />
                ))}
              </AnimatePresence>
            </ul>
          </Card>
        </section>
      )}

      <Modal
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="End the roll call?"
        footer={
          <>
            <Button variant="soft" onClick={() => setConfirmEnd(false)}>
              Keep going
            </Button>
            <Button variant="primary" loading={end.isPending} onClick={() => end.mutate()}>
              End roll call
            </Button>
          </>
        }
      >
        {call.missing > 0 ? `${call.missing} ${call.missing === 1 ? 'person is' : 'people are'} still not marked safe. Only end the roll call once everyone is found or emergency services have taken over.` : 'Everyone is marked safe. The result is saved in the audit trail.'}
      </Modal>
    </>
  );
}

function Start() {
  const toast = useToast();
  const qc = useQueryClient();
  const inside = useInside();
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);

  const start = useMutation({
    mutationFn: () => api<RollCall>('/roll-call/start', { body: { reason: reason.trim() || undefined } }),
    onSuccess: (c) => {
      setConfirm(false);
      qc.setQueryData(['rollcall'], c);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const n = inside.data?.length;

  return (
    <>
      <PageHeader title="Emergency roll call" subtitle="Freeze the list of everyone inside, then mark each person safe at the assembly point." />
      <Card className="max-w-2xl p-6 sm:p-8">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-danger-wash text-danger">
          <Siren className="size-7" />
        </div>
        <h2 className="mt-5 text-2xl font-bold">Start only in a real emergency or a drill</h2>
        <p className="mt-2 text-[15px] text-soft">
          {n === undefined ? <Skeleton className="h-5 w-64" /> : n === 0 ? 'No visitors are inside right now, so there is nobody to account for.' : `${n} ${n === 1 ? 'visitor is' : 'visitors are'} inside right now. Every host and guard sees a red banner until you end the roll call.`}
        </p>
        <div className="mt-6">
          <Input label="Reason" hint="Optional. Shown on the banner and saved in the audit trail." placeholder="Fire drill, evacuation" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
        </div>
        <Button size="lg" variant="alert" className="mt-6" icon={<Siren className="size-5" />} disabled={n === 0} onClick={() => setConfirm(true)}>
          Start roll call
        </Button>
      </Card>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Start the emergency roll call?"
        footer={
          <>
            <Button variant="soft" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button variant="alert" loading={start.isPending} onClick={() => start.mutate()}>
              Start now
            </Button>
          </>
        }
      >
        Everyone in the building will see the alert straight away.
      </Modal>
    </>
  );
}

export default function RollCallPage() {
  const { data, isPending } = useRollCall();
  if (isPending) return <Skeleton className="h-96 w-full" />;
  if (data === undefined) return <EmptyState icon={<Siren className="size-6" />} title="Could not load the roll call" />;
  return data ? <Active call={data} /> : <Start />;
}
